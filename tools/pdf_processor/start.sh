#!/bin/bash

# Check if python3 is installed
if ! command -v python3 &> /dev/null
then
    echo "python3 could not be found. Please install Python 3.8+"
    exit
fi

# Check for venv, else create it
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Start server
echo "Starting server..."
echo "Access at http://localhost:8001"

# Try using open or start if available to open browser, otherwise ignore
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:8001
elif command -v open &> /dev/null; then
    open http://localhost:8001
fi

python app.py
