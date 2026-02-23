@echo off
setlocal EnableDelayedExpansion

:: ============================================================
:: SETU Mobile - Live Preview  (Hot-Reload Dev Mode)
:: ============================================================
:: Usage:
::   15_live_preview.bat                  -> interactive wizard
::   15_live_preview.bat emulator-5554    -> run on specific device
:: ============================================================

for %%I in ("%~dp0..") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"

cls
echo(
echo  ============================================================
echo    SETU Mobile App  ^|  Live Preview  ^(Hot-Reload Dev Mode^)
echo  ============================================================
echo    Project root: %PROJECT_ROOT%
echo(

:: ---- Quick device override from command-line arg ----
if not "%~1"=="" (
  echo    Device override: %~1
  set "DEVICE_FLAG=-d %~1"
  set "BACKEND_DEFINE="
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
    echo(
    echo        ERROR: Flutter not found in PATH.
    echo        Install Flutter and add  flutter\bin  to PATH.
    echo        Download: https://flutter.dev/docs/get-started/install
    echo(
    pause
    exit /b 1
  )
) else (
  echo        OK  -  Flutter found
)

:: ===========================================================
:: STEP 2 - Backend URL
:: ===========================================================
echo(
echo  [2/4] Backend Configuration
echo(
echo        Emulator default   : http://10.0.2.2:3000/api
echo        Physical device    : http://YOUR-PC-IP:3000/api
echo(

set "BACKEND_DEFINE="
set "USE_CUSTOM="
set /p "USE_CUSTOM=        Use a custom backend URL? (y/N): "
echo(

:: Take first char only to strip any trailing CR/spaces from input
set "USE_CUSTOM=!USE_CUSTOM:~0,1!"

set "IS_CUSTOM=0"
if /i "!USE_CUSTOM!"=="y" set "IS_CUSTOM=1"

if "!IS_CUSTOM!"=="1" (
  set "BACKEND_URL="
  set /p "BACKEND_URL=        Enter URL  e.g. http://192.168.1.50:3000/api : "
  echo(
  if defined BACKEND_URL (
    set "BACKEND_DEFINE=--dart-define=SETU_BASE_URL=!BACKEND_URL!"
    echo        Backend  =  !BACKEND_URL!
  ) else (
    echo        No URL entered. Using platform default.
  )
) else (
  echo        Using platform default.
  echo        Emulator: 10.0.2.2:3000 / Physical device: needs SETU_BASE_URL
)

:: ===========================================================
:: STEP 3 - Device / Emulator Selection
:: ===========================================================
echo(
echo  [3/4] Select Target Device
echo(
echo        Currently connected devices:
echo        -------------------------------------------------------
call flutter devices
echo        -------------------------------------------------------
echo(
echo        Options:
echo          1  - First available device ^(auto^)
echo          2  - Choose / launch an Android emulator
echo          3  - Type a specific device ID
echo(

set "CHOICE="
set /p "CHOICE=        Your choice (1/2/3) [1]: "
set "CHOICE=!CHOICE:~0,1!"
if "!CHOICE!"=="" set "CHOICE=1"

set "DEVICE_FLAG="

if "!CHOICE!"=="2" goto :pick_emulator
if "!CHOICE!"=="3" goto :manual_device
goto :device_done

:pick_emulator
echo(
echo        Available emulators ^(AVDs^):
echo        -------------------------------------------------------
call flutter emulators
echo        -------------------------------------------------------
echo(
set "EMU_ID="
set /p "EMU_ID=        Enter emulator ID to launch (or Enter to skip): "
if not defined EMU_ID goto :device_done
echo(
echo        Launching !EMU_ID!...
start "" flutter emulators --launch !EMU_ID!
echo        Waiting 45 seconds for emulator to boot...
timeout /t 45 /nobreak >nul
echo        Emulator should be ready.
goto :device_done

:manual_device
echo(
set "DEV_ID="
set /p "DEV_ID=        Enter device ID: "
if defined DEV_ID (
  set "DEVICE_FLAG=-d !DEV_ID!"
  echo        Targeting device: !DEV_ID!
)

:device_done

:: ===========================================================
:: STEP 4 - Sync packages
:: ===========================================================
echo(
echo  [4/4] Syncing packages...
call flutter pub get
echo        Packages ready.

:sync_and_run
:: ===========================================================
:: LAUNCH
:: ===========================================================
echo(
echo  ============================================================
echo    Launching SETU Mobile...
echo  ============================================================
echo(
echo    Hot-reload controls  ^(after app starts^):
echo      r   = Hot reload        ^(updates UI instantly^)
echo      R   = Hot restart       ^(full app restart, keeps data^)
echo      p   = Toggle widget inspector
echo      q   = Quit
echo(

set "RUN_CMD=flutter run !DEVICE_FLAG! !BACKEND_DEFINE!"
echo    Command: !RUN_CMD!
echo(
echo  ============================================================
echo(

call flutter run !DEVICE_FLAG! !BACKEND_DEFINE!

echo(
echo  ============================================================
echo    Live preview ended.
echo    Press any key to close this window.
echo  ============================================================
pause >nul
