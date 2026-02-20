@echo off
:: ============================================================
:: SETU Mobile App - Emulator Run Script
:: ============================================================
:: Automatically finds Flutter, launches emulator, and runs app
:: ============================================================

cd /d "%~dp0"

echo.
echo ========================================================
echo     SETU Mobile - Emulator Launcher
echo ========================================================
echo.

:: ============================================================================
:: FIND FLUTTER SDK
:: ============================================================================
set FLUTTER_FOUND=0
set FLUTTER_PATH=

:: Check common installation paths
if exist "C:\flutter\flutter\bin\flutter.bat" (
    set "FLUTTER_PATH=C:\flutter\flutter\bin"
    set FLUTTER_FOUND=1
)
if exist "C:\flutter\bin\flutter.bat" (
    set "FLUTTER_PATH=C:\flutter\bin"
    set FLUTTER_FOUND=1
)
if exist "C:\src\flutter\bin\flutter.bat" (
    set "FLUTTER_PATH=C:\src\flutter\bin"
    set FLUTTER_FOUND=1
)
if exist "%LOCALAPPDATA%\flutter\bin\flutter.bat" (
    set "FLUTTER_PATH=%LOCALAPPDATA%\flutter\bin"
    set FLUTTER_FOUND=1
)
if exist "D:\flutter\bin\flutter.bat" (
    set "FLUTTER_PATH=D:\flutter\bin"
    set FLUTTER_FOUND=1
)

:: If Flutter not found, ask user
if %FLUTTER_FOUND%==0 (
    echo Flutter SDK not found in common locations.
    echo.
    set /p FLUTTER_PATH="Enter Flutter bin folder path (e.g., C:\flutter\bin): "
    if exist "%FLUTTER_PATH%\flutter.bat" (
        set FLUTTER_FOUND=1
    ) else (
        echo.
        echo ERROR: Flutter not found at that location!
        echo Please install Flutter from: https://flutter.dev/docs/get-started/install
        echo.
        pause
        exit /b 1
    )
)

echo Using Flutter from: %FLUTTER_PATH%
echo.

:: Add to PATH for this session
set "PATH=%FLUTTER_PATH%;%PATH%"

:: ============================================================================
:: CHECK ANDROID SDK
:: ============================================================================
echo Checking Android SDK...
if exist "%ANDROID_HOME%\platform-tools\adb.exe" (
    echo Android SDK found: %ANDROID_HOME%
) else if exist "%ANDROID_SDK_ROOT%\platform-tools\adb.exe" (
    echo Android SDK found: %ANDROID_SDK_ROOT%
) else (
    echo WARNING: Android SDK not found. Emulator may not work.
    echo Please install Android Studio from: https://developer.android.com/studio
)

:: ============================================================================
:: CHECK FOR DEVICES
:: ============================================================================
echo.
echo ========================================================
echo Checking for available devices...
echo ========================================================
echo.

flutter devices

if errorlevel 1 (
    echo.
    echo ERROR: Could not run flutter devices command.
    echo Please check Flutter installation.
    pause
    exit /b 1
)

:: ============================================================================
:: LAUNCH EMULATOR IF NO DEVICE
:: ============================================================================
echo.
echo ========================================================
echo Options:
echo ========================================================
echo   1 - Run on connected device/emulator
echo   2 - Launch Android Emulator (if installed)
echo   3 - Show devices and let me choose
echo   4 - Exit
echo.

set /p CHOICE="Enter choice (1-4): "

if "%CHOICE%"=="1" (
    echo.
    echo Starting app on first available device...
    flutter run
    goto :end
)

if "%CHOICE%"=="2" (
    echo.
    echo Launching Android Emulator...
    echo Note: Make sure Android Studio is installed with AVD Manager.
    echo.
    
    :: Try to launch emulator
    if exist "%ANDROID_HOME%\emulator\emulator.bat" (
        start "Android Emulator" cmd /c "%ANDROID_HOME%\emulator\emulator.bat -avd"
    ) else if exist "%LOCALAPPDATA%\Android\Sdk\emulator\emulator.bat" (
        start "Android Emulator" cmd /c "%LOCALAPPDATA%\Android\Sdk\emulator\emulator.bat -avd"
    ) else (
        echo.
        echo Emulator executable not found.
        echo Please open Android Studio and launch emulator from AVD Manager.
        echo.
        echo Then run this script again and select option 1.
        pause
        goto :end
    )
    
    echo.
    echo Waiting 15 seconds for emulator to start...
    timeout /t 15 /nobreak >nul
    
    echo.
    echo Checking for emulator...
    flutter devices
    
    set /p RUN_NOW="Run app now on emulator? (Y/N): "
    if /i "%RUN_NOW%"=="Y" (
        flutter run
    )
    goto :end
)

if "%CHOICE%"=="3" (
    echo.
    flutter devices
    set /p DEVICE_ID="Enter device ID to use: "
    if not "%DEVICE_ID%"=="" (
        flutter run -d %DEVICE_ID%
    )
    goto :end
)

echo Exiting...
exit /b 0

:end
echo.
echo ========================================================
echo Done!
echo ========================================================
pause
