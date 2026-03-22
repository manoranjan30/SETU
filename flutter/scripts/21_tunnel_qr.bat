@echo off
:: Self-wrap so the window stays open on any error
if not "%SETU_RUNNING%"=="1" (
  set "SETU_RUNNING=1"
  cmd /k ""%~f0" %*"
  exit /b
)
chcp 65001 >nul
setlocal EnableDelayedExpansion
title SETU - Cloudflare Tunnel + APK Upload + QR

:: ============================================================
::  Usage:
::    21_tunnel_qr.bat          ->  full run
::    21_tunnel_qr.bat tunnel   ->  tunnel + QR only
::    21_tunnel_qr.bat upload   ->  upload + QR only
::    21_tunnel_qr.bat stop     ->  kill cloudflared
:: ============================================================

for %%I in ("%~dp0..") do set "PROJECT_ROOT=%%~fI"

set "CFLOG=%TEMP%\setu_cf_tunnel.log"
set "CFERR=%TEMP%\setu_cf_stderr.log"
set "CFURL_PS=%TEMP%\setu_cf_url.ps1"
set "APK_TEMP=%TEMP%\setu_mobile_latest.apk"
set "APK_SRC=%PROJECT_ROOT%\build\app\outputs\flutter-apk\app-release.apk"
set "QR_BIN=%APPDATA%\npm\node_modules\qrcode-terminal\bin\qrcode-terminal.js"

set "DO_TUNNEL=1"
set "DO_UPLOAD=1"
:: Pipe character via delayed expansion - avoids cmd parse-time pipe interpretation
set "P=|"
if /i "%~1"=="tunnel" set "DO_UPLOAD=0"
if /i "%~1"=="upload" set "DO_TUNNEL=0"

if /i "%~1"=="stop" (
  echo Stopping cloudflared...
  taskkill /im cloudflared.exe /f >nul 2>&1
  echo Done.
  exit /b 0
)

cls
echo.
echo  ============================================================
echo    SETU Mobile - Cloudflare Tunnel + APK Upload + QR Codes
echo  ============================================================
echo    Phone --^> Cloudflare Edge --^> localhost:3000
echo  ============================================================
echo.
echo  Checking prerequisites...
echo.

:: ---- cloudflared check (goto-based, avoids compound block paren issues)
if "!DO_TUNNEL!"=="0" goto :skip_cf_check
where cloudflared >nul 2>&1
if not errorlevel 1 goto :cf_ok
echo  [X] cloudflared not found.
echo      Install:  winget install cloudflare.cloudflared
pause & exit /b 1
:cf_ok
for /f "tokens=*" %%V in ('cloudflared --version 2^>^&1') do if not defined CF_VER set "CF_VER=%%V"
echo  [OK] cloudflared  !CF_VER!
:skip_cf_check

:: ---- Node.js check
where node >nul 2>&1
if not errorlevel 1 goto :node_ok
echo  [X] Node.js not found - required for QR rendering.
echo      Install: https://nodejs.org
pause & exit /b 1
:node_ok
for /f "tokens=*" %%V in ('node --version 2^>^&1') do set "NODE_VER=%%V"
echo  [OK] Node.js  !NODE_VER!

:: ---- curl check
where curl >nul 2>&1
if not errorlevel 1 goto :curl_ok
echo  [X] curl not found - required for APK upload.
pause & exit /b 1
:curl_ok
echo  [OK] curl

:: ---- Backend health check
powershell -NoProfile -Command "try { $null = Invoke-WebRequest 'http://localhost:3000/api' -TimeoutSec 3 -UseBasicParsing; Write-Host '  [OK] Backend on :3000' } catch { Write-Host '  [!!] Backend not on :3000 -- start NestJS before testing' }"
echo.


:: ============================================================
::  SECTION 2 - Cloudflare Tunnel + QR
:: ============================================================
set "TUNNEL_URL="
if "!DO_TUNNEL!"=="0" goto :skip_tunnel

:: Kill leftover cloudflared
tasklist /fi "imagename eq cloudflared.exe" /fo csv 2>nul | findstr /i "cloudflared" >nul
if errorlevel 1 goto :cf_start
echo  Stopping previous cloudflared session...
taskkill /im cloudflared.exe /f >nul 2>&1
timeout /t 2 /nobreak >nul

:cf_start
echo  Starting Cloudflare Quick Tunnel...
echo  Waiting for URL  (10-30 s)...
echo.

if exist "!CFLOG!" del "!CFLOG!"
if exist "!CFERR!" del "!CFERR!"

