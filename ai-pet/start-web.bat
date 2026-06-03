@echo off
chcp 65001 >nul
cd /d "%~dp0"
call "%~dp0kill-port-1420.bat"
echo [AI Pet] Starting web UI (browser preview) ...
call npm.cmd run dev
pause
