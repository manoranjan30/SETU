@echo off
setlocal

:: ============================================================
:: SETU Mobile App - One-Click Live Preview
:: ============================================================
:: Usage:
::   15_live_preview.bat
::   15_live_preview.bat emulator-5554
:: ============================================================

for %%I in ("%~dp0..") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"

:: Ensure Flutter is available
flutter --version >nul 2>&1
if errorlevel 1 (
  if exist "C:\flutter\flutter\bin\flutter.bat" (
    set "PATH=%PATH%;C:\flutter\flutter\bin"
  ) else (
    echo [ERROR] Flutter not found in PATH.
    echo Install Flutter or add flutter\bin to PATH.
    pause
    exit /b 1
  )
)

echo.
echo ================================================
echo   SETU Live Preview (Debug + Hot Reload)
echo ================================================
echo Project: %PROJECT_ROOT%
echo.
echo Hot reload controls once app starts:
echo   r = hot reload
echo   R = hot restart
echo   q = quit
echo.

:: Keep dependencies in sync quickly
flutter pub get >nul
if errorlevel 1 (
  echo [ERROR] flutter pub get failed.
  pause
  exit /b 1
)

if not "%~1"=="" (
  echo Starting on device: %~1
  flutter run -d %~1
  goto :done
)

echo Connected devices:
flutter devices
echo.
echo Starting on first available device...
flutter run

:done
echo.
echo Live preview ended.
pause

