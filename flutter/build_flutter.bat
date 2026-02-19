@echo off
SETLOCAL EnableDelayedExpansion

:: ============================================================
:: SETU Mobile App - Flutter Build Script
:: ============================================================
:: This script handles building, testing, and development
:: for the SETU mobile application.
:: ============================================================

set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

:: Setup Flutter path if not in PATH
flutter --version >nul 2>&1
if errorlevel 1 (
    if exist "C:\flutter\flutter\bin\flutter.bat" (
        set "PATH=%PATH%;C:\flutter\flutter\bin"
        echo [INFO] Added Flutter to PATH for this session
    )
)

:: Colors for output (Windows 10+)
set "GREEN=[92m"
set "YELLOW=[93m"
set "RED=[91m"
set "CYAN=[96m"
set "RESET=[0m"

:: Default values
set COMMAND=%1
set BUILD_TYPE=%2
set FLAVOR=%3

:: Show help if no command provided
if "%COMMAND%"=="" goto :show_help
if "%COMMAND%"=="help" goto :show_help
if "%COMMAND%"=="-h" goto :show_help
if "%COMMAND%"=="--help" goto :show_help

:: Check if Flutter is installed
echo %CYAN%Checking Flutter installation...%RESET%
flutter --version >nul 2>&1
if errorlevel 1 (
    echo %RED%[ERROR] Flutter is not installed or not in PATH.%RESET%
    echo.
    echo Please install Flutter from: https://flutter.dev/docs/get-started/install
    echo After installation, run: flutter doctor
    goto :end_with_error
)
echo %GREEN%[OK] Flutter is installed%RESET%
echo.

:: Process commands
if "%COMMAND%"=="setup" goto :setup
if "%COMMAND%"=="deps" goto :dependencies
if "%COMMAND%"=="codegen" goto :codegen
if "%COMMAND%"=="build" goto :build
if "%COMMAND%"=="run" goto :run
if "%COMMAND%"=="test" goto :test
if "%COMMAND%"=="clean" goto :clean
if "%COMMAND%"=="doctor" goto :doctor
if "%COMMAND%"=="apk" goto :build_apk
if "%COMMAND%"=="ios" goto :build_ios
if "%COMMAND%"=="web" goto :build_web
if "%COMMAND%"=="all" goto :build_all
if "%COMMAND%"=="dev" goto :dev_mode

echo %RED%[ERROR] Unknown command: %COMMAND%%RESET%
echo.
goto :show_help

:: ============================================================
:: SHOW HELP
:: ============================================================
:show_help
echo.
echo %CYAN%============================================================%RESET%
echo %CYAN%       SETU Mobile App - Flutter Build Script%RESET%
echo %CYAN%============================================================%RESET%
echo.
echo %YELLOW%Usage:%RESET%
echo   build_flutter.bat [command] [options]
echo.
echo %YELLOW%Commands:%RESET%
echo.
echo   %GREEN%setup%RESET%        - Initial project setup (deps + codegen)
echo   %GREEN%deps%RESET%         - Install dependencies (flutter pub get)
echo   %GREEN%codegen%RESET%      - Generate code (Drift database, etc.)
echo.
echo   %GREEN%build%RESET%        - Build APK (default: release)
echo            Options: debug, release, profile
echo            Example: build_flutter.bat build release
echo.
echo   %GREEN%apk%RESET%          - Build APK (alias for build)
echo   %GREEN%ios%RESET%          - Build iOS (requires macOS)
echo   %GREEN%web%RESET%          - Build for web
echo   %GREEN%all%RESET%          - Build all platforms
echo.
echo   %GREEN%run%RESET%          - Run app in debug mode
echo            Options: device_id
echo            Example: build_flutter.bat run chrome
echo.
echo   %GREEN%dev%RESET%          - Development mode with hot reload
echo.
echo   %GREEN%test%RESET%         - Run all tests
echo            Options: unit, widget, integration, all
echo.
echo   %GREEN%clean%RESET%        - Clean build artifacts
echo   %GREEN%doctor%RESET%       - Run Flutter doctor
echo.
echo   %GREEN%help%RESET%         - Show this help message
echo.
echo %YELLOW%Examples:%RESET%
echo   build_flutter.bat setup              - First time setup
echo   build_flutter.bat build release      - Build release APK
echo   build_flutter.bat run                - Run in debug mode
echo   build_flutter.bat test all           - Run all tests
echo.
goto :end

