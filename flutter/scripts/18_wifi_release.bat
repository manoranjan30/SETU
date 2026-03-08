@echo off
setlocal EnableDelayedExpansion

:: ============================================================
:: SETU Mobile - WiFi Release APK  (Physical Device Testing)
:: ============================================================
:: Builds a release APK using the PC's WiFi IP as the backend
:: URL, installs it on the connected ADB device, and removes
:: Android's RESTRICT_ALL network policy from the app.
::
:: Usage:
::   18_wifi_release.bat               -> auto-detect IP + device
::   18_wifi_release.bat <device-id>   -> specify device
::   18_wifi_release.bat install       -> install last built APK only
:: ============================================================

for %%I in ("%~dp0..") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"

cls
echo.
echo  ============================================================
echo    SETU Mobile App  ^|  WiFi Release APK Tester
echo  ============================================================
echo    Project root: %PROJECT_ROOT%
echo.

:: ---- Quick install-only mode ----
if /i "%~1"=="install" goto :install_only

:: ===========================================================
:: STEP 1 - Check Flutter
:: ===========================================================
echo  [1/4] Checking Flutter...
where flutter >nul 2>&1
if errorlevel 1 (
  if exist "C:\flutter\flutter\bin\flutter.bat" (
    set "PATH=%PATH%;C:\flutter\flutter\bin"
    echo        OK  -  found at C:\flutter\flutter\bin
  ) else (
    echo        ERROR: Flutter not found in PATH.
    pause & exit /b 1
  )
) else (
  for /f "delims=" %%V in ('flutter --version 2^>nul ^| findstr /i "Flutter "') do if not defined FLUTTER_VER set "FLUTTER_VER=%%V"
  if defined FLUTTER_VER (echo        OK  -  !FLUTTER_VER!) else (echo        OK)
)

:: ===========================================================
:: STEP 2 - Detect PC WiFi IP
:: ===========================================================
echo.
echo  [2/4] Detecting PC WiFi IP...

set "HOTSPOT_IP=" & set "LAN_IP="
for /f "tokens=2 delims=:" %%A in ('ipconfig 2^>nul ^| findstr "IPv4"') do (
  set "RAW=%%A" & set "RAW=!RAW: =!"
  echo !RAW! | findstr /b "192.168.137." >nul 2>&1
  if not errorlevel 1 (if not defined HOTSPOT_IP set "HOTSPOT_IP=!RAW!")
  else (
    set "SK=0"
    echo !RAW! | findstr /b "127. 169.254. 192.168.56. 172.1 172.2 172.3" >nul 2>&1 && set "SK=1"
    if "!SK!"=="0" if not defined LAN_IP set "LAN_IP=!RAW!"
  )
)

if defined HOTSPOT_IP (
  set "PC_IP=!HOTSPOT_IP!"
  echo        Mobile Hotspot IP: !PC_IP! ^(phone should join this hotspot^)
) else if defined LAN_IP (
  set "PC_IP=!LAN_IP!"
  echo        LAN WiFi IP: !PC_IP!
) else (
  set "PC_IP="
  echo        ERROR: Could not detect a usable WiFi IP.
  echo        Connect your PC to WiFi or enable Mobile Hotspot.
  pause & exit /b 1
)

set "BACKEND_URL=http://!PC_IP!:3000/api"
echo        Backend URL: !BACKEND_URL!

:: ===========================================================
:: STEP 3 - ADB Device Detection
:: ===========================================================
echo.
echo  [3/4] Detecting ADB Device...

where adb >nul 2>&1
if errorlevel 1 (
  echo        ERROR: adb not found in PATH.
  pause & exit /b 1
)

if not "%~1"=="" if /i not "%~1"=="install" (
  set "SELECTED_DEVICE=%~1"
  echo        Device override: !SELECTED_DEVICE!
  goto :found_device
)

:: Try switching wireless ADB to TCP mode for clean ID
adb devices -l 2>nul | findstr /i "tls-connect" >nul 2>&1
if not errorlevel 1 (
  echo        Wireless TLS device detected. Switching to TCP mode...
  for /f "skip=1 tokens=1" %%D in ('adb devices 2^>nul') do (
    if not "%%D"=="" (
      adb -s %%D tcpip 5555 >nul 2>&1
      if not errorlevel 1 echo        TCP mode enabled on %%D
    )
  )
  echo.
)

:: Wait a moment for TCP mode to activate
ping -n 3 127.0.0.1 >nul 2>&1

:: List all devices
echo        Connected ADB devices:
adb devices 2>nul
echo.

:: Find first non-emulator device
set "FIRST_DEV=" & set "DEV_COUNT=0"
for /f "skip=1 tokens=1,2" %%A in ('adb devices 2^>nul') do (
  if not "%%A"=="" if not "%%B"=="" if not "%%B"=="List" (
    set "IS_EMU=0"
    echo %%A | findstr /b "emulator-" >nul 2>&1 && set "IS_EMU=1"
    if /i "%%B"=="offline"       set "IS_EMU=1"
    if /i "%%B"=="unauthorized"  set "IS_EMU=1"
    if "!IS_EMU!"=="0" (
      set /a "DEV_COUNT+=1"
      if not defined FIRST_DEV set "FIRST_DEV=%%A"
    )
  )
)

