@echo off
:: This script must be run as Administrator
:: Right-click and select "Run as administrator"

title SETU - Configure Windows Firewall

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║     SETU - Windows Firewall Configuration                    ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:: Check for admin privileges
net session >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] This script requires Administrator privileges.
    echo.
    echo Please right-click this file and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo [STEP 1] Adding Firewall Rule for Port 3000 (Backend API)...
echo ════════════════════════════════════════════════════════════════
echo.

:: Add inbound rule for port 3000
netsh advfirewall firewall add rule name="SETU Backend Port 3000" dir=in action=allow protocol=tcp localport=3000

if %ERRORLEVEL%==0 (
    echo [SUCCESS] Inbound rule added for port 3000
) else (
    echo [WARNING] Inbound rule may already exist or failed to add
)

:: Add outbound rule for port 3000
netsh advfirewall firewall add rule name="SETU Backend Port 3000 Outbound" dir=out action=allow protocol=tcp localport=3000

if %ERRORLEVEL%==0 (
    echo [SUCCESS] Outbound rule added for port 3000
) else (
    echo [WARNING] Outbound rule may already exist or failed to add
)

echo.
echo [STEP 2] Current Firewall Rules for Port 3000...
echo ════════════════════════════════════════════════════════════════
echo.

netsh advfirewall firewall show rule name="SETU Backend Port 3000" 2>nul
netsh advfirewall firewall show rule name="SETU Backend Port 3000 Outbound" 2>nul

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║              FIREWALL CONFIGURATION COMPLETE                 ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo Port 3000 is now open for incoming connections.
echo.
echo Your mobile app should now be able to connect to the backend.
echo.
echo Make sure:
echo   1. Backend server is running on port 3000
echo   2. Phone and PC are on the same WiFi network
echo   3. Use your PC's WiFi IP: 192.168.0.101
echo.
pause
