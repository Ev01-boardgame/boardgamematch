@echo off
cd /d "%~dp0"
echo Resetting Ev01 to main...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0reset-ev01-to-main.ps1"
echo.
echo Press any key to close...
pause >nul
