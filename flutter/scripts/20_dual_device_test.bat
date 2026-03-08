@echo off
setlocal EnableDelayedExpansion

:: ============================================================
:: SETU Mobile  |  Dual-Device Role Test  (Release APK)
:: ============================================================
:: Builds ONE release APK and installs it on EVERY connected
:: USB Android device simultaneously.  Opens a per-device log
:: window so you can monitor both devices side-by-side.
::
:: Purpose: Test role-based push notifications
::   Device 1  ->  login as Site Engineer (raise RFI / progress)
::   Device 2  ->  login as QC Inspector or PM (receive approvals)
::
:: Usage:
::   20_dual_device_test.bat
:: ============================================================

for %%I in ("%~dp0..") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"

cls
echo.
echo  ============================================================
echo    SETU Mobile  ^|  Dual-Device Role Notification Test
echo  ============================================================
echo    Project root: %PROJECT_ROOT%
echo.
echo  ------------------------------------------------------------
echo   WHAT THIS SCRIPT DOES
echo  ------------------------------------------------------------
echo.
echo    1. Detects all connected USB Android devices
echo    2. Auto-detects your PC's IP address
echo    3. Builds ONE release APK with the correct backend URL
echo    4. Installs the APK on ALL connected devices in parallel
echo    5. Whitelists network permissions on every device
echo    6. Opens one log window per device
echo    7. Prints the test scenario card
echo.
echo  ------------------------------------------------------------
echo   TEST SCENARIO
echo  ------------------------------------------------------------
echo.
echo    DEVICE 1  ^(Site Engineer^)
echo      - Login with a user that has  EXECUTION.ENTRY.CREATE
echo        and  QUALITY.INSPECTION.RAISE  permissions.
echo      - Raise an RFI on any quality activity.
echo      - Submit a progress entry.
echo.
echo    DEVICE 2  ^(QC Inspector / Project Manager^)
echo      - Login with a user that has  QUALITY.INSPECTION.APPROVE
echo        ^(for RFI notifications^)  OR  EXECUTION.ENTRY.APPROVE
echo        ^(for progress notifications^).
echo      - Watch for push notifications to arrive.
echo      - Tap the notification — you land on the projects list
echo        with a contextual banner explaining the action.
echo      - Open the project and go to Quality Approvals / Progress.
echo.
echo  ============================================================
echo.
pause
cls

echo.
echo  ============================================================
echo    SETU Mobile  ^|  Dual-Device Test  ^(Setup^)
echo  ============================================================
echo.

:: ===========================================================
:: STEP 1 - Flutter and ADB Check
:: ===========================================================
echo  [1/6] Checking Flutter and ADB...

where flutter >nul 2>&1
if errorlevel 1 (
  if exist "C:\flutter\flutter\bin\flutter.bat" (
    set "PATH=%PATH%;C:\flutter\flutter\bin"
    echo         OK  -  Flutter found at C:\flutter\flutter\bin
  ) else (
    echo.
    echo         ERROR: Flutter not found in PATH.
    pause & exit /b 1
  )
) else (
  for /f "delims=" %%V in ('flutter --version 2^>nul ^| findstr /i "Flutter "') do (
    if not defined FLUTTER_VER set "FLUTTER_VER=%%V"
  )
  if defined FLUTTER_VER (echo         OK  -  !FLUTTER_VER!) else (echo         OK  -  Flutter)
)

where adb >nul 2>&1
if errorlevel 1 (
  echo.
  echo         ERROR: adb not found in PATH.
  echo         Install Android Studio or Android Platform Tools.
  pause & exit /b 1
) else (
  echo         OK  -  ADB
)

:: ===========================================================
:: STEP 2 - Detect ALL connected USB devices
:: ===========================================================
echo.
echo  [2/6] Detecting USB Devices...
echo.
echo         Connected ADB devices:
echo         -------------------------------------------------------
adb devices 2>nul
echo         -------------------------------------------------------
echo.

set "DEVICE_COUNT=0"
set "DEV_LIST="

for /f "skip=1 tokens=1,2" %%A in ('adb devices 2^>nul') do (
  if not "%%A"=="" if not "%%B"=="" if not "%%B"=="List" (
    set "SKIP=0"
    echo %%A | findstr /b "emulator-" >nul 2>&1 && set "SKIP=1"
    if /i "%%B"=="offline"       set "SKIP=1"
    if /i "%%B"=="unauthorized"  set "SKIP=1"
    echo %%A | findstr /r "[0-9]*\.[0-9]*\.[0-9]*\.[0-9]*" >nul 2>&1 && set "SKIP=1"
    if "!SKIP!"=="0" (
      set /a "DEVICE_COUNT+=1"
      if not defined DEV_LIST (
        set "DEV_LIST=%%A"
        set "DEV_1=%%A"
      ) else (
        set "DEV_LIST=!DEV_LIST! %%A"
        set "DEV_2=%%A"
      )
    )
  )
)