:: ============================================================
:: SETUP - Initial project setup
:: ============================================================
:setup
echo.
echo %CYAN%============================================================%RESET%
echo %CYAN%       Running Initial Setup%RESET%
echo %CYAN%============================================================%RESET%
echo.

:: Install dependencies
echo %YELLOW%[1/4] Installing dependencies...%RESET%
call flutter pub get
if errorlevel 1 (
    echo %RED%[ERROR] Failed to install dependencies%RESET%
    goto :end_with_error
)
echo %GREEN%[OK] Dependencies installed%RESET%
echo.

:: Generate code
echo %YELLOW%[2/4] Generating code (Drift database, etc.)...%RESET%
call flutter pub run build_runner build --delete-conflicting-outputs
if errorlevel 1 (
    echo %RED%[ERROR] Code generation failed%RESET%
    goto :end_with_error
)
echo %GREEN%[OK] Code generated successfully%RESET%
echo.

:: Format code
echo %YELLOW%[3/4] Formatting code...%RESET%
call dart format lib/
echo %GREEN%[OK] Code formatted%RESET%
echo.

:: Analyze code
echo %YELLOW%[4/4] Analyzing code...%RESET%
call flutter analyze
if errorlevel 1 (
    echo %YELLOW%[WARNING] Code analysis found issues%RESET%
) else (
    echo %GREEN%[OK] No issues found%RESET%
)
echo.

echo %GREEN%============================================================%RESET%
echo %GREEN%       Setup completed successfully!%RESET%
echo %GREEN%============================================================%RESET%
echo.
echo %YELLOW%Next steps:%RESET%
echo   1. Update API endpoint in lib/core/api/api_endpoints.dart
echo   2. Run 'build_flutter.bat run' to start the app
echo.
goto :end

:: ============================================================
:: DEPENDENCIES - Install dependencies
:: ============================================================
:dependencies
echo.
echo %CYAN%Installing Flutter dependencies...%RESET%
echo.
call flutter pub get
if errorlevel 1 (
    echo %RED%[ERROR] Failed to install dependencies%RESET%
    goto :end_with_error
)
echo.
echo %GREEN%[OK] Dependencies installed successfully%RESET%
goto :end

:: ============================================================
:: CODEGEN - Generate code
:: ============================================================
:codegen
echo.
echo %CYAN%Running code generation...%RESET%
echo.
call flutter pub run build_runner build --delete-conflicting-outputs
if errorlevel 1 (
    echo %RED%[ERROR] Code generation failed%RESET%
    goto :end_with_error
)
echo.
echo %GREEN%[OK] Code generated successfully%RESET%
goto :end

:: ============================================================
:: BUILD - Build APK
:: ============================================================
:build
if "%BUILD_TYPE%"=="" set BUILD_TYPE=release

echo.
echo %CYAN%============================================================%RESET%
echo %CYAN%       Building Flutter App (%BUILD_TYPE%)%RESET%
echo %CYAN%============================================================%RESET%
echo.

:: Ensure dependencies are installed
echo %YELLOW%[1/3] Checking dependencies...%RESET%
call flutter pub get >nul 2>&1
echo %GREEN%[OK] Dependencies ready%RESET%
echo.

:: Ensure code is generated
echo %YELLOW%[2/3] Ensuring code generation is up to date...%RESET%
call flutter pub run build_runner build --delete-conflicting-outputs >nul 2>&1
echo %GREEN%[OK] Code generation complete%RESET%
echo.

:: Build APK
echo %YELLOW%[3/3] Building APK (%BUILD_TYPE%)...%RESET%
echo.

if "%BUILD_TYPE%"=="debug" (
    call flutter build apk --debug
) else if "%BUILD_TYPE%"=="profile" (
    call flutter build apk --profile
) else (
    call flutter build apk --release
)

if errorlevel 1 (
    echo.
    echo %RED%[ERROR] Build failed%RESET%
    goto :end_with_error
)

echo.
echo %GREEN%============================================================%RESET%
echo %GREEN%       Build completed successfully!%RESET%
echo %GREEN%============================================================%RESET%
echo.
echo %YELLOW%APK location:%RESET%
echo   %CD%\build\app\outputs\flutter-apk\app-%BUILD_TYPE%.apk
echo.
echo %YELLOW%To install on connected device:%RESET%
echo   adb install build\app\outputs\flutter-apk\app-%BUILD_TYPE%.apk
echo.
goto :end

:: ============================================================
:: BUILD APK - Alias for build
:: ============================================================
:build_apk
goto :build

