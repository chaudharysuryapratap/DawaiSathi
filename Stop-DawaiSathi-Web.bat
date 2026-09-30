@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Stop-DawaiSathi-Web.ps1"
if errorlevel 1 (
  echo.
  echo DawaiSathi Web shutdown encountered an error. Review the message above.
  exit /b 1
)
