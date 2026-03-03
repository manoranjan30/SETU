@echo off
setlocal EnableDelayedExpansion

:: ============================================================
:: SETU Mobile  |  USB Live Preview  (Hot-Reload Dev Mode)
:: ============================================================
:: Connects to a USB-debuggable physical Android device,
:: sets the correct WiFi backend URL, whitelists the app
:: from Android network restrictions, opens a live device
:: log window, then launches Flutter in hot-reload mode.
::
:: Usage:
::   19_usb_preview.bat                -> interactive wizard
::   19_usb_preview.bat <device-id>   -> target specific device
:: ============================================================

for %%I in ("%~dp0..") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"

cls
echo.
echo  ============================================================
echo    SETU Mobile  ^|  USB Live Preview  ^(Hot-Reload Dev Mode^)
echo  ============================================================
echo    Project root: %PROJECT_ROOT%
echo.

:: ===========================================================
::  HOT-RELOAD GUIDE  (shown every launch for quick reference)
:: ===========================================================
echo  ------------------------------------------------------------
echo   WHAT IS HOT RELOAD vs HOT RESTART?
echo  ------------------------------------------------------------
echo.
echo    r   HOT RELOAD  ^(fastest - keeps state^)
echo        Pushes only changed Dart code to the running app.
echo        App state is preserved ^(login, scroll pos, form data^).
echo.
echo        USE WHEN you changed:
echo          - Widget build methods / UI layout
echo          - Colors, styles, text, padding
echo          - Stateless widget logic
echo          - Any visual-only change
echo.
echo    R   HOT RESTART  ^(slower - clears state^)
echo        Fully restarts the Dart VM. All state is lost ^(you
echo        will be taken back to the login screen^).
echo.
echo        USE WHEN you changed:
echo          - initState^(^) or dispose^(^) methods
echo          - BLoC / Cubit initial state or events
echo          - New class variables or final fields
echo          - Added a new package ^(after pub get^)
echo          - App routes or navigator setup
echo          - When  r  gives an error or does nothing
echo.
echo  ------------------------------------------------------------
echo   OTHER SHORTCUTS  ^(type in this window while app runs^)
echo  ------------------------------------------------------------
echo.
echo    p   Toggle Widget Inspector  ^(tap widgets to inspect^)
echo    v   Open DevTools in browser ^(timeline, memory, logs^)
echo    s   Save screenshot to project folder
echo    o   Toggle Android / Fuchsia rendering mode
echo    q   Quit Flutter and stop the app
echo.
echo  ------------------------------------------------------------
echo   DEVICE LOG WINDOW
echo  ------------------------------------------------------------
echo.
echo    A second window "SETU Device Logs" will open automatically.
echo    It shows real-time logs from your Android device:
echo      - Flutter framework messages and Dart exceptions
echo      - Native Android crashes ^(AndroidRuntime^)
echo      - Network errors at the OS level
echo      - App lifecycle events ^(background/foreground^)
echo.
echo    TIP: Keep both windows visible side by side.
echo         This window = Flutter hot-reload controls.
echo         Log window  = what is happening on the phone.
echo.
echo  ============================================================
echo.
pause
cls

echo.
echo  ============================================================
echo    SETU Mobile  ^|  USB Live Preview  ^(Setup^)
echo  ============================================================
echo    Project root: %PROJECT_ROOT%
echo.

:: ===========================================================
:: STEP 1 - Flutter Check
:: ===========================================================
echo  [1/5] Checking Flutter...
where flutter >nul 2>&1
if errorlevel 1 (
  if exist "C:\flutter\flutter\bin\flutter.bat" (
    set "PATH=%PATH%;C:\flutter\flutter\bin"
    echo         OK  -  found at C:\flutter\flutter\bin
  ) else (
    echo.
    echo         ERROR: Flutter not found in PATH.
    echo         Install Flutter SDK and add flutter\bin to PATH.
    echo         https://flutter.dev/docs/get-started/install
    echo.
    pause & exit /b 1
  )
) else (
  for /f "delims=" %%V in ('flutter --version 2^>nul ^| findstr /i "Flutter "') do (
    if not defined FLUTTER_VER set "FLUTTER_VER=%%V"
  )
  if defined FLUTTER_VER (echo         OK  -  !FLUTTER_VER!) else (echo         OK)
)

where adb >nul 2>&1
if errorlevel 1 (
  echo.
  echo         ERROR: adb not found in PATH.
  echo         Install Android Studio or Android Platform Tools.
  echo         Then add platform-tools folder to PATH.
  echo.
  pause & exit /b 1
) else (
  echo         ADB  -  OK
)

:: ===========================================================
:: STEP 2 - USB Device Detection
:: ===========================================================
echo.
echo  [2/5] Detecting USB Device...
echo.

:: Handle command-line device override
if not "%~1"=="" (
  set "SELECTED_DEVICE=%~1"
  echo         Device override: !SELECTED_DEVICE!
  goto :device_ready
)

