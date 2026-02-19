@echo off
chcp 65001 >nul
title SETU Mobile App - Real-Time Log Viewer

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║     SETU Mobile App - Real-Time Log Viewer                   ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

set ADB_PATH=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe

:: Check if ADB exists
if not exist "%ADB_PATH%" (
    echo [ERROR] ADB not found at: %ADB_PATH%
    echo.
    pause
    exit /b 1
)

:: Check for connected devices
"%ADB_PATH%" get-state >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] No device connected. Please connect your device first.
    echo.
    pause
    exit /b 1
)

echo Device connected. Starting real-time log viewer...
echo.
echo ════════════════════════════════════════════════════════════════
echo   FILTERING OPTIONS:
echo   - All Flutter logs: flutter
echo   - API calls only: API
echo   - Errors only: ERROR
echo   - Auth logs: AUTH
echo   - Database logs: DB
echo   - User actions: USER
echo   - Sync logs: SYNC
echo ════════════════════════════════════════════════════════════════
echo.

set /p FILTER="Enter filter (or press Enter for all Flutter logs): "

if "%FILTER%"=="" set FILTER=flutter

echo.
echo Starting logcat with filter: %FILTER%
echo Press Ctrl+C to stop...
echo.
echo ════════════════════════════════════════════════════════════════
echo.

:: Clear previous logs and start fresh
"%ADB_PATH%" logcat -c

:: Stream logs with filter
"%ADB_PATH%" logcat -v time *:S flutter:V | findstr /i "%FILTER%"

pause
