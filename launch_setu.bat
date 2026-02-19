@echo off
setlocal
echo ===================================================
echo   SETU - Development Launcher
echo ===================================================

echo [1/2] Checking Docker Daemon...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Docker is NOT running!
    echo Please start "Docker Desktop" from your Start Menu.
    echo Wait for the whale icon to stop animating, then try again.
    echo.
    pause
    exit /b
)

echo.
echo Select Launch Option:
echo.
echo  [1] REGULAR DEV MODE (Recommended)
echo      - Starts/Restarts containers with Hot Reload.
echo      - Preserves Database data.
echo      - Quickest startup.
echo.
echo  [2] HARD RESET & REBUILD (Fixes Issues, Wipes Data)
echo      - Wipes ALL data (Database & Caches).
echo      - Re-installs all dependencies from scratch.
echo.
echo  [3] REBUILD CONTAINERS (Keep Data)
echo      - Keeps Database intact.
echo      - Re-installs dependencies (npm install).
echo      - Rebuilds images.
echo.

set /p choice="Enter choice (1, 2, or 3): "

if "%choice%"=="1" goto regular_dev
if "%choice%"=="2" goto hard_reset
if "%choice%"=="3" goto rebuild_keep_data
echo Invalid choice.
goto end

:rebuild_keep_data
echo.
echo [REBUILD] Stopping containers...
docker-compose -f docker-compose.yml -f docker-compose.dev.yml down
echo.
echo [UPDATE] Force updating Frontend dependencies...
docker-compose -f docker-compose.yml -f docker-compose.dev.yml run --rm frontend npm install
echo.
echo [BUILD] Rebuilding and Starting...
goto start_containers

:hard_reset
echo.
echo [HARD RESET] Stopping containers and removing volumes...
docker-compose -f docker-compose.yml -f docker-compose.dev.yml down -v --remove-orphans
echo.
echo [CLEANUP] Pruning unused Docker system...
docker system prune -f
echo.
echo [BUILD] Starting fresh build...
goto start_containers

:regular_dev
echo.
echo [DEV START] Checking for updates and starting...
goto start_containers

:start_containers
echo.
echo Starting Application...
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:3000
echo PDF Tool: http://localhost:8002
echo.
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to start. Check error messages above.
    pause
    exit /b
)

echo.
echo [SUCCESS] App is running in background.
echo [WAIT] Waiting for Backend Server (Port 3000) to be ready...
:wait_loop
powershell -NoProfile -ExecutionPolicy Bypass -Command "$t = New-Object System.Net.Sockets.TcpClient; try { $t.Connect('localhost', 3000); $t.Close(); exit 0 } catch { exit 1 }"
if %errorlevel% neq 0 (
    timeout /t 2 /nobreak >nul
    echo | set /p=.
    goto wait_loop
)

echo.
echo [SUCCESS] Backend is Online! Launching Frontend...
start http://localhost:5173

:end
echo.
echo Press any key to close...
pause >nul

