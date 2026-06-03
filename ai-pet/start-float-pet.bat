@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "%USERPROFILE%\.cargo\bin\rustc.exe" (
  echo [错误] 未检测到 Rust，请先安装 Rust。
  pause
  exit /b 1
)
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
echo [AI Pet] 启动桌面端（含悬浮 GIF 宠物）...
echo 提示：会同时出现主界面 + 右下角悬浮宠物窗口
call npm.cmd run tauri dev
pause
