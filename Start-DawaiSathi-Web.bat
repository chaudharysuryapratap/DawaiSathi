@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-DawaiSathi-Web.ps1"
if errorlevel 1 (
  echo.
  echo DawaiSathi Web startup failed. Check the error above and logs under %LOCALAPPDATA%\DawaiSathi\logs.
  exit /b 1
)
