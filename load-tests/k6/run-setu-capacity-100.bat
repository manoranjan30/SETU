@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem SETU local capacity test launcher.
rem Runs k6 from this Windows machine against the SETU server in 5 VU steps up to 100 VUs.
rem If SSH key login is available, it also collects server CPU/RAM/Docker metrics.

set "SCRIPT_DIR=%~dp0"
set "REPO_ROOT=%SCRIPT_DIR%..\.."
for %%I in ("%REPO_ROOT%") do set "REPO_ROOT=%%~fI"
set "LAUNCH_LOG=%SCRIPT_DIR%capacity-launcher-last.log"
echo SETU capacity launcher started at %DATE% %TIME% > "%LAUNCH_LOG%"
echo Script dir: %SCRIPT_DIR% >> "%LAUNCH_LOG%"
echo Repo root: %REPO_ROOT% >> "%LAUNCH_LOG%"

set "OPENSSH_DIR=%SystemRoot%\System32\OpenSSH"
if exist "%OPENSSH_DIR%\ssh.exe" (
  set "PATH=%PATH%;%OPENSSH_DIR%"
)

echo.
echo ============================================================
echo SETU Capacity Step Test - 5 VU steps up to 100 VUs
echo ============================================================
echo.
echo This runs from your local Windows machine and stores reports under:
echo %SCRIPT_DIR%reports
echo.
echo Do not paste server passwords into chat. This launcher will use SSH
echo only if Windows can login without an interactive password prompt.
echo.
echo Diagnostic log:
echo %LAUNCH_LOG%
echo.

where powershell >> "%LAUNCH_LOG%" 2>>&1
if errorlevel 1 (
  echo ERROR: powershell was not found in PATH.
  echo ERROR: powershell was not found in PATH. >> "%LAUNCH_LOG%"
  goto :fail
)

where node >> "%LAUNCH_LOG%" 2>>&1
if errorlevel 1 (
  echo ERROR: node was not found in PATH. Install Node.js or open a terminal where node works.
  echo ERROR: node was not found in PATH. >> "%LAUNCH_LOG%"
  goto :fail
)

set "LOCAL_K6=%SCRIPT_DIR%tools\k6\current\k6.exe"
where k6 >> "%LAUNCH_LOG%" 2>>&1
if errorlevel 1 (
  if exist "%LOCAL_K6%" (
    set "PATH=%PATH%;%SCRIPT_DIR%tools\k6\current"
    echo Using local k6: %LOCAL_K6%
    echo Using local k6: %LOCAL_K6% >> "%LAUNCH_LOG%"
  ) else (
    echo k6 was not found in PATH. Bootstrapping local k6...
    echo k6 was not found in PATH. Bootstrapping local k6... >> "%LAUNCH_LOG%"
    powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\bootstrap-k6.ps1" >> "%LAUNCH_LOG%" 2>>&1
    if errorlevel 1 (
      echo ERROR: k6 bootstrap failed.
      echo Check diagnostic log:
      echo %LAUNCH_LOG%
      echo ERROR: k6 bootstrap failed. >> "%LAUNCH_LOG%"
      goto :fail
    )
    if exist "%LOCAL_K6%" (
      set "PATH=%PATH%;%SCRIPT_DIR%tools\k6\current"
      echo Local k6 installed: %LOCAL_K6%
      echo Local k6 installed: %LOCAL_K6% >> "%LAUNCH_LOG%"
    ) else (
      echo ERROR: bootstrap completed but k6.exe was not found at:
      echo %LOCAL_K6%
      echo ERROR: bootstrap completed but k6.exe was not found. >> "%LAUNCH_LOG%"
      goto :fail
    )
  )
)

set "BASE_URL=http://202.21.35.57"
set "APP_USERNAME=admin"
set "APP_PASSWORD=password123"
set "PROJECT_ID=7"
set "COMPANY_ID=1"
set "ACTIVITY_ID=1967"
set "EPS_NODE_ID=410"
set "START_VUS=5"
set "END_VUS=100"
set "STEP_VUS=5"
set "DURATION_SECONDS=300"
set "SAMPLE_INTERVAL_SECONDS=10"
set "SCENARIO_SET=dashboard,progress-read,planning-read,design-read"
set "SSH_TARGET=root@202.21.35.57"

echo Defaults:
echo   Base URL:     %BASE_URL%
echo   Project ID:   %PROJECT_ID%
echo   Company ID:   %COMPANY_ID%
echo   VUs:          %START_VUS% to %END_VUS% by %STEP_VUS%
echo   Duration:     %DURATION_SECONDS% seconds per step
echo   Scenarios:    %SCENARIO_SET%
echo.

set /p "INPUT=Base URL [%BASE_URL%]: "
if not "%INPUT%"=="" set "BASE_URL=%INPUT%"

set /p "INPUT=SETU username [%APP_USERNAME%]: "
if not "%INPUT%"=="" set "APP_USERNAME=%INPUT%"

set /p "INPUT=SETU password [%APP_PASSWORD%]: "
if not "%INPUT%"=="" set "APP_PASSWORD=%INPUT%"

set /p "INPUT=Project ID [%PROJECT_ID%]: "
if not "%INPUT%"=="" set "PROJECT_ID=%INPUT%"

