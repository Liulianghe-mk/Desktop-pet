@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [1/2] npm install ...
call npm.cmd install
echo.
echo [2/2] python deps ...
python -m pip install -r backend\requirements.txt
echo.
echo Done. Double-click start-agent.bat then start-desktop.bat (or start-web.bat).
pause