:: ============================================================
:: BUILD IOS
:: ============================================================
:build_ios
echo.
echo %CYAN%Building for iOS...%RESET%
echo.

:: Check if on macOS
ver | findstr /i "mac" >nul 2>&1
if errorlevel 1 (
    echo %YELLOW%[WARNING] iOS builds require macOS%RESET%
    echo You can still develop and test on iOS simulator if you have Xcode.
)

call flutter build ios --release
if errorlevel 1 (
    echo %RED%[ERROR] iOS build failed%RESET%
    goto :end_with_error
)
echo %GREEN%[OK] iOS build completed%RESET%
goto :end

:: ============================================================
:: BUILD WEB
:: ============================================================
:build_web
echo.
echo %CYAN%Building for Web...%RESET%
echo.

call flutter build web --release
if errorlevel 1 (
    echo %RED%[ERROR] Web build failed%RESET%
    goto :end_with_error
)
echo.
echo %GREEN%[OK] Web build completed%RESET%
echo %YELLOW%Output: %CD%\build\web%RESET%
goto :end

:: ============================================================
:: BUILD ALL
:: ============================================================
:build_all
echo.
echo %CYAN%Building for all platforms...%RESET%
echo.

echo %YELLOW%[1/3] Building APK...%RESET%
call flutter build apk --release

echo %YELLOW%[2/3] Building Web...%RESET%
call flutter build web --release

echo %YELLOW%[3/3] Building iOS (if on macOS)...%RESET%
call flutter build ios --release 2>nul

echo.
echo %GREEN%[OK] All builds completed%RESET%
goto :end

:: ============================================================
:: RUN - Run app in debug mode
:: ============================================================
:run
echo.
echo %CYAN%============================================================%RESET%
echo %CYAN%       Running Flutter App%RESET%
echo %CYAN%============================================================%RESET%
echo.

:: List available devices
echo %YELLOW%Available devices:%RESET%
call flutter devices
echo.

if "%BUILD_TYPE%"=="" (
    echo %YELLOW%Starting app in debug mode...%RESET%
    call flutter run
) else (
    echo %YELLOW%Starting app on device: %BUILD_TYPE%%RESET%
    call flutter run -d %BUILD_TYPE%
)

goto :end

:: ============================================================
:: DEV MODE - Development with hot reload
:: ============================================================
:dev_mode
echo.
echo %CYAN%============================================================%RESET%
echo %CYAN%       Development Mode%RESET%
echo %CYAN%============================================================%RESET%
echo.

:: Watch for code generation changes
echo %YELLOW%Starting development mode with hot reload...%RESET%
echo %YELLOW%Press 'r' to hot reload, 'q' to quit%RESET%
echo.

call flutter run --debug
goto :end

:: ============================================================
:: TEST - Run tests
:: ============================================================
:test
echo.
echo %CYAN%============================================================%RESET%
echo %CYAN%       Running Tests%RESET%
echo %CYAN%============================================================%RESET%
echo.

if "%BUILD_TYPE%"=="" set BUILD_TYPE=all

if "%BUILD_TYPE%"=="unit" (
    echo %YELLOW%Running unit tests...%RESET%
    call flutter test test/unit/
) else if "%BUILD_TYPE%"=="widget" (
    echo %YELLOW%Running widget tests...%RESET%
    call flutter test test/widget/
) else if "%BUILD_TYPE%"=="integration" (
    echo %YELLOW%Running integration tests...%RESET%
    call flutter test integration_test/
) else (
    echo %YELLOW%Running all tests...%RESET%
    call flutter test
)

if errorlevel 1 (
    echo.
    echo %RED%[ERROR] Some tests failed%RESET%
    goto :end_with_error
)

echo.
echo %GREEN%[OK] All tests passed%RESET%
goto :end

:: ============================================================
:: CLEAN - Clean build artifacts
:: ============================================================
:clean
echo.
echo %CYAN%Cleaning build artifacts...%RESET%
echo.

call flutter clean
echo.
echo %GREEN%[OK] Clean completed%RESET%
echo.
echo %YELLOW%Note: You need to run 'build_flutter.bat setup' again.%RESET%
goto :end

:: ============================================================
:: DOCTOR - Run Flutter doctor
:: ============================================================
:doctor
echo.
echo %CYAN%Running Flutter doctor...%RESET%
echo.
call flutter doctor -v
goto :end

:: ============================================================
:: END
:: ============================================================
:end
echo.
ENDLOCAL
exit /b 0

:end_with_error
echo.
ENDLOCAL
exit /b 1
