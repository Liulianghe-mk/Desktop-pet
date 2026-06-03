use std::{path::Path, process::Command, sync::Mutex};

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State,
};

struct PetFleeState(Mutex<Option<(i32, i32)>>);

#[tauri::command]
fn emergency_stop(app: AppHandle) -> Result<(), String> {
    app.emit("emergency-stop", ())
        .map_err(|err| format!("failed to emit emergency event: {err}"))?;
    Ok(())
}

fn toggle_main_window(app: &AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    if window.is_visible().map_err(|err| err.to_string())? {
        window.hide().map_err(|err| err.to_string())?;
    } else {
        window.show().map_err(|err| err.to_string())?;
        window.set_focus().map_err(|err| err.to_string())?;
    }
    Ok(())
}

fn toggle_pet_window(app: &AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("pet")
        .ok_or_else(|| "pet window not found".to_string())?;
    if window.is_visible().map_err(|err| err.to_string())? {
        window.hide().map_err(|err| err.to_string())?;
    } else {
        window.show().map_err(|err| err.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn show_main_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    window.show().map_err(|err| err.to_string())?;
    window.set_focus().map_err(|err| err.to_string())?;
    Ok(())
}

/// Resize the pet window while keeping its bottom-center fixed on screen.
fn set_pet_physical_size(pet: &tauri::WebviewWindow, width: u32, height: u32) -> Result<(), String> {
    let scale = pet.scale_factor().map_err(|err| err.to_string())?;
    let pos = pet.outer_position().map_err(|err| err.to_string())?;
    let size = pet.outer_size().map_err(|err| err.to_string())?;

    let new_w = (width as f64 * scale).round() as u32;
    let new_h = (height as f64 * scale).round() as u32;

    let bottom = pos.y + size.height as i32;
    let center_x = pos.x + (size.width as f64 / 2.0).round() as i32;
    let new_x = center_x - (new_w as i32 / 2);
    let new_y = bottom - new_h as i32;

    pet.set_size(tauri::PhysicalSize::new(new_w, new_h))
        .map_err(|err| err.to_string())?;
    pet.set_position(tauri::PhysicalPosition::new(new_x, new_y))
        .map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
fn set_pet_size(app: AppHandle, scale: u32) -> Result<(), String> {
    let scale = scale.clamp(60, 200);
    let width = (220.0 * scale as f64 / 100.0).round() as u32;
    let height = (280.0 * scale as f64 / 100.0).round() as u32;

    let pet = app
        .get_webview_window("pet")
        .ok_or_else(|| "pet window not found".to_string())?;

    set_pet_physical_size(&pet, width, height)?;
    app.emit("pet-size-changed", scale)
        .map_err(|err| format!("failed to emit pet-size-changed: {err}"))?;
    Ok(())
}

#[tauri::command]
fn toggle_float_pet(app: AppHandle) -> Result<bool, String> {
    let pet = app
        .get_webview_window("pet")
        .ok_or_else(|| "pet window not found".to_string())?;
    let visible = pet.is_visible().map_err(|err| err.to_string())?;
    if visible {
        pet.hide().map_err(|err| err.to_string())?;
        Ok(false)
    } else {
        pet.show().map_err(|err| err.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
fn set_pet_window_size(app: AppHandle, width: u32, height: u32) -> Result<(), String> {
    let width = width.clamp(200, 520);
    let height = height.clamp(200, 720);
    let pet = app
        .get_webview_window("pet")
        .ok_or_else(|| "pet window not found".to_string())?;
    set_pet_physical_size(&pet, width, height)
}

#[tauri::command]
fn pet_flee_to_corner(app: AppHandle, state: State<'_, PetFleeState>) -> Result<(), String> {
    let pet = app
        .get_webview_window("pet")
        .ok_or_else(|| "pet window not found".to_string())?;

    let pos = pet.outer_position().map_err(|err| err.to_string())?;
    let size = pet.outer_size().map_err(|err| err.to_string())?;

    if let Ok(mut saved) = state.0.lock() {
        if saved.is_none() {
            *saved = Some((pos.x, pos.y));
        }
    }

    let monitor = pet
        .current_monitor()
        .map_err(|err| err.to_string())?
        .ok_or_else(|| "no monitor for pet window".to_string())?;

    let mon_pos = monitor.position();
    let mon_size = monitor.size();
    let margin = 16_i32;

    let seed = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0) as u32;
    let corner = seed % 4;

    let x = match corner {
        0 | 2 => mon_pos.x + margin,
        _ => mon_pos.x + mon_size.width as i32 - size.width as i32 - margin,
    };
    let y = match corner {
        0 | 1 => mon_pos.y + margin,
        _ => mon_pos.y + mon_size.height as i32 - size.height as i32 - margin,
    };

    pet.set_position(tauri::PhysicalPosition::new(x, y))
        .map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
fn pet_wander_random(app: AppHandle) -> Result<(), String> {
    let pet = app
        .get_webview_window("pet")
        .ok_or_else(|| "pet window not found".to_string())?;

    let size = pet.outer_size().map_err(|err| err.to_string())?;
    let monitor = pet
        .current_monitor()
        .map_err(|err| err.to_string())?
        .ok_or_else(|| "no monitor for pet window".to_string())?;

    let mon_pos = monitor.position();
    let mon_size = monitor.size();
    let margin = 24_i32;

    let min_x = mon_pos.x + margin;
    let min_y = mon_pos.y + margin;
    let max_x = mon_pos.x + mon_size.width as i32 - size.width as i32 - margin;
    let max_y = mon_pos.y + mon_size.height as i32 - size.height as i32 - margin;

    let seed = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);

    let span_x = (max_x - min_x).max(0) as u128 + 1;
    let span_y = (max_y - min_y).max(0) as u128 + 1;
    let x = min_x + (seed % span_x) as i32;
    let y = min_y + ((seed >> 32) % span_y) as i32;

    pet.set_position(tauri::PhysicalPosition::new(x, y))
        .map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
fn pet_restore_position(app: AppHandle, state: State<'_, PetFleeState>) -> Result<(), String> {
    let pet = app
        .get_webview_window("pet")
        .ok_or_else(|| "pet window not found".to_string())?;

    let saved = state
        .0
        .lock()
        .map_err(|err| err.to_string())?
        .take();

    if let Some((x, y)) = saved {
        pet.set_position(tauri::PhysicalPosition::new(x, y))
            .map_err(|err| err.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn set_pet_gif(app: AppHandle, gif_path: String) -> Result<(), String> {
    let trimmed = gif_path.trim();
    if trimmed.is_empty() {
        return Err("gif_path cannot be empty".to_string());
    }
    app.emit("pet-gif-changed", trimmed.to_string())
        .map_err(|err| format!("failed to emit pet-gif-changed: {err}"))?;
    Ok(())
}

#[tauri::command]
fn launch_exe_path(exe_path: String) -> Result<(), String> {
    let trimmed = exe_path.trim().trim_matches('"');
    if trimmed.is_empty() {
        return Err("exe_path cannot be empty".to_string());
    }

    let path = Path::new(trimmed);
    if !path.exists() {
        return Err(format!("exe not found: {trimmed}"));
    }
    if !path.is_file() {
        return Err(format!("path is not a file: {trimmed}"));
    }
    if path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| !ext.eq_ignore_ascii_case("exe"))
        .unwrap_or(true)
    {
        return Err("only .exe files can be launched here".to_string());
    }

    Command::new(path).spawn().map_err(|err| err.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            app.manage(PetFleeState(Mutex::new(None)));

            let quit_item = MenuItem::with_id(app, "quit", "退出桌宠", true, None::<&str>)?;
            let toggle_item =
                MenuItem::with_id(app, "toggle", "显示/隐藏主界面", true, None::<&str>)?;
            let toggle_pet_item =
                MenuItem::with_id(app, "toggle_pet", "显示/隐藏悬浮宠物", true, None::<&str>)?;
            let stop_item =
                MenuItem::with_id(app, "stop", "紧急停止任务", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[&toggle_item, &toggle_pet_item, &stop_item, &quit_item],
            )?;

            TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "quit" => std::process::exit(0),
                    "toggle" => {
                        if let Err(err) = toggle_main_window(app) {
                            eprintln!("{err}");
                        }
                    }
                    "toggle_pet" => {
                        if let Err(err) = toggle_pet_window(app) {
                            eprintln!("{err}");
                        }
                    }
                    "stop" => {
                        if let Err(err) = app.emit("emergency-stop", ()) {
                            eprintln!("failed to emit emergency event: {err}");
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Err(err) = toggle_main_window(&tray.app_handle()) {
                            eprintln!("{err}");
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            emergency_stop,
            show_main_window,
            set_pet_size,
            set_pet_window_size,
            toggle_float_pet,
            pet_flee_to_corner,
            pet_wander_random,
            pet_restore_position,
            set_pet_gif,
            launch_exe_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
