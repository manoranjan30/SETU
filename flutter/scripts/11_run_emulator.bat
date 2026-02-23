@echo off
:: ============================================================
:: SETU Mobile App - Emulator Run Script
:: ============================================================
:: Automatically finds Flutter, launches emulator, and runs app
:: ============================================================

setlocal enabledelayedexpansion

echo.
echo ========================================================
echo     SETU Mobile - Emulator Launcher
echo ========================================================
echo.

:: Get the script directory and project root
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%..\.."
set "FLUTTER_DIR=%PROJECT_ROOT%\flutter"

echo Project Root: %PROJECT_ROOT%
echo Flutter Dir: %FLUTTER_DIR%
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
:: FIND ADB
:: ============================================================================
echo Finding ADB...
set ADB_PATH=
if exist "%ANDROID_HOME%\platform-tools\adb.exe" (
    set "ADB_PATH=%ANDROID_HOME%\platform-tools\adb.exe"
) else if exist "%ANDROID_SDK_ROOT%\platform-tools\adb.exe" (
    set "ADB_PATH=%ANDROID_SDK_ROOT%\platform-tools\adb.exe"
) else if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" (
    set "ADB_PATH=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
) else if exist "C:\Users\omano\adb-fastboot\platform-tools\adb.exe" (
    set "ADB_PATH=C:\Users\omano\adb-fastboot\platform-tools\adb.exe"
)

if "%ADB_PATH%"=="" (
    echo ERROR: ADB not found. Please install Android SDK Platform Tools.
    pause
    exit /b 1
)

echo Using ADB: %ADB_PATH%
echo.

:: ============================================================================
:: CHECK FOR APK
:: ============================================================================
set "APK_PATH=%FLUTTER_DIR%\build\app\outputs\flutter-apk\app-debug.apk"
echo Looking for APK at: %APK_PATH%

if exist "%APK_PATH%" (
    echo APK found!
) else (
    echo WARNING: APK not found. Will need to build with Flutter.
)
echo.

:: ============================================================================
:: CHECK FOR DEVICES
:: ============================================================================
echo ========================================================
echo Checking for available devices...
echo ========================================================
echo.

"%ADB_PATH%" devices

:: Check if emulator is already running
"%ADB_PATH%" devices | findstr /C:"emulator" | findstr /C:"device" >nul
if %errorlevel%==0 goto emulator_found

:: Check for physical device
"%ADB_PATH%" devices | findstr /V "List" | findstr /V "emulator" | findstr "device" >nul
if %errorlevel%==0 goto device_found

:: No device found, launch emulator
goto launch_emulator

:: ============================================================================
:: EMULATOR FOUND - INSTALL AND RUN
:: ============================================================================
:emulator_found
echo.
echo ========================================================
echo Emulator detected! Checking if fully booted...
echo ========================================================
echo.

:: Wait for boot completion
set BOOT_WAIT=0
:wait_boot_existing
set /a BOOT_WAIT+=1
"%ADB_PATH%" shell getprop sys.boot_completed 2>nul | findstr "1" >nul
if %errorlevel%==0 goto install_apk_existing

if %BOOT_WAIT% GEQ 30 (
    echo Emulator taking too long to boot. Please wait and try again.
    pause
    goto end
)

echo Waiting for emulator to fully boot... (%BOOT_WAIT%)
ping -n 3 127.0.0.1 >nul
goto wait_boot_existing

:install_apk_existing
echo Emulator is ready!
echo.
if exist "%APK_PATH%" (
    echo [STEP 1/2] Installing APK to emulator...
    echo APK: %APK_PATH%
    "%ADB_PATH%" install -r "%APK_PATH%"
    if !errorlevel!==0 (
        echo APK installed successfully!
    ) else (
        echo APK installation failed!
    )
    echo.
    echo [STEP 2/2] Launching SETU Mobile app...
    "%ADB_PATH%" shell am start -n com.example.setu_mobile/.MainActivity
    echo App launched!
) else (
    echo APK not found. Building with Flutter...
    cd /d "%FLUTTER_DIR%"
    flutter run -d emulator-5554
)
goto end

:: ============================================================================
:: DEVICE FOUND - INSTALL AND RUN
:: ============================================================================
:device_found
echo.
echo ========================================================
echo Physical device detected! Installing and launching app...
echo ========================================================
echo.

if exist "%APK_PATH%" (
    echo [STEP 1/2] Installing APK to device...
    "%ADB_PATH%" install -r "%APK_PATH%"
    echo.
    echo [STEP 2/2] Launching SETU Mobile app...
    "%ADB_PATH%" shell am start -n com.example.setu_mobile/.MainActivity
) else (
    cd /d "%FLUTTER_DIR%"
    flutter run
)
goto end

:: ============================================================================
:: LAUNCH EMULATOR
:: ============================================================================
:launch_emulator
echo.
echo ========================================================
echo No device found. Attempting to launch emulator...
echo ========================================================
echo.

if not exist "%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe" (
    echo Android Emulator not found!
    echo Please open Android Studio and start an emulator manually.
    pause
    goto end
)

echo [STEP 1/3] Launching Android Emulator...
echo AVD: Medium_Phone_API_36.1
echo.

:: Launch emulator in new window
start "Android Emulator" "%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe" -avd Medium_Phone_API_36.1 -no-snapshot-load

echo [STEP 2/3] Waiting for emulator to boot...
echo.

:: Wait for emulator to appear in devices list
set WAIT_COUNT=0
:wait_for_device
set /a WAIT_COUNT+=1
echo Waiting for emulator device... (attempt %WAIT_COUNT%)
"%ADB_PATH%" devices | findstr /C:"emulator" | findstr /C:"device" >nul
if %errorlevel%==0 goto wait_for_boot

if %WAIT_COUNT% GEQ 30 (
    echo Emulator is taking too long. Please check the Android Emulator window.
    pause
    goto end
)

ping -n 3 127.0.0.1 >nul
goto wait_for_device

:: Wait for boot completion
:wait_for_boot
echo.
echo Emulator device found! Waiting for Android to fully boot...
echo.

set BOOT_COUNT=0
:check_boot_complete
set /a BOOT_COUNT+=1
"%ADB_PATH%" shell getprop sys.boot_completed 2>nul | findstr "1" >nul
if %errorlevel%==0 goto emulator_ready

if %BOOT_COUNT% GEQ 60 (
    echo Emulator is taking too long to boot. Please check the Android Emulator window.
    pause
    goto end
)

echo Booting... (%BOOT_COUNT%)
ping -n 3 127.0.0.1 >nul
goto check_boot_complete

:emulator_ready
echo.
echo ========================================================
echo Emulator is fully booted and ready!
echo ========================================================
echo.

if exist "%APK_PATH%" (
    echo [STEP 3/3] Installing APK and launching app...
    echo.
    echo Installing: %APK_PATH%
    "%ADB_PATH%" install -r "%APK_PATH%"
    if !errorlevel!==0 (
        echo.
        echo APK installed successfully!
        echo.
        echo Launching SETU Mobile app...
        "%ADB_PATH%" shell am start -n com.example.setu_mobile/.MainActivity
        echo.
        echo App launched! Check the emulator window.
    ) else (
        echo.
        echo APK installation failed. Try running manually.
    )
) else (
    echo APK not found. Running with Flutter...
    cd /d "%FLUTTER_DIR%"
    flutter run
)
goto end

:: ============================================================================
:: END
:: ============================================================================
:end
echo.
echo ========================================================
echo Done!
echo ========================================================
echo.
echo The SETU Mobile app should now be running on the emulator.
echo If you don't see it, check the emulator window.
echo.
pause
