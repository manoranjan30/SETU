@echo off
echo ===========================================
echo   SETU - Quick Launch (Parallel Build)
echo ===========================================

REM Ensure BuildKit is enabled for faster and parallel Docker builds
set COMPOSE_DOCKER_CLI_BUILD=1
set DOCKER_BUILDKIT=1

echo [INFO] Building Containers in Parallel...
docker-compose -f docker-compose.yml -f docker-compose.dev.yml build --parallel

echo [INFO] Starting Containers (Detach)...
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Docker command failed!
    echo 1. Make sure Docker Desktop is RUNNING.
    echo 2. Try running 'launch_setu.bat' for more diagnostics.
    echo 3. Check if your system has enough RAM available for parallel builds.
    pause
    exit /b
)

echo.
echo [SUCCESS] Application started in background using parallel build.
echo.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:3000
echo.
echo Launching Browser...
start http://localhost:5173
echo.
echo Closing in 3 seconds...
timeout /t 3 >nul
