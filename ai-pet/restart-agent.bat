@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [AI Pet] 正在重启 Agent...
call "%~dp0kill-port-8765.bat" nopause
echo.
start "AI Pet Agent" cmd /k "%~dp0start-agent.bat"
