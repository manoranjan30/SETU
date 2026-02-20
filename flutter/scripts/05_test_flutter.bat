@echo off
:: ============================================================
:: SETU Mobile App - Test Script
:: ============================================================
:: Runs all tests with coverage report
:: ============================================================

cd /d "%~dp0"

:: Setup Flutter path if not in PATH
flutter --version >nul 2>&1
if errorlevel 1 (
    if exist "C:\flutter\flutter\bin\flutter.bat" (
        set "PATH=%PATH%;C:\flutter\flutter\bin"
    )
)

set TEST_TYPE=%1

echo.
echo ========================================================
echo        SETU Mobile App - Test Runner
echo ========================================================
echo.

if "%TEST_TYPE%"=="" set TEST_TYPE=all

if "%TEST_TYPE%"=="unit" (
    echo [TEST] Running Unit Tests...
    echo ========================================================
    flutter test test/unit/ --coverage
) else if "%TEST_TYPE%"=="widget" (
    echo [TEST] Running Widget Tests...
    echo ========================================================
    flutter test test/widget/ --coverage
) else if "%TEST_TYPE%"=="integration" (
    echo [TEST] Running Integration Tests...
    echo ========================================================
    flutter test integration_test/
) else if "%TEST_TYPE%"=="all" (
    echo [TEST] Running All Tests...
    echo ========================================================
    flutter test --coverage
) else (
    echo [ERROR] Unknown test type: %TEST_TYPE%
    echo.
    echo Usage: test_flutter.bat [unit|widget|integration|all]
    goto :end
)

if errorlevel 1 (
    echo.
    echo ========================================================
    echo [FAILED] Some tests failed!
    echo ========================================================
    goto :end
)

echo.
echo ========================================================
echo [SUCCESS] All tests passed!
echo ========================================================

:: Generate coverage report if lcov is available
if exist coverage\lcov.info (
    echo.
    echo Coverage report generated: coverage\lcov.info
    echo.
    echo To view HTML report, install lcov and run:
    echo   genhtml coverage\lcov.info -o coverage\html
)

:end
echo.
pause
