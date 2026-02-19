@echo off
echo ============================================
echo   SETU Flutter - Clean Build
echo ============================================
echo.

REM Set Flutter path
set "FLUTTER_PATH=C:\flutter\flutter\bin"
set "PATH=%PATH%;%FLUTTER_PATH%"

REM Change to flutter directory
cd /d "%~dp0"

echo [Step 1] Stopping Gradle daemon...
cd android
call gradlew --stop 2>nul
cd ..

echo.
echo [Step 2] Deleting build directories...
rmdir /S /Q build 2>nul
rmdir /S /Q .dart_tool 2>nul
rmdir /S /Q android\.gradle 2>nul
rmdir /S /Q android\build 2>nul
rmdir /S /Q android\app\build 2>nul

echo.
echo [Step 3] Getting dependencies...
call "%FLUTTER_PATH%\flutter.bat" pub get

echo.
echo [Step 4] Running code generation...
call "%FLUTTER_PATH%\dart.bat" run build_runner build --delete-conflicting-outputs

echo.
echo [Step 5] Building Android APK...
call "%FLUTTER_PATH%\flutter.bat" build apk --debug

if errorlevel 1 (
    echo.
    echo ============================================
    echo   BUILD FAILED
    echo ============================================
    echo.
    echo Try closing all VS Code, Android Studio, 
    echo and any Java processes, then run this again.
    echo.
) else (
    echo.
    echo ============================================
    echo   BUILD SUCCESSFUL!
    echo ============================================
    echo.
    echo APK Location:
    echo %CD%\build\app\outputs\flutter-apk\app-release.apk
    echo.
)

echo.
echo Press any key to exit...
pause >nul
