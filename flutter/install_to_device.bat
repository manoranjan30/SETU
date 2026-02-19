@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title SETU Mobile App - Device Installation Tool

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║     SETU Mobile App - Device Installation Tool               ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:: Set Flutter path
set FLUTTER_PATH=C:\flutter\flutter\bin
set ADB_PATH=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe

:: Check if ADB exists
if not exist "%ADB_PATH%" (
    echo [ERROR] ADB not found at: %ADB_PATH%
    echo.
    echo Please install Android SDK Platform Tools.
    echo You can download from: https://developer.android.com/studio/releases/platform-tools
    echo.
    pause
    exit /b 1
)

echo [STEP 1] Finding System IP Addresses...
echo ════════════════════════════════════════════════════════════════
echo.

:: Get all IP addresses
ipconfig | findstr /i "IPv4"
echo.

echo Your System IP Addresses:
echo   - 192.168.56.1    (Virtual/Hyper-V adapter)
echo   - 192.168.0.101   (Main WiFi/Ethernet - USE THIS)
echo   - 172.29.128.1    (WSL/Docker adapter)
echo   - 172.29.240.1    (WSL/Docker adapter)
echo.

echo ┌──────────────────────────────────────────────────────────────┐
echo │  YOUR MAIN IP: 192.168.0.101 (WiFi/Ethernet)                │
echo └──────────────────────────────────────────────────────────────┘
echo.
echo Use this IP in the app to connect to your backend.
echo Backend URL should be: http://192.168.0.101:3000
echo.

echo [STEP 2] Checking for Connected Android Devices...
echo ════════════════════════════════════════════════════════════════
echo.

:: List connected devices
"%ADB_PATH%" devices -l
echo.

:: Check if any device connected - use devices command with timeout
set "DEVICE_FOUND=0"
for /f "tokens=*" %%d in ('"%ADB_PATH%" devices 2^>nul ^| findstr /i "device$"') do set "DEVICE_FOUND=1"
if "!DEVICE_FOUND!"=="0" (
    echo [WARNING] No devices connected via ADB.
    echo.
    echo Options to connect your device:
    echo.
    echo 1. USB Connection:
    echo    - Enable USB Debugging on your phone
    echo    - Connect via USB cable
    echo    - Accept the debugging prompt on your phone
    echo.
    echo 2. Wireless Connection:
    echo    - Enable Wireless Debugging on your phone
    echo    - Make sure phone and PC are on same WiFi network
    echo    - Note the IP:Port shown on your phone
    echo.
    echo Do you want to connect wirelessly? (Y/N)
    set /p CONNECT_WIRELESS=
    
    if /i "!CONNECT_WIRELESS!"=="Y" (
        echo.
        echo Enter your phone's IP address (from Wireless Debugging):
        set /p PHONE_IP=
        echo Enter the port number (from Wireless Debugging):
        set /p PHONE_PORT=
        
        echo.
        echo Connecting to !PHONE_IP!:!PHONE_PORT!...
        "%ADB_PATH%" connect !PHONE_IP!:!PHONE_PORT!
        echo.
        
        :: Recheck devices
        "%ADB_PATH%" devices -l
    ) else (
        echo.
        echo Please connect your device and run this script again.
        pause
        exit /b 0
    )
)

echo.
echo [STEP 3] Getting Device Information...
echo ════════════════════════════════════════════════════════════════
echo.

:: Get device model
for /f "tokens=*" %%m in ('"%ADB_PATH%" shell getprop ro.product.model 2^>nul') do set DEVICE_MODEL=%%m
echo Device Model: !DEVICE_MODEL!

:: Get Android version
for /f "tokens=*" %%v in ('"%ADB_PATH%" shell getprop ro.build.version.release 2^>nul') do set ANDROID_VER=%%v
echo Android Version: !ANDROID_VER!

echo.
echo [STEP 4] Checking APK File...
echo ════════════════════════════════════════════════════════════════
echo.

set APK_PATH=flutter\build\app\outputs\flutter-apk\app-debug.apk

if not exist "%APK_PATH%" (
    echo [ERROR] APK not found at: %APK_PATH%
    echo.
    echo Please build the APK first by running build_android.bat
    pause
    exit /b 1
)

echo APK found: %APK_PATH%

echo.
echo [STEP 5] Installing APK to Device...
echo ════════════════════════════════════════════════════════════════
echo.

echo Installing... Please accept the installation on your phone if prompted.
echo.

"%ADB_PATH%" install -r "%APK_PATH%"

if %ERRORLEVEL%==0 (
    echo.
    echo ╔══════════════════════════════════════════════════════════════╗
    echo ║              INSTALLATION SUCCESSFUL!                        ║
    echo ╚══════════════════════════════════════════════════════════════╝
    echo.
    echo The SETU app has been installed on your device.
    echo.
    echo IMPORTANT: Before using the app, update the backend URL:
    echo.
    echo   Backend URL: http://192.168.0.101:3000
    echo.
    echo Make sure:
    echo   1. Your backend server is running on port 3000
    echo   2. Your phone and PC are on the same WiFi network
    echo   3. Windows Firewall allows connections on port 3000
    echo.
) else (
    echo.
    echo [ERROR] Installation failed!
    echo.
    echo Possible reasons:
    echo   - Device not authorized (check phone for prompt)
    echo   - Insufficient storage on device
    echo   - APK signature issues
    echo   - App already installed with different signature
    echo.
    echo Try uninstalling the existing app first:
    echo   adb uninstall com.example.setu_mobile
    echo.
)

echo ════════════════════════════════════════════════════════════════
echo.
echo Press any key to exit...
pause >nul
