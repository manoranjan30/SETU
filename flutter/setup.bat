@echo off
:: ============================================================
:: SETU Mobile App - Initial Setup Script
:: ============================================================
:: Run this script first time after cloning the project
:: This will install all dependencies and generate required code
:: ============================================================

cd /d "%~dp0"

echo.
echo ========================================================
echo        SETU Mobile App - Initial Setup
echo ========================================================
echo.
echo This script will:
echo   1. Check Flutter installation
echo   2. Install dependencies
echo   3. Generate database code
echo   4. Format and analyze code
echo.
echo ========================================================
echo.

:: Check Flutter - Try common installation paths
echo [1/5] Checking Flutter installation...
echo --------------------------------------------------------

:: First try Flutter in PATH
flutter --version >nul 2>&1
if not errorlevel 1 goto :flutter_found

:: Try common Flutter installation paths
if exist "C:\flutter\flutter\bin\flutter.bat" (
    set "PATH=%PATH%;C:\flutter\flutter\bin"
    echo [INFO] Added C:\flutter\flutter\bin to PATH for this session
    goto :flutter_found
)

if exist "C:\flutter\bin\flutter.bat" (
    set "PATH=%PATH%;C:\flutter\bin"
    echo [INFO] Added C:\flutter\bin to PATH for this session
    goto :flutter_found
)

if exist "%LOCALAPPDATA%\flutter\bin\flutter.bat" (
    set "PATH=%PATH%;%LOCALAPPDATA%\flutter\bin"
    echo [INFO] Added %LOCALAPPDATA%\flutter\bin to PATH for this session
    goto :flutter_found
)

if exist "%USERPROFILE%\flutter\bin\flutter.bat" (
    set "PATH=%PATH%;%USERPROFILE%\flutter\bin"
    echo [INFO] Added %USERPROFILE%\flutter\bin to PATH for this session
    goto :flutter_found
)

:: Flutter not found
echo [ERROR] Flutter is not installed or not in PATH!
echo.
echo Please install Flutter from: https://flutter.dev
echo After installation, run: flutter doctor
echo.
echo If you just added Flutter to PATH, please:
echo   1. Close this terminal
echo   2. Open a new terminal
echo   3. Run setup.bat again
goto :error

:flutter_found
flutter --version
echo [OK] Flutter is installed
echo.

:: Install dependencies
echo [2/5] Installing dependencies...
echo --------------------------------------------------------
flutter pub get
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies!
    goto :error
)
echo [OK] Dependencies installed
echo.

:: Generate code
echo [3/5] Generating database code...
echo --------------------------------------------------------
flutter pub run build_runner build --delete-conflicting-outputs
if errorlevel 1 (
    echo [ERROR] Code generation failed!
    goto :error
)
echo [OK] Code generated
echo.

:: Format code
echo [4/5] Formatting code...
echo --------------------------------------------------------
dart format lib/
echo [OK] Code formatted
echo.

:: Analyze code
echo [5/5] Analyzing code...
echo --------------------------------------------------------
flutter analyze
if errorlevel 1 (
    echo [WARNING] Code analysis found issues
    echo Please review and fix the issues above
) else (
    echo [OK] No issues found
)
echo.

:: Run Flutter doctor
echo ========================================================
echo        Flutter Doctor
echo ========================================================
echo.
flutter doctor
echo.

echo ========================================================
echo        Setup Complete!
echo ========================================================
echo.
echo Next steps:
echo   1. Update API endpoint in lib/core/api/api_endpoints.dart
echo      Set baseUrl to your SETU backend server
echo.
echo   2. Run the app:
echo      - Development: dev_run.bat
echo      - Quick build: quick_build.bat
echo      - Full build:  build_flutter.bat build release
echo.
echo   3. Run tests: test_flutter.bat
echo.
echo ========================================================
echo.

pause
exit /b 0

:error
echo.
echo ========================================================
echo        Setup Failed!
echo ========================================================
echo.
echo Please fix the errors above and run setup.bat again.
echo.
pause
exit /b 1