set /p "INPUT=Company ID [%COMPANY_ID%]: "
if not "%INPUT%"=="" set "COMPANY_ID=%INPUT%"

set /p "INPUT=Activity ID for progress scenario [%ACTIVITY_ID%]: "
if not "%INPUT%"=="" set "ACTIVITY_ID=%INPUT%"

set /p "INPUT=EPS node ID for progress scenario [%EPS_NODE_ID%]: "
if not "%INPUT%"=="" set "EPS_NODE_ID=%INPUT%"

set /p "INPUT=End VUs [%END_VUS%]: "
if not "%INPUT%"=="" set "END_VUS=%INPUT%"

set /p "INPUT=Duration seconds per step [%DURATION_SECONDS%]: "
if not "%INPUT%"=="" set "DURATION_SECONDS=%INPUT%"

set /p "INPUT=SSH target for server metrics [%SSH_TARGET%]: "
if not "%INPUT%"=="" set "SSH_TARGET=%INPUT%"

set "USE_SERVER_METRICS=0"
where ssh >nul 2>nul
if not errorlevel 1 (
  echo.
  echo Checking SSH non-interactive access to %SSH_TARGET% ...
  echo Checking SSH non-interactive access to %SSH_TARGET% ... >> "%LAUNCH_LOG%"
  ssh -o BatchMode=yes -o ConnectTimeout=8 "%SSH_TARGET%" "hostname && docker stats --no-stream setu_app setu_postgres" >> "%LAUNCH_LOG%" 2>>&1
  if not errorlevel 1 (
    set "USE_SERVER_METRICS=1"
    echo SSH server metrics: ENABLED
    echo SSH server metrics: ENABLED >> "%LAUNCH_LOG%"
  ) else (
    echo SSH server metrics: SKIPPED
    echo Reason: SSH needs an interactive password or key login is not configured.
    echo SSH server metrics: SKIPPED >> "%LAUNCH_LOG%"
  )
) else (
  echo SSH server metrics: SKIPPED
  echo Reason: ssh.exe was not found.
  echo SSH server metrics: SKIPPED - ssh.exe not found. >> "%LAUNCH_LOG%"
)

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "RUN_TS=%%I"
set "OUTPUT_ROOT=%SCRIPT_DIR%reports\capacity-auto-%RUN_TS%"
if not exist "%OUTPUT_ROOT%" mkdir "%OUTPUT_ROOT%"

echo.
echo Starting capacity test...
echo Output folder: %OUTPUT_ROOT%
echo.

if "%USE_SERVER_METRICS%"=="1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%run-capacity-step-test.ps1" -BaseUrl "%BASE_URL%" -Username "%APP_USERNAME%" -Password "%APP_PASSWORD%" -ProjectId "%PROJECT_ID%" -CompanyId "%COMPANY_ID%" -ActivityId "%ACTIVITY_ID%" -EpsNodeId "%EPS_NODE_ID%" -StartVus %START_VUS% -EndVus %END_VUS% -StepVus %STEP_VUS% -DurationSeconds %DURATION_SECONDS% -SampleIntervalSeconds %SAMPLE_INTERVAL_SECONDS% -ScenarioSet "%SCENARIO_SET%" -OutputRoot "%OUTPUT_ROOT%" -SkipPdf -SshTarget "%SSH_TARGET%" > "%OUTPUT_ROOT%\capacity-run-console.log" 2>&1
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%run-capacity-step-test.ps1" -BaseUrl "%BASE_URL%" -Username "%APP_USERNAME%" -Password "%APP_PASSWORD%" -ProjectId "%PROJECT_ID%" -CompanyId "%COMPANY_ID%" -ActivityId "%ACTIVITY_ID%" -EpsNodeId "%EPS_NODE_ID%" -StartVus %START_VUS% -EndVus %END_VUS% -StepVus %STEP_VUS% -DurationSeconds %DURATION_SECONDS% -SampleIntervalSeconds %SAMPLE_INTERVAL_SECONDS% -ScenarioSet "%SCENARIO_SET%" -OutputRoot "%OUTPUT_ROOT%" -SkipPdf -SkipServerMetrics > "%OUTPUT_ROOT%\capacity-run-console.log" 2>&1
)

set "EXIT_CODE=%ERRORLEVEL%"
echo PowerShell capacity runner exit code: %EXIT_CODE% >> "%LAUNCH_LOG%"

if exist "%OUTPUT_ROOT%\capacity-run-console.log" (
  type "%OUTPUT_ROOT%\capacity-run-console.log"
)

echo.
echo ============================================================
if "%EXIT_CODE%"=="0" (
  echo Capacity test completed.
) else (
  echo Capacity test finished with exit code %EXIT_CODE%.
)
echo.
echo Main report:
echo %OUTPUT_ROOT%\capacity-step-report.md
echo.
echo Raw result JSON:
echo %OUTPUT_ROOT%\capacity-step-results.json
echo ============================================================
echo.
pause
exit /b %EXIT_CODE%

:fail
echo.
echo ============================================================
echo Launcher failed before the capacity test started.
echo Diagnostic log:
echo %LAUNCH_LOG%
echo ============================================================
echo.
pause
exit /b 1
