@echo off
chcp 65001 >nul
title Show IP Addresses

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║              System IP Address Finder                        ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

echo Your System IP Addresses:
echo ════════════════════════════════════════════════════════════════
echo.

ipconfig | findstr /i "IPv4"

echo.
echo ════════════════════════════════════════════════════════════════
echo.

:: Get the main IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set SYS_IP=%%a
    set SYS_IP=!SYS_IP: =!
)

echo.
echo ┌──────────────────────────────────────────────────────────────┐
echo │  YOUR SYSTEM IP: !SYS_IP!
echo └──────────────────────────────────────────────────────────────┘
echo.
echo For the SETU mobile app, use this backend URL:
echo.
echo   http://!SYS_IP!:3000
echo.
echo Make sure:
echo   1. Your phone and PC are on the SAME WiFi network
echo   2. Your backend server is running on port 3000
echo   3. Windows Firewall allows port 3000
echo.

:: Check ADB devices too
set ADB_PATH=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe
if exist "%ADB_PATH%" (
    echo.
    echo Connected Android Devices:
    echo ════════════════════════════════════════════════════════════════
    "%ADB_PATH%" devices -l 2>nul
    echo.
)

pause
