@echo off
setlocal enabledelayedexpansion

echo ============================================
echo   SETU Flutter App - Android APK Build
echo ============================================
echo.

REM Change to flutter directory
cd /d "%~dp0"

REM Set Flutter path
set "FLUTTER_PATH=C:\flutter\flutter\bin"
set "PATH=%PATH%;%FLUTTER_PATH%"

echo [Step 1] Accepting Android Licenses...
echo Please press 'y' and Enter for each license prompt.
echo.
call "%FLUTTER_PATH%\flutter.bat" doctor --android-licenses

echo.
echo [Step 2] Getting Dependencies...
echo.
call "%FLUTTER_PATH%\flutter.bat" pub get
if errorlevel 1 (
    echo ERROR: Failed to get dependencies
    pause
    exit /b 1
)

echo.
echo [Step 3] Running Code Generation (Drift Database)...
echo.
call "%FLUTTER_PATH%\dart.bat" run build_runner build --delete-conflicting-outputs
if errorlevel 1 (
    echo WARNING: Code generation had issues, continuing...
)

echo.
echo [Step 4] Bumping build number in pubspec.yaml...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$f = Resolve-Path '..\pubspec.yaml';" ^
  "$c = [IO.File]::ReadAllText($f);" ^
  "if ($c -match 'version:\s*(\d+\.\d+\.\d+)\+(\d+)') {" ^
    "$ver = $Matches[1]; $build = [int]$Matches[2] + 1;" ^
    "$c = $c -replace 'version:\s*\d+\.\d+\.\d+\+\d+', \"version: $ver+$build\";" ^
    "[IO.File]::WriteAllText($f, $c);" ^
    "Write-Host \"  pubspec.yaml updated: version $ver+$build\" -ForegroundColor Green" ^
  "} else {" ^
    "Write-Warning 'Could not find version line in pubspec.yaml — build number NOT incremented'" ^
  "}"
if errorlevel 1 (
    echo WARNING: Build number bump failed, continuing with existing version...
)

echo.
echo [Step 5] Building Android APK (Release)...
echo This may take a few minutes...
echo.
call "%FLUTTER_PATH%\flutter.bat" build apk --release

if errorlevel 1 (
    echo.
    echo ============================================
    echo   BUILD FAILED
    echo ============================================
    echo Check the errors above.
    echo Note: pubspec.yaml build number was already incremented.
) else (
    echo.
    echo ============================================
    echo   BUILD SUCCESSFUL!
    echo ============================================
    echo.
    echo APK Location:
    echo %CD%\build\app\outputs\flutter-apk\app-release.apk
    echo.
    echo Copy this APK to your phone and install it.
    echo You may need to enable "Install from unknown sources" on your phone.
    echo.
)

echo.
echo Press any key to exit...
pause >nul