echo         Connected ADB devices:
echo         -------------------------------------------------------
adb devices 2>nul
echo         -------------------------------------------------------
echo.

:: Find USB-connected physical devices only
:: (exclude emulators, wireless ADB IP:port devices, offline, unauthorized)
set "FIRST_USB_DEV=" & set "USB_COUNT=0"
for /f "skip=1 tokens=1,2" %%A in ('adb devices 2^>nul') do (
  if not "%%A"=="" if not "%%B"=="" if not "%%B"=="List" (
    set "SKIP=0"
    echo %%A | findstr /b "emulator-" >nul 2>&1 && set "SKIP=1"
    if /i "%%B"=="offline"       set "SKIP=1"
    if /i "%%B"=="unauthorized"  set "SKIP=1"
    echo %%A | findstr /r "[0-9]*\.[0-9]*\.[0-9]*\.[0-9]*" >nul 2>&1 && set "SKIP=1"
    if "!SKIP!"=="0" (
      set /a "USB_COUNT+=1"
      if not defined FIRST_USB_DEV set "FIRST_USB_DEV=%%A"
    )
  )
)

if !USB_COUNT!==0 (
  echo         No USB device found. Please check:
  echo.
  echo           1. Connect phone to PC with a USB data cable
  echo              ^(not a charging-only cable^)
  echo.
  echo           2. On phone: pull down notification shade and set
  echo              USB mode to "File Transfer" or "MTP"
  echo.
  echo           3. Developer Options ^> USB Debugging = ON
  echo.
  echo           4. Accept "Allow USB Debugging?" prompt on phone
  echo.
  echo           5. Run:  adb devices
  echo              Your phone should appear as "device" ^(not offline^)
  echo.
  pause & exit /b 1
)

if !USB_COUNT!==1 (
  set "SELECTED_DEVICE=!FIRST_USB_DEV!"
  echo         Found USB device: !SELECTED_DEVICE!
) else (
  echo         Multiple USB devices detected.
  echo         Enter the device ID you want to target:
  echo.
  set "SELECTED_DEVICE="
  set /p "SELECTED_DEVICE=         Device ID: "
  if not defined SELECTED_DEVICE (
    set "SELECTED_DEVICE=!FIRST_USB_DEV!"
    echo         Using first: !SELECTED_DEVICE!
  )
)

:device_ready
echo.
echo         Target: !SELECTED_DEVICE!

:: ===========================================================
:: STEP 3 - Backend URL (auto-detect PC WiFi IP)
:: ===========================================================
echo.
echo  [3/5] Backend Configuration...
echo.

:: Auto-detect PC WiFi IP using ipconfig
set "HOTSPOT_IP=" & set "LAN_IP="
for /f "tokens=2 delims=:=" %%A in ('ipconfig 2^>nul ^| findstr "IPv4"') do (
  set "RAW=%%A" & set "RAW=!RAW: =!"
  echo !RAW! | findstr /b "192.168.137." >nul 2>&1
  if not errorlevel 1 (
    if not defined HOTSPOT_IP set "HOTSPOT_IP=!RAW!"
  ) else (
    set "SK=0"
    echo !RAW! | findstr /b "127. 169.254. 192.168.56. 172.1 172.2 172.3" >nul 2>&1 && set "SK=1"
    if "!SK!"=="0" if not defined LAN_IP set "LAN_IP=!RAW!"
  )
)

if defined HOTSPOT_IP (
  set "AUTO_IP=!HOTSPOT_IP!"
  echo         Auto-detected: Mobile Hotspot IP = !AUTO_IP!
  echo         ^(phone should be connected to your hotspot^)
) else if defined LAN_IP (
  set "AUTO_IP=!LAN_IP!"
  echo         Auto-detected: LAN WiFi IP = !AUTO_IP!
  echo         ^(phone and PC must be on the same WiFi network^)
) else (
  set "AUTO_IP="
  echo         Could not auto-detect PC IP.
)

if defined AUTO_IP (
  set "BACKEND_URL=http://!AUTO_IP!:3000/api"
  echo         Suggested backend: !BACKEND_URL!
  echo.
  set "OVERRIDE=n"
  set /p "OVERRIDE=         Use a different backend URL? (y/N): "
  set "OVERRIDE=!OVERRIDE:~0,1!"
  if /i "!OVERRIDE!"=="y" (
    set "BACKEND_URL="
    set /p "BACKEND_URL=         Enter URL e.g. http://192.168.1.8:3000/api : "
  )
) else (
  set "BACKEND_URL="
  echo.
  set /p "BACKEND_URL=         Enter backend URL e.g. http://192.168.1.8:3000/api : "
)

if defined BACKEND_URL (
  set "BACKEND_DEFINE=--dart-define=SETU_BASE_URL=!BACKEND_URL!"
  echo.
  echo         Backend = !BACKEND_URL!
) else (
  set "BACKEND_DEFINE="
  echo.
  echo         WARNING: No backend URL set.
  echo         Physical devices cannot reach 10.0.2.2 ^(emulator-only^).
  echo         Network calls will fail unless backend is on localhost.
)

