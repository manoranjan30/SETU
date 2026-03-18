@echo off

:: ── Self-relaunch under cmd /k so window NEVER closes automatically ────────
:: When double-clicked, CMD opens, runs the script, and closes as soon as
:: the script exits (even on errors).  Running under "cmd /k" fixes this:
:: the window stays open showing any error, and user must close it manually.
if not "%~1"=="__SETU_RUN__" (
  cmd /k "%~f0" __SETU_RUN__
  exit /b 0
)
shift
:: ──────────────────────────────────────────────────────────────────────────

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
echo      - Tap the notification -- you land on the projects list
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
    goto :done
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
  goto :done
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
  goto :done
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

:: Write a temp PowerShell script for IP detection.
:: Inline PowerShell in for/f causes CMD to mis-parse ( ) | characters even
:: inside quotes, so we write the logic to a .ps1 file first and run it.
:: Each line uses individual echo >> to avoid the paren-in-block closing issue.
::
:: Skipped ranges: loopback, APIPA, VirtualBox (192.168.56.x), all 172.x
:: (WSL2/Docker/Hyper-V), Parallels (10.211.x, 10.37.x), VirtualBox guest (10.0.2.x).
set "PS_IP=%TEMP%\setu_detect_ip.ps1"
echo $skip = '^(127\.^|169\.254\.^|192\.168\.56\.^|10\.211\.^|10\.37\.^|10\.0\.2\.^|172\.)' > "%PS_IP%"
echo $addrs = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue              >> "%PS_IP%"
echo foreach ($a in ($addrs ^| Select-Object -ExpandProperty IPAddress ^| Sort-Object)) { "ALL=$a" } >> "%PS_IP%"
echo $hs  = ($addrs ^| Where-Object { $_.IPAddress -like "192.168.137.*" } ^| Select-Object -First 1 -ExpandProperty IPAddress)  >> "%PS_IP%"
echo if ($hs)  { "HOTSPOT=$hs" }  >> "%PS_IP%"
echo $lan = ($addrs ^| Where-Object { $_.IPAddress -notmatch $skip -and $_.IPAddress -notlike "192.168.137.*" } ^| Sort-Object PrefixLength ^| Select-Object -First 1 -ExpandProperty IPAddress) >> "%PS_IP%"
echo if ($lan) { "LAN=$lan" }     >> "%PS_IP%"

echo         All IPv4 addresses found on this PC:
echo         -------------------------------------------------------
set "HOTSPOT_IP=" & set "LAN_IP="
for /f "delims=" %%L in ('powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_IP%"') do (
  set "LINE=%%L"
  if "!LINE:~0,8!"=="HOTSPOT=" set "HOTSPOT_IP=!LINE:~8!"
  if "!LINE:~0,4!"=="LAN="     set "LAN_IP=!LINE:~4!"
  if "!LINE:~0,4!"=="ALL="     echo           !LINE:~4!
)
del "%PS_IP%" >nul 2>&1
echo         -------------------------------------------------------
echo.

if defined HOTSPOT_IP (
  set "AUTO_IP=!HOTSPOT_IP!"
  echo         Auto-selected: Mobile Hotspot IP = !AUTO_IP!
) else if defined LAN_IP (
  set "AUTO_IP=!LAN_IP!"
  echo         Auto-selected: LAN / WiFi IP = !AUTO_IP!
) else (
  set "AUTO_IP="
  echo         Could not auto-detect a suitable PC IP ^(VM adapters skipped^).
)

