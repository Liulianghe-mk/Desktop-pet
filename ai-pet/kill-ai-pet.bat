@echo off
setlocal
set FOUND=0
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq ai-pet.exe" /NH 2^>nul ^| findstr /i "ai-pet.exe"') do (
  set FOUND=1
  echo Killing ai-pet.exe PID=%%a
  taskkill /F /PID %%a >nul 2>&1
)
if "%FOUND%"=="0" echo ai-pet.exe is not running
timeout /t 1 /nobreak >nul 2>&1
endlocal