(echo $pattern = 'https://[a-z0-9-]+\.trycloudflare\.com')     >  "!CFURL_PS!"
(echo $logs = '!CFLOG!', '!CFERR!')                            >> "!CFURL_PS!"
(echo foreach ($f in $logs^) {)                                 >> "!CFURL_PS!"
(echo   if (Test-Path $f^) {)                                   >> "!CFURL_PS!"
(echo     $m = (Get-Content $f -EA SilentlyContinue^) !P! Select-String -Pattern $pattern) >> "!CFURL_PS!"
(echo     if ($m^) { $m.Matches[0].Value; exit })               >> "!CFURL_PS!"
(echo   })                                                      >> "!CFURL_PS!"
(echo })                                                        >> "!CFURL_PS!"

powershell -NoProfile -Command "Start-Process cloudflared -ArgumentList @('tunnel','--url','http://localhost:3000') -RedirectStandardOutput '!CFLOG!' -RedirectStandardError '!CFERR!' -NoNewWindow"

<nul set /p "  ["
set /a WAITS=0

:wait_url
set /a WAITS+=1
if !WAITS! gtr 30 goto :tunnel_timeout
timeout /t 2 /nobreak >nul
<nul set /p "="
for /f "tokens=*" %%U in ('powershell -NoProfile -File "!CFURL_PS!" 2^>nul') do set "TUNNEL_URL=%%U"
if "!TUNNEL_URL!"=="" goto :wait_url

:: Append /api so the QR gives Dio the correct NestJS base URL directly
set "TUNNEL_API_URL=!TUNNEL_URL!/api"

echo ]
echo.
echo  ============================================================
echo   [1/2] TUNNEL ACTIVE
echo   !TUNNEL_URL!
echo  ============================================================
echo.
echo  Generating tunnel QR...
echo.
call :print_qr "!TUNNEL_API_URL!"
echo.
echo  ============================================================
echo    TUNNEL URL:  !TUNNEL_API_URL!
echo  ============================================================
echo.
echo    In SETU app:
echo    1. Login screen --^> tap [settings] icon (top-right)
echo    2. Select "Cloudflare Tunnel" preset
echo    3. Tap the [QR] button --^> scan the code above
echo    4. "Test Connection" --^> "Connect"
echo.

:skip_tunnel

:: ============================================================
::  SECTION 3 - APK Upload + QR
:: ============================================================
if "!DO_UPLOAD!"=="0" goto :keep_alive

echo  ============================================================
echo   [2/2] APK UPLOAD
echo  ============================================================
echo.

if exist "!APK_SRC!" goto :apk_found
echo  [!!] No APK found at:
echo       build\app\outputs\flutter-apk\app-release.apk
echo.
echo       Build first:   flutter build apk
goto :keep_alive

:apk_found
for %%F in ("!APK_SRC!") do set APK_BYTES=%%~zF
set /a APK_MB=!APK_BYTES! / 1048576
echo  [OK] APK found  !APK_MB! MB
echo.

echo  Copying APK to temp...
copy /y "!APK_SRC!" "!APK_TEMP!" >nul 2>&1
if not errorlevel 1 goto :apk_copied
echo  [X] Could not copy APK to temp. Check disk space.
goto :keep_alive

:apk_copied
echo  Uploading APK - please wait  !APK_MB! MB  (up to 10 min per host)
echo.

set "APK_URL="
set "UP_RESP=%TEMP%\setu_upload_resp.txt"
set "GF_JSON=%TEMP%\setu_gofile.json"

:: Host 1: catbox.moe - 200MB permanent direct link
echo  [1/4] catbox.moe  (permanent)...
curl.exe --progress-bar --max-time 600 -F "reqtype=fileupload" -F "fileToUpload=@!APK_TEMP!" https://catbox.moe/user/api.php > "!UP_RESP!" 2>con
echo.
set "APK_URL="
if exist "!UP_RESP!" set /p APK_URL= < "!UP_RESP!"
echo !APK_URL! | findstr /r "^https://" >nul 2>&1
if not errorlevel 1 goto :upload_done
echo  [catbox] Response: !APK_URL!
echo  failed.
set "APK_URL="

:: Host 2: litterbox - 1GB 72h expiry
echo  [2/4] litterbox  (72h link)...
curl.exe --progress-bar --max-time 600 -F "reqtype=fileupload" -F "time=72h" -F "fileToUpload=@!APK_TEMP!" https://litterbox.catbox.moe/resources/internals/api.php > "!UP_RESP!" 2>con
echo.
set "APK_URL="
if exist "!UP_RESP!" set /p APK_URL= < "!UP_RESP!"
echo !APK_URL! | findstr /r "^https://" >nul 2>&1
if not errorlevel 1 goto :upload_done
echo  [litterbox] Response: !APK_URL!
echo  failed.
set "APK_URL="