if defined AUTO_IP (
  set "BACKEND_URL=http://!AUTO_IP!:3000/api"
  echo         Suggested backend: !BACKEND_URL!
  echo.
  echo         TIP: If the app shows a connection error, re-run and press Y
  echo              to enter the correct IP from the list above.
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
  goto :done
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
rd /s /q "!INT!\merged_res_blame_folder"           >nul 2>&1
rd /s /q "!INT!\assets\release\mergeReleaseAssets" >nul 2>&1
rd /s /q "!INT!\incremental\mergeReleaseResources" >nul 2>&1
rd /s /q "!INT!\stripped_native_libs"              >nul 2>&1
rd /s /q "%PROJECT_ROOT%\.dart_tool"               >nul 2>&1
echo         Locked build dirs cleared.

:: Suspend OneDrive during build - it intercepts Gradle temp files and causes
:: stripReleaseDebugSymbols to fail with "MD5 hash file does not exist".
set "ONEDRIVE_WAS_RUNNING=0"
tasklist /FI "IMAGENAME eq OneDrive.exe" 2>nul | findstr /i "OneDrive.exe" >nul 2>&1
if not errorlevel 1 set "ONEDRIVE_WAS_RUNNING=1"
tasklist /FI "IMAGENAME eq OneDrive.Sync.Service.exe" 2>nul | findstr /i "OneDrive" >nul 2>&1
if not errorlevel 1 set "ONEDRIVE_WAS_RUNNING=1"
if "!ONEDRIVE_WAS_RUNNING!"=="1" (
  echo         Killing OneDrive processes to prevent build interference...
  taskkill /F /IM OneDrive.exe              >nul 2>&1
  taskkill /F /IM OneDrive.Sync.Service.exe >nul 2>&1
  echo         OneDrive suspended for build.
  ping -n 3 127.0.0.1 >nul 2>&1
) else (
  echo         OneDrive not running - no action needed.
)

:: Remove the Windows ephemeral plugin_symlinks junction so flutter pub get
:: can recreate it cleanly (otherwise it prints a non-fatal warning every run).
powershell -NoProfile -ExecutionPolicy Bypass -Command "Remove-Item -Recurse -Force '!PROJECT_ROOT!\windows\flutter\ephemeral' -ErrorAction SilentlyContinue" >nul 2>&1

call flutter pub get
echo         Packages ready.

:: ===========================================================
:: STEP 5 - Build release APK
:: ===========================================================
call :build_apk
if errorlevel 1 (
  echo.
  echo  ============================================================
  echo    BUILD FAILED. Review the errors above.
  echo    Fix the issue and re-run this script.
  echo    Press Q to quit, or close this window directly.
  echo  ============================================================
  echo.
  call :wait_quit
  goto :done
)

:: ===========================================================
:: STEP 6 - Install + whitelist on ALL devices
:: ===========================================================
echo.
echo  [6/6] Installing APK on all devices...
echo.
call :install_all

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
        echo echo    SETU Mobile  --  Live Device Logs
        echo echo    Device !DEV_NUM! : %%A
        echo echo  ============================================================
        echo echo.
        echo adb -s %%A logcat -v time flutter:V FlutterMain:V FlutterActivity:V DartVM:D AndroidRuntime:E System.err:W *:S
        echo echo.
        echo echo  [Log stream ended -- window stays open, close it manually]
        echo del "%%~f0" ^>nul 2^>^&1
      ) > "!LOG_TEMP!"
      start "SETU Logs [Device !DEV_NUM! : %%A]" cmd /k "!LOG_TEMP!"
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
echo    Log windows are open for each device and stay open automatically.
echo    Close each log window manually when done.
echo.
echo  ============================================================
echo    QUICK REBUILD  ^(no wizard -- reuses same backend + devices^)
echo      R  =  Rebuild APK + Reinstall on all devices
echo      Q  =  Quit  ^(close this window^)
echo  ============================================================
echo.

:rebuild_loop
set "RK="
set /p "RK=  [R = Rebuild+Reinstall   /   Q = Quit]: "
if not defined RK goto :rebuild_loop
set "RK=!RK:~0,1!"
if /i "!RK!"=="Q" goto :done
if /i "!RK!"=="R" (
  echo.
  echo  -------------------------------------------------------------------
  echo    Quick Rebuild  ^(backend: !BACKEND_URL!^)
  echo  -------------------------------------------------------------------
  echo.
  call :build_apk
  if not errorlevel 1 (
    echo.
    echo  Installing on all devices...
    echo.
    call :install_all
    echo.
    echo  Rebuild complete.
    echo.
  ) else (
    echo.
    echo  ============================================================
    echo    BUILD FAILED - fix the issue then press R to try again.
    echo  ============================================================
    echo.
  )
  goto :rebuild_loop
)
:: Any other key - show menu again
goto :rebuild_loop

:done
echo.
echo  ============================================================
echo    Done. Close this window with the X button when finished.
echo  ============================================================
echo.
goto :eof

