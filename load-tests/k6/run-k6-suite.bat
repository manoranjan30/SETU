@echo off
setlocal enabledelayedexpansion
title SETU Load Test Runner

set "SCRIPT_DIR=%~dp0"
set "ENV_FILE=%SCRIPT_DIR%.env"

echo.
echo ============================================
echo   SETU Load Test Runner
echo ============================================
echo.

if exist "%ENV_FILE%" (
  echo Loading environment from:
  echo   %ENV_FILE%
  for /f "usebackq tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
    if not "%%A"=="" (
      if not "%%A:~0,1%"=="#" (
        set "%%A=%%B"
      )
    )
  )
) else (
  echo No .env file found. Using defaults from PowerShell runner.
)

if "%BASE_URL%"=="" set "BASE_URL=http://localhost:3000"
if "%K6_USERNAME%"=="" set "K6_USERNAME=admin"
if "%K6_PASSWORD%"=="" set "K6_PASSWORD=admin"
if "%PROJECT_ID%"=="" set "PROJECT_ID=2"
if "%COMPANY_ID%"=="" set "COMPANY_ID=1"
if "%ACTIVITY_ID%"=="" set "ACTIVITY_ID=1967"
if "%EPS_NODE_ID%"=="" set "EPS_NODE_ID=410"
if "%SCENARIO_SET%"=="" set "SCENARIO_SET=core-read"

echo Effective configuration:
echo   BASE_URL=%BASE_URL%
echo   K6_USERNAME=%K6_USERNAME%
echo   PROJECT_ID=%PROJECT_ID%
echo   COMPANY_ID=%COMPANY_ID%
echo   ACTIVITY_ID=%ACTIVITY_ID%
echo   EPS_NODE_ID=%EPS_NODE_ID%
echo   SCENARIO_SET=%SCENARIO_SET%
echo.
echo Note: BASE_URL must be the BACKEND URL, for example http://localhost:3000
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%run-k6-suite.ps1" ^
  -BaseUrl "%BASE_URL%" ^
  -Username "%K6_USERNAME%" ^
  -Password "%K6_PASSWORD%" ^
  -ProjectId "%PROJECT_ID%" ^
  -CompanyId "%COMPANY_ID%" ^
  -ActivityId "%ACTIVITY_ID%" ^
  -EpsNodeId "%EPS_NODE_ID%" ^
  -ScenarioSet "%SCENARIO_SET%"

set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" (
  echo Runner failed with exit code %EXIT_CODE%.
  echo Please read the messages above.
  pause
  exit /b %EXIT_CODE%
)

echo Runner completed successfully.
pause
endlocal
