@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=8765

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr LISTENING') do (
  echo [AI Pet] Agent 已在运行: http://127.0.0.1:%PORT% ^(PID=%%a^)
  echo.
  echo 无需重复启动。若要加载新的 .env 配置，请双击 restart-agent.bat
  echo 或先运行 kill-port-8765.bat 再重新启动本脚本。
  pause
  exit /b 0
)

echo [AI Pet] Starting local Agent on http://127.0.0.1:%PORT% ...
python backend\main.py
if errorlevel 1 (
  echo.
  echo [AI Pet] 启动失败。
  echo - 若提示端口占用: 运行 restart-agent.bat 或 kill-port-8765.bat
  echo - 若提示模块缺失: python -m pip install -r backend\requirements.txt
  pause
)