:: ===========================================================
:: SUBROUTINE: Wait for Q key (used after build failure)
:: ===========================================================
:wait_quit
set "EK="
set /p "EK=  [Q = Quit / close window to exit]: "
if not defined EK goto :wait_quit
set "EK=!EK:~0,1!"
if /i not "!EK!"=="Q" goto :wait_quit
exit /b 0

:: ===========================================================
:: SUBROUTINE: Build APK with animated progress bar
:: ===========================================================
:build_apk
echo.
echo  ============================================================
echo  [5/6] Building release APK...
echo  ============================================================
echo.
echo         Target  : android-arm64  (release)
echo         Backend : !BACKEND_URL!
echo         Started : %DATE%  %TIME%
echo         Tip     : First build 3-8 min / Rebuild 1-3 min
echo.

:: Delete build cache directly so --dart-define changes (new IP) are baked in.
:: flutter clean fails on this machine because Windows locks the
:: windows\flutter\ephemeral\.plugin_symlinks junction; it exits before
:: clearing the Dart kernel cache, so the old IP stays.
:: Deleting build\ and .dart_tool\flutter_build\ is sufficient: Flutter MUST
:: recompile the Dart kernel and re-run Gradle from scratch.
echo         Removing build cache (ensures new IP is baked in)...
set "SETU_CLEAN_PS=%TEMP%\setu_clean_%RANDOM%.ps1"
echo $b = '!PROJECT_ROOT!\build'                    > "!SETU_CLEAN_PS!"
echo $d = '!PROJECT_ROOT!\.dart_tool\flutter_build' >> "!SETU_CLEAN_PS!"
echo if (Test-Path $b) { Remove-Item $b -Recurse -Force -ErrorAction SilentlyContinue } >> "!SETU_CLEAN_PS!"
echo if (Test-Path $d) { Remove-Item $d -Recurse -Force -ErrorAction SilentlyContinue } >> "!SETU_CLEAN_PS!"
powershell -NoProfile -ExecutionPolicy Bypass -File "!SETU_CLEAN_PS!" 2>nul
del "!SETU_CLEAN_PS!" >nul 2>&1
echo         Cache removed.
echo.

set "MONITOR=%~dp0_build_monitor.ps1"
flutter build apk --release --target-platform android-arm64 --split-debug-info=build\debug-info --dart-define=SETU_BASE_URL=!BACKEND_URL! 2>&1 | powershell -NoProfile -ExecutionPolicy Bypass -File "!MONITOR!"
set "BUILD_EXIT=!ERRORLEVEL!"

:: Restart OneDrive if it was running before we suspended it
if "!ONEDRIVE_WAS_RUNNING!"=="1" (
  if exist "%LOCALAPPDATA%\Microsoft\OneDrive\OneDrive.exe" (
    start "" "%LOCALAPPDATA%\Microsoft\OneDrive\OneDrive.exe"
  ) else (
    start "" "C:\Program Files\Microsoft OneDrive\OneDrive.exe"
  )
  echo         OneDrive restarted.
)

echo.

set "APK_PATH=%PROJECT_ROOT%\build\app\outputs\flutter-apk\app-release.apk"

if not exist "!APK_PATH!" (
  echo.
  echo  ============================================================
  echo    BUILD FAILED  -  APK not found. Check error lines above.
  echo  ============================================================
  echo.
  exit /b 1
)

:: Show APK file size
set "APK_SIZE_KB=0"
for %%F in ("!APK_PATH!") do set "APK_SIZE_KB=%%~zF"
set /a "APK_SIZE_MB=!APK_SIZE_KB! / 1048576"
set /a "APK_SIZE_KB_REM=(!APK_SIZE_KB! %% 1048576) / 104858"
echo.
echo  ============================================================
echo    BUILD SUCCESSFUL
echo  ============================================================
echo    APK  : !APK_PATH!
echo    Size : !APK_SIZE_MB!.!APK_SIZE_KB_REM! MB
echo  ============================================================
echo.
exit /b 0

:: ===========================================================
:: SUBROUTINE: Install APK + whitelist on ALL connected devices
:: ===========================================================
:install_all
echo  ============================================================
echo    INSTALLATION LOG
echo  ============================================================
echo.

set "DEVICE_NUM=0"
set "INSTALL_OK=0"
set "INSTALL_FAIL=0"

