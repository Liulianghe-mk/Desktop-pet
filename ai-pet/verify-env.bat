@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ===== AI Pet 环境检测 =====
echo.

where node >nul 2>&1
if errorlevel 1 (echo [X] Node.js 未找到) else (echo [OK] Node.js & node -v)
where python >nul 2>&1
if errorlevel 1 (echo [X] Python 未找到) else (echo [OK] Python & python --version)
where npm.cmd >nul 2>&1
if errorlevel 1 (echo [X] npm 未找到) else (echo [OK] npm)

if exist "%USERPROFILE%\.cargo\bin\rustc.exe" (
  echo [OK] Rust
  "%USERPROFILE%\.cargo\bin\rustc.exe" --version
  "%USERPROFILE%\.cargo\bin\cargo.exe" --version
) else (
  echo [X] Rust 未完成安装 — 请运行 rustup-init 并选 1，装完后重启终端
)

echo.
echo Agent 测试:
curl -s http://127.0.0.1:8765/status 2>nul
if errorlevel 1 echo [提示] Agent 未运行，请先双击 start-agent.bat
echo.
pause
