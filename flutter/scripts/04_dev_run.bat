@echo off
:: ============================================================
:: SETU Mobile App - Development Run Script
:: ============================================================
:: Runs the app in debug mode with hot reload for development
:: ============================================================

cd /d "%~dp0"

:: Setup Flutter path if not in PATH
flutter --version >nul 2>&1
if errorlevel 1 (
    if exist "C:\flutter\flutter\bin\flutter.bat" (
        set "PATH=%PATH%;C:\flutter\flutter\bin"
    )
)

echo.
echo ========================================================
echo        SETU Mobile App - Development Mode
echo ========================================================
echo.
echo This will run the app with hot reload enabled.
echo.
echo Controls:
echo   r - Hot reload
echo   R - Hot restart
echo   h - List available commands
echo   q - Quit
echo.
echo ========================================================
echo.

:: Check for connected devices
echo Checking for connected devices...
flutter devices
echo.

:: Get device selection
set /p DEVICE="Enter device ID (or press Enter for first available): "

if "%DEVICE%"=="" (
    echo Starting app on first available device...
    flutter run
) else (
    echo Starting app on device: %DEVICE%
    flutter run -d %DEVICE%
)

pause
