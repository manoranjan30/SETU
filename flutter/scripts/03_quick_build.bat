@echo off
:: ============================================================
:: SETU Mobile App - Quick Build Script
:: ============================================================
:: Quick build for development - builds debug APK fast
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
echo [SETU] Quick Build - Debug APK
echo ================================
echo.

:: Quick dependency check
flutter pub get >nul 2>&1

:: Build debug APK
flutter build apk --debug

if errorlevel 1 (
    echo.
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo.
echo [OK] Build successful!
echo.
echo APK: %CD%\build\app\outputs\flutter-apk\app-debug.apk
echo.

:: Ask to install
set /p INSTALL="Install on connected device? (Y/N): "
if /i "%INSTALL%"=="Y" (
    echo Installing...
    adb install -r build\app\outputs\flutter-apk\app-debug.apk
    echo [OK] Installed!
)

pause
