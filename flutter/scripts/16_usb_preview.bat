@echo off
setlocal EnableDelayedExpansion

:: ============================================================
:: SETU Mobile - USB Device Live Preview  (Hot-Reload Dev Mode)
:: ============================================================
:: Usage:
::   16_usb_preview.bat               -> interactive wizard
::   16_usb_preview.bat <device-id>   -> run on specific USB device
:: ============================================================

for %%I in ("%~dp0..") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"

cls
echo.
echo  ============================================================
echo    SETU Mobile App  ^|  USB Device Live Preview
echo  ============================================================
echo    Project root: %PROJECT_ROOT%
echo.

:: ---- Quick device override from command-line arg ----
if not "%~1"=="" (
  echo    Device override: %~1
  set "DEVICE_FLAG=-d %~1"
  set "SELECTED_DEVICE=%~1"
  echo    Setting up USB tunnel...
  adb -s %~1 reverse tcp:3000 tcp:3000 >nul 2>&1
  if not errorlevel 1 (
    set "BACKEND_DEFINE=--dart-define=SETU_BASE_URL=http://127.0.0.1:3000/api"
    echo    Tunnel OK  - Backend = http://127.0.0.1:3000/api
  ) else (
    set "BACKEND_DEFINE="
    echo    Tunnel failed. Set SETU_BASE_URL manually if needed.
  )
  goto :sync_and_run
)

:: ===========================================================
:: STEP 1 - Flutter Check
:: ===========================================================
echo  [1/4] Checking Flutter...
where flutter >nul 2>&1
if errorlevel 1 (
  if exist "C:\flutter\flutter\bin\flutter.bat" (
    set "PATH=%PATH%;C:\flutter\flutter\bin"
    echo        OK  -  found at C:\flutter\flutter\bin
  ) else (
    echo.
    echo        ERROR: Flutter not found in PATH.
    echo        Install Flutter and add  flutter\bin  to PATH.
    echo        Download: https://flutter.dev/docs/get-started/install
    echo.
    pause
    exit /b 1
  )
) else (
  set "FLUTTER_VER="
  for /f "delims=" %%V in ('flutter --version 2^>nul ^| findstr /i "Flutter "') do if not defined FLUTTER_VER set "FLUTTER_VER=%%V"
  if defined FLUTTER_VER (echo        OK  -  !FLUTTER_VER!) else (echo        OK  -  Flutter found)
)

:step2

:: ===========================================================
:: STEP 2 - Detect USB Device(s)
:: ===========================================================
echo.
echo  [2/4] Detecting USB Device(s)...
echo.

:: Check ADB is available
where adb >nul 2>&1
if errorlevel 1 (
  echo        ERROR: adb not found in PATH.
  echo        Add Android SDK platform-tools to PATH.
  echo        Typical path: %LOCALAPPDATA%\Android\Sdk\platform-tools
  echo.
  pause
  exit /b 1
)

:: Show all ADB devices so user can identify their device
echo        All connected devices (adb):
echo        -------------------------------------------------------
adb devices
echo        -------------------------------------------------------
echo.

:: Count USB devices (exclude emulators and header line)
set "USB_COUNT=0"
set "FIRST_USB="
for /f "skip=1 tokens=1,2" %%A in ('adb devices 2^>nul') do (
  if not "%%A"=="" if not "%%B"=="" (
    set "IS_EMU=0"
    if /i "%%A"=="List" set "IS_EMU=1"
    echo %%A | findstr /b "emulator-" >nul 2>&1 && set "IS_EMU=1"
    if /i "%%B"=="offline"      set "IS_EMU=1"
    if /i "%%B"=="unauthorized" set "IS_EMU=1"
    if "!IS_EMU!"=="0" (
      set /a "USB_COUNT+=1"
      if not defined FIRST_USB set "FIRST_USB=%%A"
    )
  )
)

if !USB_COUNT!==0 (
  echo        No USB devices found.
  echo.
  echo        Checklist:
  echo          1. Enable  Developer Options  on your phone
  echo          2. Enable  USB Debugging  in Developer Options
  echo          3. Trust the PC when prompted on your phone screen
  echo          4. Try a different cable  (data cable, not charge-only^)
  echo.
  pause
  exit /b 1
)

set "DEVICE_FLAG="
set "SELECTED_DEVICE="
if !USB_COUNT!==1 (
  echo        One USB device found: !FIRST_USB!
  echo        Using it automatically.
  set "DEVICE_FLAG=-d !FIRST_USB!"
  set "SELECTED_DEVICE=!FIRST_USB!"
) else (
  echo        !USB_COUNT! USB devices found.
  echo        Enter the device ID from the list above, or press Enter for auto.
  echo.
  set "DEV_ID="
  set /p "DEV_ID=        Device ID: "
  if defined DEV_ID (
    set "DEVICE_FLAG=-d !DEV_ID!"
    set "SELECTED_DEVICE=!DEV_ID!"
    echo        Targeting: !DEV_ID!
  ) else (
    set "SELECTED_DEVICE=!FIRST_USB!"
  )
)

:backend_step

:: ===========================================================
:: STEP 3 - USB Tunnel + Backend URL
:: ===========================================================
echo.
echo  [3/4] Backend Configuration
echo.

