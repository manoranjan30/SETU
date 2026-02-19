@echo off
setlocal enabledelayedexpansion

echo ============================================
echo   SETU Flutter App - Android APK Build
echo ============================================
echo.

REM Change to flutter directory
cd /d "%~dp0"

REM Set Flutter path
set "FLUTTER_PATH=C:\flutter\flutter\bin"
set "PATH=%PATH%;%FLUTTER_PATH%"

echo [Step 1] Accepting Android Licenses...
echo Please press 'y' and Enter for each license prompt.
echo.
call "%FLUTTER_PATH%\flutter.bat" doctor --android-licenses

echo.
echo [Step 2] Getting Dependencies...
echo.
call "%FLUTTER_PATH%\flutter.bat" pub get
if errorlevel 1 (
    echo ERROR: Failed to get dependencies
    pause
    exit /b 1
)

echo.
echo [Step 3] Running Code Generation (Drift Database)...
echo.
call "%FLUTTER_PATH%\dart.bat" run build_runner build --delete-conflicting-outputs
if errorlevel 1 (
    echo WARNING: Code generation had issues, continuing...
)

echo.
echo [Step 4] Building Android APK (Release)...
echo This may take a few minutes...
echo.
call "%FLUTTER_PATH%\flutter.bat" build apk --release

if errorlevel 1 (
    echo.
    echo ============================================
    echo   BUILD FAILED
    echo ============================================
    echo Check the errors above.
) else (
    echo.
    echo ============================================
    echo   BUILD SUCCESSFUL!
    echo ============================================
    echo.
    echo APK Location:
    echo %CD%\build\app\outputs\flutter-apk\app-release.apk
    echo.
    echo Copy this APK to your phone and install it.
    echo You may need to enable "Install from unknown sources" on your phone.
    echo.
)

echo.
echo Press any key to exit...
pause >nul