if !DEVICE_COUNT!==0 (
  echo         ERROR: No USB devices found.
  echo.
  echo         Connect at least ONE device via USB with:
  echo           - USB mode set to File Transfer / MTP
  echo           - Developer Options and USB Debugging enabled
  echo           - "Allow USB Debugging?" accepted on device
  echo.
  echo         For dual-device testing you need TWO devices.
  echo         You can still test with one device if needed.
  echo.
  pause & exit /b 1
)

if !DEVICE_COUNT!==1 (
  echo         WARNING: Only ONE device detected.
  echo         For full role-based testing you need TWO devices.
  echo         Continuing with one device...
  echo.
)

if !DEVICE_COUNT! geq 2 (
  echo         Found !DEVICE_COUNT! USB devices:
  echo           Device 1: !DEV_1!
  echo           Device 2: !DEV_2!
  if !DEVICE_COUNT! gtr 2 (
    echo           ... and more
  )
  echo.
)

:: ===========================================================
:: STEP 3 - Backend URL
:: ===========================================================
echo.
echo  [3/6] Backend Configuration...
echo.

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
) else if defined LAN_IP (
  set "AUTO_IP=!LAN_IP!"
  echo         Auto-detected: LAN WiFi IP = !AUTO_IP!
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

if not defined BACKEND_URL (
  echo.
  echo         ERROR: No backend URL set. Cannot build without it.
  pause & exit /b 1
)

echo.
echo         Backend = !BACKEND_URL!

:: ===========================================================
:: STEP 4 - Kill stale processes + pub get
:: ===========================================================
echo.
echo  [4/6] Cleaning stale build processes and syncing packages...

taskkill /F /IM java.exe    /T >nul 2>&1
taskkill /F /IM gradle.exe  /T >nul 2>&1
taskkill /F /IM dart.exe    /T >nul 2>&1
taskkill /F /IM dartvm.exe  /T >nul 2>&1
echo         Stale processes terminated.

set "INT=%PROJECT_ROOT%\build\app\intermediates"
rd /s /q "!INT!\merged_res_blame_folder"          >nul 2>&1
rd /s /q "!INT!\assets\release\mergeReleaseAssets" >nul 2>&1
rd /s /q "!INT!\incremental\mergeReleaseResources" >nul 2>&1
rd /s /q "%PROJECT_ROOT%\.dart_tool"               >nul 2>&1
echo         Locked build dirs cleared.

call flutter pub get
echo         Packages ready.

:: ===========================================================
:: STEP 5 - Build release APK
:: ===========================================================
echo.
echo  [5/6] Building release APK...
echo.
echo         flutter build apk --release
echo         --dart-define=SETU_BASE_URL=!BACKEND_URL!
echo.
echo         This may take 2-5 minutes on first build...
echo.

call flutter build apk --release --dart-define=SETU_BASE_URL=!BACKEND_URL!

if errorlevel 1 (
  echo.
  echo  ============================================================
  echo    BUILD FAILED. Check the errors above.
  echo  ============================================================
  echo.
  pause & exit /b 1
)

set "APK_PATH=%PROJECT_ROOT%\build\app\outputs\flutter-apk\app-release.apk"

if not exist "!APK_PATH!" (
  echo.
  echo         ERROR: APK not found at expected path:
  echo         !APK_PATH!
  pause & exit /b 1
)

echo.
echo         APK built successfully:
echo         !APK_PATH!

:: ===========================================================
:: STEP 6 - Install + whitelist on ALL devices
:: ===========================================================
echo.
echo  [6/6] Installing APK on all devices...
echo.

set "DEVICE_NUM=0"
for /f "skip=1 tokens=1,2" %%A in ('adb devices 2^>nul') do (
  if not "%%A"=="" if not "%%B"=="" if not "%%B"=="List" (
    set "SKIP=0"
    echo %%A | findstr /b "emulator-" >nul 2>&1 && set "SKIP=1"
    if /i "%%B"=="offline"       set "SKIP=1"
    if /i "%%B"=="unauthorized"  set "SKIP=1"
    echo %%A | findstr /r "[0-9]*\.[0-9]*\.[0-9]*\.[0-9]*" >nul 2>&1 && set "SKIP=1"
    if "!SKIP!"=="0" (
      set /a "DEVICE_NUM+=1"
      echo         [Device !DEVICE_NUM!] Installing on %%A ...
      adb -s %%A install -r "!APK_PATH!"
      if errorlevel 1 (
        echo         [Device !DEVICE_NUM!] INSTALL FAILED on %%A
      ) else (
        echo         [Device !DEVICE_NUM!] Install OK on %%A
        :: Apply network whitelist
        set "APP_UID="
        for /f "tokens=2 delims=:=" %%U in ('adb -s %%A shell "pm list packages --uid 2>/dev/null | grep setu_mobile" 2^>nul') do (
          set "APP_UID=%%U"
          set "APP_UID=!APP_UID: =!"
        )
        if defined APP_UID (
          adb -s %%A shell "cmd netpolicy add restrict-background-whitelist !APP_UID!" >nul 2>&1
          adb -s %%A shell "cmd netpolicy add app-idle-whitelist !APP_UID!" >nul 2>&1
          adb -s %%A shell "am set-standby-bucket com.example.setu_mobile active" >nul 2>&1
          echo         [Device !DEVICE_NUM!] Network whitelist applied ^(UID !APP_UID!^)
        ) else (
          echo         [Device !DEVICE_NUM!] WARNING: Could not find app UID — network may be restricted.
          echo                              Go to: Settings -^> Apps -^> SETU Mobile -^> Battery -^> Unrestricted
        )
      )
      echo.
    )
  )
)

:: ===========================================================
:: OPEN ONE LOG WINDOW PER DEVICE
:: ===========================================================
echo         Opening device log windows...

set "DEV_NUM=0"
for /f "skip=1 tokens=1,2" %%A in ('adb devices 2^>nul') do (
  if not "%%A"=="" if not "%%B"=="" if not "%%B"=="List" (
    set "SKIP=0"
    echo %%A | findstr /b "emulator-" >nul 2>&1 && set "SKIP=1"
    if /i "%%B"=="offline"       set "SKIP=1"
    if /i "%%B"=="unauthorized"  set "SKIP=1"
    echo %%A | findstr /r "[0-9]*\.[0-9]*\.[0-9]*\.[0-9]*" >nul 2>&1 && set "SKIP=1"
    if "!SKIP!"=="0" (
      set /a "DEV_NUM+=1"
      set "LOG_TEMP=%TEMP%\setu_log_!DEV_NUM!_%RANDOM%.bat"
      (
        echo @echo off
        echo title SETU Logs  [Device !DEV_NUM! : %%A]
        echo color 0A
        echo echo.
        echo echo  ============================================================
        echo echo    SETU Mobile  ^|  Live Device Logs
        echo echo    Device !DEV_NUM! : %%A
        echo echo  ============================================================
        echo echo.
        echo adb -s %%A logcat -v time flutter:V FlutterMain:V FlutterActivity:V DartVM:D AndroidRuntime:E System.err:W *:S
        echo echo.
        echo echo  Log stream ended. Press any key to close.
        echo pause ^>nul
        echo del "%%~f0" ^>nul 2^>^&1
      ) > "!LOG_TEMP!"
      start "SETU Logs [Device !DEV_NUM! : %%A]" cmd /c "!LOG_TEMP!"
    )
  )
)

ping -n 2 127.0.0.1 >nul 2>&1

:: ===========================================================
:: TEST SCENARIO CARD
:: ===========================================================
cls
echo.
echo  ============================================================
echo    ALL DEVICES READY  ^|  Role-Based Notification Test
echo  ============================================================
echo.
echo    Backend : !BACKEND_URL!
echo    APK     : !APK_PATH!
echo    Devices : !DEVICE_COUNT! installed
echo.
echo  ============================================================
echo.
echo    STEP-BY-STEP TEST PROCEDURE
echo  ------------------------------------------------------------
echo.
echo    DEVICE 1  -^>  Login as SITE ENGINEER
echo    ----------------------------------------
echo    Role permissions expected:
echo      QUALITY.INSPECTION.RAISE   ^(raise RFI^)
echo      EXECUTION.ENTRY.CREATE     ^(submit progress^)
echo.
echo    After login:
echo      - Home screen shows NO approval banner  ^(role check OK^)
echo      - Go to a project -^> Quality -^> Raise an RFI
echo      - Go to a project -^> Progress -^> Submit a progress entry
echo.
echo    DEVICE 2  -^>  Login as QC INSPECTOR or PROJECT MANAGER
echo    ----------------------------------------
echo    QC Inspector permissions expected:
echo      QUALITY.INSPECTION.APPROVE ^(receive RFI notifications^)
echo.
echo    Project Manager permissions expected:
echo      EXECUTION.ENTRY.APPROVE    ^(receive progress notifications^)
echo.
echo    After login:
echo      - Home screen shows APPROVAL BANNER with relevant chips
echo      - When Device 1 raises an RFI:
echo          Device 2 ^(QC Inspector^) gets a push notification
echo          Tap notification -^> projects list + orange banner
echo          Open project -^> Quality Approvals -^> approve/reject
echo          Device 1 gets an "Approved/Rejected" notification
echo.
echo      - When Device 1 submits progress:
echo          Device 2 ^(PM^) gets a push notification
echo          Tap notification -^> projects list + teal banner
echo.
echo  ============================================================
echo    TROUBLESHOOTING
echo  ============================================================
echo.
echo    No notification received?
echo      1. Ensure FIREBASE_SERVICE_ACCOUNT_PATH is set in .env
echo      2. Ensure backend is running and reachable from devices
echo      3. Check device notification permissions:
echo         Settings -^> Apps -^> SETU Mobile -^> Notifications -^> Allow
echo      4. Check the log windows for FCM token registration errors
echo.
echo    App cannot reach backend?
echo      1. Check devices are on same WiFi/hotspot as PC
echo      2. Check Windows Firewall allows port 3000
echo         Run:  netsh advfirewall firewall add rule name="SETU Dev"
echo               protocol=TCP dir=in localport=3000 action=allow
echo.
echo  ============================================================
echo.
echo    Log windows are open for each device.
echo    Press any key to close this window when done testing.
echo.
pause >nul
