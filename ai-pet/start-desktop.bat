@echo off
setlocal
cd /d "%~dp0"

if not exist "%USERPROFILE%\.cargo\bin\rustc.exe" (
  echo [ERROR] Rust not found.
  echo Install Rust first: https://www.rust-lang.org/tools/install
  echo Then reopen terminal and run this script again.
  pause
  exit /b 1
)

set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
call "%~dp0kill-ai-pet.bat"
call "%~dp0kill-port-1420.bat"

echo [AI Pet] Starting Tauri desktop app...
call npm.cmd run tauri dev
set "EXITCODE=%ERRORLEVEL%"

if not "%EXITCODE%"=="0" (
  echo.
  echo Desktop failed with exit code %EXITCODE%.
  echo If you see "failed to remove file ... ai-pet.exe" / access denied:
  echo   1. Close any Yarni / ai-pet windows and tray icon
  echo   2. Run kill-ai-pet.bat then start-desktop.bat again
  echo   3. Or open Task Manager and end ai-pet.exe
  echo Try: start-web.bat
  pause
)

endlocal