:: --- Try USB tunnel first (adb reverse) -----------------------
:: This forwards  device:localhost:3000  ->  PC:localhost:3000
:: Works entirely over USB - no WiFi needed on the phone.
set "ADB_REV_OK=0"
if defined SELECTED_DEVICE (
  echo        Trying USB tunnel  ^(adb reverse tcp:3000 tcp:3000^)...
  adb -s !SELECTED_DEVICE! reverse tcp:3000 tcp:3000 >nul 2>&1
  if not errorlevel 1 (
    set "ADB_REV_OK=1"
    echo        Tunnel OK  -  device:3000  --^>  PC:3000
  ) else (
    echo        Tunnel failed. Falling back to network IP.
  )
)

if "!ADB_REV_OK!"=="1" (
  set "BACKEND_DEFINE=--dart-define=SETU_BASE_URL=http://127.0.0.1:3000/api"
  echo        Backend = http://127.0.0.1:3000/api  ^(USB tunnel, no WiFi needed^)
  goto :packages_step
)

:: --- Fallback: detect PC IP  (phone must be on same network) --
echo.
echo        Detecting PC IP for network connection...
echo.

set "HOTSPOT_IP="
set "LAN_IP="

for /f "tokens=2 delims=:" %%A in ('ipconfig 2^>nul ^| findstr "IPv4"') do (
  set "RAW=%%A"
  set "RAW=!RAW: =!"
  :: Check for Windows Mobile Hotspot range (192.168.137.x)
  echo !RAW! | findstr /b "192.168.137." >nul 2>&1
  if not errorlevel 1 (
    if not defined HOTSPOT_IP set "HOTSPOT_IP=!RAW!"
  ) else (
    :: Skip loopback, APIPA, VirtualBox, Docker
    set "FSKIP=0"
    echo !RAW! | findstr /b "127."         >nul 2>&1 && set "FSKIP=1"
    echo !RAW! | findstr /b "169.254."    >nul 2>&1 && set "FSKIP=1"
    echo !RAW! | findstr /b "192.168.56." >nul 2>&1 && set "FSKIP=1"
    echo !RAW! | findstr /b "172.1[6-9]." >nul 2>&1 && set "FSKIP=1"
    echo !RAW! | findstr /b "172.2."      >nul 2>&1 && set "FSKIP=1"
    echo !RAW! | findstr /b "172.3[0-1]." >nul 2>&1 && set "FSKIP=1"
    if "!FSKIP!"=="0" if not defined LAN_IP set "LAN_IP=!RAW!"
  )
)

if defined HOTSPOT_IP (
  echo        Mobile Hotspot detected: !HOTSPOT_IP!
  echo        Connect your phone to this PC's hotspot.
  set "CHOSEN_URL=http://!HOTSPOT_IP!:3000/api"
) else if defined LAN_IP (
  echo        LAN adapter detected: !LAN_IP!
  echo        Connect your phone to the same Wi-Fi network as this PC.
  set "CHOSEN_URL=http://!LAN_IP!:3000/api"
) else (
  echo        WARNING: Could not detect a usable PC IP.
  echo        Enable Windows Mobile Hotspot and connect your phone to it.
  set "CHOSEN_URL="
)

if defined CHOSEN_URL (
  set "BACKEND_DEFINE=--dart-define=SETU_BASE_URL=!CHOSEN_URL!"
  echo        Backend = !CHOSEN_URL!
) else (
  set "BACKEND_DEFINE="
  echo        Connection will likely fail.
)

:packages_step

:: ===========================================================
:: STEP 4 - Sync packages
:: ===========================================================
echo.
echo  [4/4] Syncing packages...
call flutter pub get
echo        Packages ready.

:sync_and_run
:: ===========================================================
:: LAUNCH
:: ===========================================================
echo.
echo  ============================================================
echo    Launching SETU Mobile on USB device...
echo  ============================================================
echo.
echo    Hot-reload controls  (after app starts):
echo      r   = Hot reload        (updates UI instantly)
echo      R   = Hot restart       (full app restart, keeps data)
echo      p   = Toggle widget inspector
echo      q   = Quit
echo.

:: ---- USB tunnel keeper (background) ----
:: "flutter run" re-installs the APK which resets all adb reverse rules.
:: This background loop re-establishes  adb reverse tcp:3000  every 3 s
:: so the tunnel is alive again before the app first tries to connect.
if defined SELECTED_DEVICE (
  set "TKBAT=%TEMP%\setu_adb_tunnel.bat"
  echo @echo off> "!TKBAT!"
  echo :loop>> "!TKBAT!"
  echo adb -s !SELECTED_DEVICE! reverse tcp:3000 tcp:3000 ^>nul 2^>^&1>> "!TKBAT!"
  echo ping -n 4 127.0.0.1 ^>nul 2^>^&1>> "!TKBAT!"
  echo goto :loop>> "!TKBAT!"
  start /min "SETU-ADB-Tunnel" cmd /c "!TKBAT!"
  echo    USB tunnel keeper started ^(minimized window "SETU-ADB-Tunnel"^).
  echo    Close that window when you end the session.
  echo.
)

set "RUN_CMD=flutter run !DEVICE_FLAG! !BACKEND_DEFINE!"
echo    Command: !RUN_CMD!
echo.
echo  ============================================================
echo.

call flutter run !DEVICE_FLAG! !BACKEND_DEFINE!

echo.
echo  ============================================================
echo    Live preview ended.
echo    Press any key to close this window.
echo  ============================================================
pause >nul
