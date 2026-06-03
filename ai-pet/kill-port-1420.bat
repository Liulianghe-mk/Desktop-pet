@echo off
setlocal enabledelayedexpansion
set PORT=1420
set FOUND=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr LISTENING') do (
  set FOUND=1
  echo Killing process on port %PORT% PID=%%a
  taskkill /F /PID %%a >nul 2>&1
)
if "!FOUND!"=="0" echo Port %PORT% is free
endlocal
