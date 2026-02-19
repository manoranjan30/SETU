@echo off
setlocal enabledelayedexpansion
title SETU Network Diagnostics

echo.
echo  ================================================================
echo  ║      SETU Mobile App - Network Diagnostics                  ║
echo  ================================================================
echo.

:: Check if Docker is running
echo [1/6] Checking Docker containers...
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | findstr "setu"
if errorlevel 1 (
    echo     [!] Docker containers not running. Start them with:
    echo         docker-compose -f docker-compose.dev.yml up -d
) else (
    echo     [OK] Docker containers are running
)
echo.

:: Check if port 3000 is listening
echo [2/6] Checking if port 3000 is listening...
netstat -an | findstr ":3000" | findstr "LISTENING" >nul
if errorlevel 1 (
    echo     [!] Port 3000 is NOT listening
) else (
    echo     [OK] Port 3000 is listening
    netstat -an | findstr ":3000" | findstr "LISTENING"
)
echo.

:: Check firewall rules
echo [3/6] Checking Windows Firewall rules for port 3000...
netsh advfirewall firewall show rule name="SETU Backend Port 3000" >nul 2>&1
if errorlevel 1 (
    echo     [!] Firewall rule NOT found
    echo     Run: flutter\setup_firewall.bat as Administrator
) else (
    echo     [OK] Firewall rule exists
)
echo.

:: Get IP addresses
echo [4/6] Your IP Addresses:
echo     ------------------------------------------------------------
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set "ip=%%a"
    set "ip=!ip: =!"
    echo     !ip!
)
echo     ------------------------------------------------------------
echo.

:: Test local connection
echo [5/6] Testing local API connection...
curl -s -o nul -w "     HTTP Status: %%{http_code}\n" http://localhost:3000/api/auth/login -X POST -H "Content-Type: application/json" -d "{\"username\":\"test\",\"password\":\"test\"}" 2>nul
if errorlevel 1 (
    echo     [!] Cannot connect to localhost:3000
) else (
    echo     [OK] Local connection works
)
echo.

:: Test WiFi IP connection
echo [6/6] Testing WiFi IP connection...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set "ip=%%a"
    set "ip=!ip: =!"
    echo !ip! | findstr "192.168" >nul
    if not errorlevel 1 (
        echo     Testing: http://!ip!:3000/api/auth/login
        curl -s -o nul -w "     HTTP Status: %%{http_code}\n" http://!ip!:3000/api/auth/login -X POST -H "Content-Type: application/json" -d "{\"username\":\"test\",\"password\":\"test\"}" 2>nul
    )
)
echo.

echo  ================================================================
echo  ║                    TROUBLESHOOTING GUIDE                     ║
echo  ================================================================
echo.
echo  If mobile app cannot connect:
echo.
echo  1. ENSURE PHONE IS ON SAME WIFI NETWORK AS PC
echo     - Check phone WiFi settings
echo     - Phone IP should start with 192.168.0.x
echo.
echo  2. TEST FROM PHONE BROWSER
echo     - Open Chrome on phone
echo     - Go to: http://192.168.0.101:3000/api
echo     - Should see: {"message":"Cannot find..."
echo.
echo  3. CHECK WINDOWS NETWORK PROFILE
echo     - Settings ^> Network ^> Properties
echo     - Set to "Private" not "Public"
echo.
echo  4. DISABLE WINDOWS FIREWALL TEMPORARILY
echo     - Control Panel ^> Windows Defender Firewall
echo     - Turn off for private networks (test only)
echo.
echo  5. CHECK ROUTER SETTINGS
echo     - Some routers have "AP Isolation" enabled
echo     - This prevents devices from talking to each other
echo.
echo  ================================================================
echo.
pause
