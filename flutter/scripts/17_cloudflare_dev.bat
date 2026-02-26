@echo off
setlocal EnableDelayedExpansion

:: ============================================================
:: SETU Mobile - Cloudflare Quick Tunnel  +  Build + Install
:: ============================================================
:: Bypasses all local-network issues by routing the app through
:: Cloudflare's public edge  ->  your localhost:3000 backend.
:: No Cloudflare account required.  Uses trycloudflare.com.
::
:: Usage:
::   17_cloudflare_dev.bat           -> full wizard (tunnel+build+install)
::   17_cloudflare_dev.bat tunnel    -> start tunnel only, print URL
:: ============================================================

for %%I in ("%~dp0..") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"

set "CFLOG=%TEMP%\setu_cf_tunnel.log"
set "CFERR=%TEMP%\setu_cf_stderr.log"
set "CFURL_PS=%TEMP%\setu_cf_url.ps1"
set "APK=%PROJECT_ROOT%\build\app\outputs\flutter-apk\app-release.apk"

cls
echo(
echo  ============================================================
echo    SETU Mobile  ^|  Cloudflare Quick Tunnel  +  Build + Install
echo  ============================================================
echo    Project root: %PROJECT_ROOT%
echo(
echo    No Cloudflare account required.
echo    Uses trycloudflare.com  ^(free, zero setup^)
echo(
echo    How it works:
echo      Phone  -->  Cloudflare Edge  -->  Your PC localhost:3000
echo(
echo  ============================================================
echo(

:: ===========================================================
:: STEP 1 - Prerequisites
:: ===========================================================
echo  [1/4] Checking prerequisites...
echo(

:: ---- cloudflared ----
where cloudflared >nul 2>&1
if errorlevel 1 (
  echo        [X] cloudflared not found in PATH.
  echo(
  echo        Install with winget  ^(recommended^):
  echo          winget install cloudflare.cloudflared
  echo(
  echo        Or download manually:
  echo          https://github.com/cloudflare/cloudflared/releases
  echo(
  echo        After installing, restart this window and try again.
  echo(
  pause
  exit /b 1
)
for /f "tokens=*" %%V in ('cloudflared --version 2^>^&1') do if not defined CF_VER set "CF_VER=%%V"
echo        [OK] cloudflared  ^(!CF_VER!^)

:: ---- Flutter ----
where flutter >nul 2>&1
if errorlevel 1 (
  if exist "C:\flutter\flutter\bin\flutter.bat" (
    set "PATH=%PATH%;C:\flutter\flutter\bin"
    echo        [OK] flutter  ^(C:\flutter\flutter\bin^)
  ) else (
    echo        [X] Flutter not found in PATH.
    pause & exit /b 1
  )
) else (
  echo        [OK] flutter
)

:: ---- ADB ----
set "ADB_OK=1"
where adb >nul 2>&1
if errorlevel 1 (
  set "ADB_OK=0"
  echo        [--] adb not found  ^(install step will be skipped^)
  echo             Add Android SDK platform-tools to PATH if needed.
) else (
  echo        [OK] adb
)
echo(

:: ---- Backend health check (non-blocking, informational) ----
echo        Checking backend on localhost:3000...
powershell -NoProfile -Command ^
  "try { $null = Invoke-WebRequest 'http://localhost:3000/api' -TimeoutSec 3 -UseBasicParsing; Write-Host '       [OK] Backend responding on :3000' } catch { Write-Host '       [!!] Backend not responding on :3000  --  start NestJS before testing the app' }"
echo(

:: ---- Kill any leftover cloudflared from previous session ----
tasklist /fi "imagename eq cloudflared.exe" /fo csv 2>nul | findstr /i "cloudflared" >nul
if not errorlevel 1 (
  echo        Stopping previous cloudflared session...
  taskkill /im cloudflared.exe /f >nul 2>&1
  timeout /t 2 /nobreak >nul
  echo        Done.
  echo(
)

:: ===========================================================
:: STEP 2 - Start Cloudflare Quick Tunnel
:: ===========================================================
echo  [2/4] Starting Cloudflare Quick Tunnel...
echo(

if exist "!CFLOG!" del "!CFLOG!"
if exist "!CFERR!" del "!CFERR!"

:: Write URL-extraction PowerShell script.
:: Uses (echo ...) >> file pattern to safely handle ) and | in content.
:: Checks both stdout (CFLOG) and stderr (CFERR) — cloudflared URL appears in stderr.
(echo $pattern = 'https://[a-z0-9-]+\.trycloudflare\.com') > "!CFURL_PS!"
(echo $logs = '!CFLOG!', '!CFERR!') >> "!CFURL_PS!"
(echo foreach ($f in $logs^) {) >> "!CFURL_PS!"
(echo   if (Test-Path $f^) {) >> "!CFURL_PS!"
(echo     $m = (Get-Content $f -EA SilentlyContinue^) ^| Select-String -Pattern $pattern) >> "!CFURL_PS!"
(echo     if ($m^) { $m.Matches[0].Value; exit }) >> "!CFURL_PS!"
(echo   }) >> "!CFURL_PS!"
(echo }) >> "!CFURL_PS!"

:: Start cloudflared in background via PowerShell Start-Process.
:: Avoids the batch redirect-in-redirect quoting trap (2^>^&1>> issue).
:: stdout -> CFLOG, stderr -> CFERR (URL appears in stderr).
powershell -NoProfile -Command "Start-Process cloudflared -ArgumentList @('tunnel','--url','http://localhost:3000') -RedirectStandardOutput '!CFLOG!' -RedirectStandardError '!CFERR!' -NoNewWindow"

echo        cloudflared started  ^(background process^)
echo        Watching for tunnel URL...  ^(usually 10-30 seconds^)
echo(
<nul set /p "=        ["

set "TUNNEL_URL="
set /a WAITS=0

:wait_url
set /a WAITS+=1
if !WAITS! gtr 30 goto :tunnel_timeout
timeout /t 2 /nobreak >nul
<nul set /p "=."
for /f "tokens=*" %%U in ('powershell -NoProfile -File "!CFURL_PS!" 2^>nul') do set "TUNNEL_URL=%%U"
if "!TUNNEL_URL!"=="" goto :wait_url

echo ]
echo(
echo  ============================================================
echo(
echo    TUNNEL ACTIVE
echo    URL : !TUNNEL_URL!
echo(
echo  ============================================================
echo(

set "BACKEND_URL=!TUNNEL_URL!/api"
echo        API URL for app : !BACKEND_URL!
echo(

if /i "%~1"=="tunnel" (
  echo        Tunnel-only mode  --  skipping build and install.
  echo        Pass this URL to Flutter manually:
  echo          flutter run --dart-define=SETU_BASE_URL=!BACKEND_URL!
  goto :keep_alive
)

:: ===========================================================
:: STEP 3 - Build Flutter APK with tunnel URL baked in
:: ===========================================================
echo  [3/4] Building Flutter APK...
echo(
echo        Baking in: SETU_BASE_URL=!BACKEND_URL!
echo        Build type : release  ^(--dart-define is compile-time^)
echo(
echo  ─────────────────────────────────────────────────────────────
echo(

call flutter pub get
echo(
call flutter build apk --dart-define=SETU_BASE_URL=!BACKEND_URL!

if errorlevel 1 (
  echo(
  echo        [X] Flutter build FAILED.
  echo        Stopping tunnel...
  taskkill /im cloudflared.exe /f >nul 2>&1
  echo(
  pause & exit /b 1
)

echo(
echo  ─────────────────────────────────────────────────────────────
echo(
echo        [OK] APK ready:
echo               build\app\outputs\flutter-apk\app-release.apk
echo(

:: ===========================================================
:: STEP 4 - Install APK on USB device
:: ===========================================================
echo  [4/4] Installing on device...
echo(

if "!ADB_OK!"=="0" (
  echo        [SKIP] adb not available.
  echo        Install manually when adb is in PATH:
  echo          adb install -r "!APK!"
  goto :keep_alive
)

echo        Connected devices:
echo        ─────────────────────────────────────────────────────
adb devices
echo        ─────────────────────────────────────────────────────
echo(

set "DEVICE_ID="
for /f "skip=1 tokens=1,2" %%A in ('adb devices 2^>nul') do (
  if /i "%%B"=="device" if not defined DEVICE_ID set "DEVICE_ID=%%A"
)

if not defined DEVICE_ID (
  echo        [!] No USB device detected.
  echo(
  echo        Checklist:
  echo          1. Enable Developer Options on your phone
  echo          2. Enable USB Debugging in Developer Options
  echo          3. Connect via USB  ^(use a DATA cable, not charge-only^)
  echo          4. Tap "Trust this computer" on your phone screen
  echo(
  echo        Then install manually:
  echo          adb install -r "!APK!"
  echo(
  goto :keep_alive
)

echo        Device detected: !DEVICE_ID!
echo(
echo        Installing...
adb -s !DEVICE_ID! install -r "!APK!"

if errorlevel 1 (
  echo(
  echo        [X] Install failed.
  echo        If error is INSTALL_FAILED_VERSION_DOWNGRADE, try:
  echo          adb -s !DEVICE_ID! install -r -d "!APK!"
) else (
  echo(
  echo  ============================================================
  echo    READY TO TEST
  echo(
  echo    App installed on : !DEVICE_ID!
  echo    Backend via CF   : !BACKEND_URL!
  echo(
  echo    Open the SETU app on your phone and test.
  echo    The app will route through Cloudflare to your local backend.
  echo  ============================================================
)

goto :keep_alive

:: ─────────────────────────────────────────────────────────────
:tunnel_timeout
echo ]
echo(
echo        [X] Timed out waiting for tunnel URL  ^(60 seconds^).
echo(
echo        Common causes:
echo          1. cloudflared not installed properly
echo          2. No internet connection on this PC
echo          3. Cloudflare rate-limited  ^(wait a minute and retry^)
echo(
echo        Cloudflared output:
echo        ─────────────────────────────────────────────────────
type "!CFLOG!" 2>nul
type "!CFERR!" 2>nul
echo        ─────────────────────────────────────────────────────
echo(
pause & exit /b 1

:: ===========================================================
:: Keep tunnel alive + session info
:: ===========================================================
:keep_alive
echo(
echo  ────────────────────────────────────────────────────────────
echo    Tunnel is active.  Press Ctrl+C to end the session.
echo(
echo    Re-install same APK on another device  ^(no rebuild needed^):
echo      adb install -r "!APK!"
echo(
echo    Rebuild after a code change  ^(tunnel URL stays the same^):
echo      flutter build apk --dart-define=SETU_BASE_URL=!BACKEND_URL!
echo      adb install -r "!APK!"
echo(
echo    Tunnel stdout log : !CFLOG!
echo    Tunnel stderr log : !CFERR!
echo  ────────────────────────────────────────────────────────────
echo(

:alive_loop
timeout /t 15 /nobreak >nul
tasklist /fi "imagename eq cloudflared.exe" /fo csv 2>nul | findstr /i "cloudflared" >nul
if errorlevel 1 (
  echo(
  echo    [!] Tunnel stopped unexpectedly.
  echo    Re-run this script to get a new URL and rebuild the APK.
  echo(
  pause & exit /b 1
)
goto :alive_loop
