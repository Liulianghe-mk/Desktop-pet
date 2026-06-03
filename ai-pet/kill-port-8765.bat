@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
set PORT=8765
set FOUND=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr LISTENING') do (
  set FOUND=1
  echo [AI Pet] 结束占用端口 %PORT% 的进程 PID=%%a
  taskkill /F /PID %%a >nul 2>&1
)
if "!FOUND!"=="0" (
  echo [AI Pet] 端口 %PORT% 未被占用
) else (
  echo [AI Pet] 已释放端口 %PORT%
)
endlocal
if /i not "%~1"=="nopause" pause
