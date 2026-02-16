@echo off
setlocal

:: Determine if python is available
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo Python is not installed or not in PATH. Please install Python 3.8+ from python.org.
    pause
    exit /b 1
)

:: Check for virtual environment
if not exist "venv\Scripts\activate.bat" (
    echo Creating virtual environment...
    python -m venv venv
)

:: Activate virtual environment
call venv\Scripts\activate.bat

:: Install dependencies if needed (check if requirements file exists and site-packages is not empty)
:: Or just install anyway, pip is smart enough to skip if satisfied.
echo Installing dependencies...
pip install -r requirements.txt

:: Start server
echo Starting PDF Table Extractor Tool...
echo Access at http://localhost:8001
start http://localhost:8001
python app.py

pause
