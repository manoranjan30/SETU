@echo off
echo ============================================
echo   SETU Flutter App - Configure and Build
echo ============================================
echo.

REM Set Flutter path for this session
set FLUTTER_PATH=C:\flutter\flutter\bin
set PATH=%PATH%;%FLUTTER_PATH%

echo [Step 1] Checking Flutter installation...
echo.

"%FLUTTER_PATH%\flutter.bat" --version
if errorlevel 1 (
    echo.
    echo ERROR: Flutter not found at %FLUTTER_PATH%
    echo Please check if Flutter is installed correctly.
    pause
    exit /b 1
)

echo.
echo [Step 2] Running Flutter doctor...
echo.
"%FLUTTER_PATH%\flutter.bat" doctor

echo.
echo ============================================
echo   What would you like to do?
echo ============================================
echo.
echo   1. Build Windows Desktop App
echo   2. Build Android APK (requires Android Studio)
echo   3. Run in Debug Mode (Windows)
echo   4. Exit
echo.
set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" goto build_windows
if "%choice%"=="2" goto build_android
if "%choice%"=="3" goto run_debug
if "%choice%"=="4" goto end

:build_windows
echo.
echo [Building Windows App...]
echo Note: Windows Developer Mode must be enabled.
echo.
"%FLUTTER_PATH%\flutter.bat" build windows --release
if errorlevel 1 (
    echo.
    echo Build failed. Check the errors above.
    echo Make sure Windows Developer Mode is enabled.
    echo Run: start ms-settings:developers
) else (
    echo.
    echo ============================================
    echo   BUILD SUCCESSFUL!
    echo ============================================
    echo.
    echo The app is located at:
    echo %CD%\build\windows\x64\runner\Release\setu_mobile.exe
    echo.
)
goto end

:build_android
echo.
echo [Building Android APK...]
echo Note: This requires Android Studio to be installed.
echo.
"%FLUTTER_PATH%\flutter.bat" build apk --release
if errorlevel 1 (
    echo.
    echo Build failed. Check the errors above.
    echo Make sure Android Studio and SDK are installed.
) else (
    echo.
    echo ============================================
    echo   BUILD SUCCESSFUL!
    echo ============================================
    echo.
    echo The APK is located at:
    echo %CD%\build\app\outputs\flutter-apk\app-release.apk
    echo.
)
goto end

:run_debug
echo.
echo [Running in Debug Mode...]
echo Press 'q' in the terminal to quit.
echo.
"%FLUTTER_PATH%\flutter.bat" run -d windows
goto end

:end
echo.
pause