if !DEV_COUNT!==0 (
  echo        No device found. Enter the device IP to connect via TCP/IP:
  echo        ^(e.g. 192.168.1.7^)
  echo.
  set "DEV_IP="
  set /p "DEV_IP=        Phone IP: "
  if defined DEV_IP (
    adb connect !DEV_IP!:5555 2>nul
    ping -n 2 127.0.0.1 >nul 2>&1
    set "FIRST_DEV=!DEV_IP!:5555"
    set "DEV_COUNT=1"
  )
  if !DEV_COUNT!==0 (echo        No device. Exiting. & pause & exit /b 1)
)

set "SELECTED_DEVICE=!FIRST_DEV!"
echo        Using device: !SELECTED_DEVICE!

:found_device

:: ===========================================================
:: STEP 4 - Build + Install + Launch
:: ===========================================================
echo.
echo        Backend = !BACKEND_URL!
echo.

call flutter pub get
echo.

call :build_apk
if errorlevel 1 ( pause & exit /b 1 )

:install_only
call :install_and_launch

:: ===========================================================
:: DONE + QUICK REBUILD LOOP
:: ===========================================================
echo.
echo  ============================================================
echo    DONE!
echo    Backend : !BACKEND_URL!
echo    Device  : !SELECTED_DEVICE!
echo.
echo    TIP: To make network access permanent on the phone:
echo         Settings ^> Apps ^> SETU Mobile ^> Battery ^> Unrestricted
echo.
echo    To check logs:
echo      adb -s !SELECTED_DEVICE! logcat ^| findstr flutter
echo  ============================================================
echo.
echo  ============================================================
echo    QUICK REBUILD  ^(no wizard -- reuses same backend + device^)
echo      R  =  Rebuild APK + Reinstall
echo      Any other key  =  Exit this window
echo  ============================================================
echo.

:rebuild_loop
set "RK="
set /p "RK=  [R = Rebuild+Reinstall  /  other key = Exit]: "
set "RK=!RK:~0,1!"
if /i "!RK!"=="R" (
  echo.
  echo  -------------------------------------------------------------------
  echo    Quick Rebuild  ^(backend: !BACKEND_URL!^)
  echo  -------------------------------------------------------------------
  echo.
  call :build_apk
  if not errorlevel 1 (
    call :install_and_launch
    echo.
    echo    Rebuild complete. Press R to rebuild again or any key to exit.
    echo.
  ) else (
    echo.
    echo    Build failed. Check error lines above.
    echo    Fix the issue then press R to try again, or any key to exit.
    echo.
  )
  goto :rebuild_loop
)
goto :eof

:: ──────────────────────────────────────────────────────────────
:: SUBROUTINE: Build APK with animated progress bar
:: ──────────────────────────────────────────────────────────────
:build_apk
echo.
echo  Building release APK...
echo.
echo         Backend : !BACKEND_URL!
echo         Tip     : First build 3-8 min / Rebuild 1-3 min
echo.

set "MONITOR=%~dp0_build_monitor.ps1"
flutter build apk --release --dart-define=SETU_BASE_URL=!BACKEND_URL! 2>&1 | powershell -NoProfile -ExecutionPolicy Bypass -File "!MONITOR!"

echo.

if not exist "build\app\outputs\flutter-apk\app-release.apk" (
  echo.
  echo  ============================================================
  echo    BUILD FAILED  -  APK not found. Check error lines above.
  echo  ============================================================
  echo.
  exit /b 1
)
echo        APK ready.
exit /b 0

:: ──────────────────────────────────────────────────────────────
:: SUBROUTINE: Install APK + whitelist + launch
:: ──────────────────────────────────────────────────────────────
:install_and_launch
echo.
echo        Installing APK on !SELECTED_DEVICE!...
adb -s "!SELECTED_DEVICE!" install -r "build\app\outputs\flutter-apk\app-release.apk"
if errorlevel 1 (
  echo        Install FAILED. Try:  adb uninstall com.example.setu_mobile
  exit /b 1
)
echo        Install SUCCESS.

:: Whitelist network policy
for /f "tokens=2 delims=:=" %%U in ('adb -s "!SELECTED_DEVICE!" shell "pm list packages --uid 2>/dev/null | grep setu_mobile" 2^>nul') do (
  set "APP_UID=%%U" & set "APP_UID=!APP_UID: =!"
)
if defined APP_UID (
  adb -s "!SELECTED_DEVICE!" shell "cmd netpolicy add restrict-background-whitelist !APP_UID!" >nul 2>&1
  adb -s "!SELECTED_DEVICE!" shell "cmd netpolicy add app-idle-whitelist !APP_UID!" >nul 2>&1
  adb -s "!SELECTED_DEVICE!" shell "am set-standby-bucket com.example.setu_mobile active" >nul 2>&1
  echo        Network whitelisted ^(UID !APP_UID!^).
) else (
  echo        WARNING: Could not detect UID. Set manually: Settings -^> Apps -^> SETU Mobile -^> Battery -^> Unrestricted
)

echo        Launching app...
adb -s "!SELECTED_DEVICE!" shell "am start -n com.example.setu_mobile/.MainActivity" >nul 2>&1
echo        App started.
exit /b 0
