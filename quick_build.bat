@echo off
echo ===========================================
echo   SETU - Quick Launch (No Prompts)
echo ===========================================

echo [INFO] Starting Containers (Build and Detach)...
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Docker command failed!
    echo 1. Make sure Docker Desktop is RUNNING.
    echo 2. Try running 'launch_setu.bat' for more diagnostics.
    pause
    exit /b
)

echo.
echo [SUCCESS] Application started in background.
echo.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:3000
echo.
echo Launching Browser...
start http://localhost:5173
echo.
echo Closing in 3 seconds...
timeout /t 3 >nul