:: Host 3: gofile.io - unlimited permanent
:: Use PowerShell -InputObject to parse JSON without a pipe char
echo  [3/4] gofile.io  (permanent)...
curl.exe --progress-bar --max-time 600 -F "file=@!APK_TEMP!" https://store1.gofile.io/uploadFile > "!GF_JSON!" 2>con
echo.
set "APK_URL="
if exist "!GF_JSON!" (
  powershell -NoProfile -Command "try{$j=[IO.File]::ReadAllText('!GF_JSON!');$u=(ConvertFrom-Json -InputObject $j).data.downloadPage;if($u){[IO.File]::WriteAllText('!UP_RESP!',$u.Trim())}}catch{}" 2>nul
  if exist "!UP_RESP!" set /p APK_URL= < "!UP_RESP!"
)
echo !APK_URL! | findstr /r "^https://" >nul 2>&1
if not errorlevel 1 goto :upload_done
echo  [gofile] Response:
if exist "!GF_JSON!" type "!GF_JSON!"
echo.
echo  failed.
set "APK_URL="

:: Host 4: 0x0.st
echo  [4/4] 0x0.st...
curl.exe --progress-bar --max-time 600 -F "file=@!APK_TEMP!" https://0x0.st > "!UP_RESP!" 2>con
echo.
set "APK_URL="
if exist "!UP_RESP!" set /p APK_URL= < "!UP_RESP!"
echo !APK_URL! | findstr /r "^https://" >nul 2>&1
if not errorlevel 1 goto :upload_done
echo  [0x0.st] Response: !APK_URL!
echo  failed.
set "APK_URL="

del "!APK_TEMP!" >nul 2>&1
del "!GF_JSON!" >nul 2>&1
del "!UP_RESP!" >nul 2>&1
goto :upload_failed

:upload_done
del "!APK_TEMP!" >nul 2>&1
del "!GF_JSON!" >nul 2>&1
del "!UP_RESP!" >nul 2>&1

if "!APK_URL!"=="" goto :upload_failed
echo.
echo  ============================================================
echo   APK UPLOAD COMPLETE
echo   !APK_URL!
echo  ============================================================
echo.
echo  Generating download QR...
echo.
call :print_qr "!APK_URL!"
echo.
echo  ============================================================
echo    DOWNLOAD URL:  !APK_URL!
echo  ============================================================
echo.
echo    On your phone:
echo    1. Scan QR above --^> browser downloads setu_mobile.apk
echo    2. Settings --^> Apps --^> Install unknown apps --^> allow browser
echo    3. Open the downloaded file to install
echo.
goto :keep_alive

:upload_failed
echo  [X] All upload hosts failed.
echo      Share manually:  adb install -r "!APK_SRC!"
echo.


:: ============================================================
::  SECTION 4 - Summary + Keep-alive
:: ============================================================
:keep_alive
echo  ============================================================
if defined TUNNEL_API_URL echo   TUNNEL : !TUNNEL_API_URL!
if defined APK_URL    echo   APK    : !APK_URL!
echo.
echo   Tunnel running.  Press Ctrl+C to stop.
echo  ============================================================
echo.

:alive_loop
timeout /t 20 /nobreak >nul
if "!DO_TUNNEL!"=="0" goto :alive_loop
tasklist /fi "imagename eq cloudflared.exe" /fo csv 2>nul | findstr /i "cloudflared" >nul
if errorlevel 1 (
  echo.
  echo  [!] Tunnel stopped unexpectedly. Re-run to get a new URL.
  echo.
  pause & exit /b 1
)
goto :alive_loop


:: ============================================================
::  SUBROUTINE: print_qr <url>
:: ============================================================
:print_qr
set "_QR_URL=%~1"
if exist "!QR_BIN!" (
  node "!QR_BIN!" "!_QR_URL!"
) else (
  where qrcode-terminal >nul 2>&1
  if not errorlevel 1 (
    qrcode-terminal "!_QR_URL!"
  ) else (
    echo  (downloading qrcode-terminal via npx...)
    npx --yes qrcode-terminal "!_QR_URL!" 2>nul
  )
)
goto :eof


:: ============================================================
::  Tunnel timeout
:: ============================================================
:tunnel_timeout
echo ]
echo.
echo  [X] Timed out waiting for tunnel URL (60 s).
echo.
echo  Common causes:
echo    - cloudflared not installed correctly
echo    - No internet connection on this PC
echo    - Cloudflare rate-limited  (wait 1 min and retry)
echo.
echo  Raw cloudflared output:
echo  ------------------------------------------------------------
type "!CFLOG!" 2>nul
type "!CFERR!" 2>nul
echo  ------------------------------------------------------------
echo.
pause & exit /b 1