for /f "skip=1 tokens=1,2" %%A in ('adb devices 2^>nul') do (
  if not "%%A"=="" if not "%%B"=="" if not "%%B"=="List" (
    set "SKIP=0"
    echo %%A | findstr /b "emulator-" >nul 2>&1 && set "SKIP=1"
    if /i "%%B"=="offline"       set "SKIP=1"
    if /i "%%B"=="unauthorized"  set "SKIP=1"
    echo %%A | findstr /r "[0-9]*\.[0-9]*\.[0-9]*\.[0-9]*" >nul 2>&1 && set "SKIP=1"
    if "!SKIP!"=="0" (
      set /a "DEVICE_NUM+=1"

      :: Get device model name
      set "DEV_MODEL="
      for /f "delims=" %%M in ('adb -s %%A shell getprop ro.product.model 2^>nul') do (
        if not defined DEV_MODEL set "DEV_MODEL=%%M"
      )
      set "DEV_BRAND="
      for /f "delims=" %%G in ('adb -s %%A shell getprop ro.product.brand 2^>nul') do (
        if not defined DEV_BRAND set "DEV_BRAND=%%G"
      )
      if defined DEV_MODEL (
        echo   [Device !DEVICE_NUM!] Serial : %%A
        echo   [Device !DEVICE_NUM!] Model  : !DEV_BRAND! !DEV_MODEL!
      ) else (
        echo   [Device !DEVICE_NUM!] Serial : %%A
      )

      :: Get Android version
      set "DEV_ANDROID="
      for /f "delims=" %%V in ('adb -s %%A shell getprop ro.build.version.release 2^>nul') do (
        if not defined DEV_ANDROID set "DEV_ANDROID=%%V"
      )
      if defined DEV_ANDROID echo   [Device !DEVICE_NUM!] Android: !DEV_ANDROID!

      echo   [Device !DEVICE_NUM!] Status : Installing APK ^(!APK_SIZE_MB!.!APK_SIZE_KB_REM! MB^)...
      echo.

      adb -s %%A install -r "!APK_PATH!"
      set "INST_ERR=!ERRORLEVEL!"

      echo.
      if "!INST_ERR!"=="0" (
        echo   [Device !DEVICE_NUM!] RESULT  : SUCCESS ✓
        set /a "INSTALL_OK+=1"

        :: Get app UID and apply network whitelists
        set "APP_UID="
        for /f "tokens=2 delims=:=" %%U in ('adb -s %%A shell "pm list packages --uid 2>/dev/null | grep setu_mobile" 2^>nul') do (
          set "APP_UID=%%U"
          set "APP_UID=!APP_UID: =!"
        )
        if defined APP_UID (
          echo   [Device !DEVICE_NUM!] App UID: !APP_UID!
          echo   [Device !DEVICE_NUM!] Network: Applying background whitelist...
          adb -s %%A shell "cmd netpolicy add restrict-background-whitelist !APP_UID!" >nul 2>&1
          adb -s %%A shell "cmd netpolicy add app-idle-whitelist !APP_UID!" >nul 2>&1
          adb -s %%A shell "am set-standby-bucket com.example.setu_mobile active" >nul 2>&1
          echo   [Device !DEVICE_NUM!] Network: Whitelist applied ^(UID !APP_UID!^)
        ) else (
          echo   [Device !DEVICE_NUM!] Network: WARNING - Could not auto-whitelist.
          echo                          Manual fix: Settings -^> Apps -^> SETU Mobile -^> Battery -^> Unrestricted
        )

        :: Launch the app
        echo   [Device !DEVICE_NUM!] Launch : Starting SETU Mobile...
        adb -s %%A shell "monkey -p com.example.setu_mobile -c android.intent.category.LAUNCHER 1" >nul 2>&1
        echo   [Device !DEVICE_NUM!] Launch : Done
      ) else (
        echo   [Device !DEVICE_NUM!] RESULT  : FAILED  ✗  ^(adb exit !INST_ERR!^)
        echo   [Device !DEVICE_NUM!] Check   : Device screen may be locked or USB debug revoked.
        set /a "INSTALL_FAIL+=1"
      )
      echo.
      echo  ------------------------------------------------------------
      echo.
    )
  )
)

echo  ============================================================
echo    INSTALL SUMMARY  :  !INSTALL_OK! succeeded  /  !INSTALL_FAIL! failed  /  !DEVICE_NUM! total
echo  ============================================================
echo.
exit /b 0