:: ===========================================================
:: STEP 4 - Kill stale build processes + clean locked dirs
:: ===========================================================
echo.
echo  [4/5] Cleaning stale build processes...

:: Kill any lingering Java / Gradle processes that may lock build dirs
taskkill /F /IM java.exe /T >nul 2>&1
taskkill /F /IM gradle.exe /T >nul 2>&1

:: Remove the Gradle assets staging dir that OneDrive / AV commonly locks
set "MERGE_ASSETS=%PROJECT_ROOT%\build\app\intermediates\assets\debug\mergeDebugAssets"
if exist "!MERGE_ASSETS!" (
  rd /s /q "!MERGE_ASSETS!" >nul 2>&1
  echo         Cleared locked build assets dir.
) else (
  echo         Build assets dir clean  -  nothing to remove.
)
echo         Stale processes cleared.

:: ===========================================================
:: STEP 5 - Pub get + Network Whitelist
:: ===========================================================
echo.
echo  [5/5] Syncing packages...
call flutter pub get
echo         Packages ready.

:: Apply Android network whitelist for the SETU app
:: (removes Android's RESTRICT_ALL background network policy)
echo.
echo         Checking Android network policy for SETU app...
set "APP_UID="
for /f "tokens=2 delims=:=" %%U in ('adb -s "!SELECTED_DEVICE!" shell "pm list packages --uid 2>/dev/null | grep setu_mobile" 2^>nul') do (
  set "APP_UID=%%U"
  set "APP_UID=!APP_UID: =!"
)
if defined APP_UID (
  adb -s "!SELECTED_DEVICE!" shell "cmd netpolicy add restrict-background-whitelist !APP_UID!" >nul 2>&1
  adb -s "!SELECTED_DEVICE!" shell "cmd netpolicy add app-idle-whitelist !APP_UID!" >nul 2>&1
  adb -s "!SELECTED_DEVICE!" shell "am set-standby-bucket com.example.setu_mobile active" >nul 2>&1
  echo         Network whitelist applied ^(UID !APP_UID!^).
) else (
  echo         App not installed yet — Flutter will install it now.
  echo         If you see network errors after first launch:
  echo           Close app, re-run this script, whitelist will apply.
  echo.
  echo         Or go to phone: Settings -^> Apps -^> SETU Mobile
  echo                         -^> Battery -^> Unrestricted
)

:: ===========================================================
:: OPEN DEVICE LOG WINDOW
:: ===========================================================
echo.
echo         Opening device log window...

:: Write the logcat session to a temp bat so quotes don't break
set "LOG_TEMP=%TEMP%\setu_log_%RANDOM%.bat"
(
  echo @echo off
  echo title SETU Device Logs  [!SELECTED_DEVICE!]
  echo color 0A
  echo echo.
  echo echo  ============================================================
  echo echo    SETU Mobile  ^|  Live Device Logs
  echo echo    Device : !SELECTED_DEVICE!
  echo echo  ============================================================
  echo echo.
  echo echo    What you see here:
  echo echo      flutter        - Dart/Flutter framework messages
  echo echo      DartVM         - Dart VM output ^(print, debugPrint^)
  echo echo      AndroidRuntime - Fatal Java/Kotlin crashes
  echo echo      FlutterActivity- Activity lifecycle events
  echo echo.
  echo echo    TIP: Look here when the app crashes or network fails.
  echo echo    Press Ctrl+C to stop log stream.
  echo echo  ============================================================
  echo echo.
  echo adb -s !SELECTED_DEVICE! logcat -v time flutter:V FlutterMain:V FlutterActivity:V DartVM:D AndroidRuntime:E System.err:W *:S
  echo echo.
  echo echo  Log stream ended. Press any key to close.
  echo pause ^>nul
  echo del "%%~f0" ^>nul 2^>^&1
) > "!LOG_TEMP!"

start "SETU Device Logs  [!SELECTED_DEVICE!]" cmd /c "!LOG_TEMP!"

:: Brief pause so the log window appears before flutter run takes focus
ping -n 2 127.0.0.1 >nul 2>&1

:: ===========================================================
:: LAUNCH FLUTTER RUN
:: ===========================================================
echo.
echo  ============================================================
echo    Launching SETU Mobile in hot-reload mode...
echo  ============================================================
echo.
echo    Device  : !SELECTED_DEVICE!
echo    Backend : !BACKEND_URL!
echo.
echo  ------------------------------------------------------------
echo    r = Hot Reload    R = Hot Restart    q = Quit
echo    v = DevTools      p = Widget Inspector
echo  ------------------------------------------------------------
echo.

call flutter run -d "!SELECTED_DEVICE!" !BACKEND_DEFINE!

:: ===========================================================
:: DONE
:: ===========================================================
echo.
echo  ============================================================
echo    Live preview ended.
echo.
echo    The "SETU Device Logs" window can now be closed manually.
echo  ============================================================
echo.
pause >nul
