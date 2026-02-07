
@echo off
echo ===================================================
echo   SETU Git Repository Cleanup Tool
echo ===================================================
echo This script will:
echo 1. Un-track files that should be ignored (node_modules, dist, etc.)
echo 2. Re-add all source files respecting the new .gitignore
echo 3. Create a clean commit
echo.
echo WARNING: Make sure you have committed any important changes
echo          before running this, or they will be included in the cleanup commit.
echo.
pause

echo.
echo [1/3] Clearing Git Cache (Un-tracking all files)...
git rm -r --cached .

echo.
echo [2/3] Re-adding files (Respecting .gitignore)...
git add .

echo.
echo [3/3] Committing cleanup...
git commit -m "chore: cleanup repository, remove ignored files and apply .gitignore"

echo.
echo ===================================================
echo   Cleanup Complete!
echo   You can now push to your remote repository.
echo ===================================================
pause
