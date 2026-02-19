# PDF Processor Tool (Standalone)

This directory contains a standalone microservice for extracting tables and text from PDF documents using `pdfplumber`. It is designed to run independently of the main application stack and provides a web interface for easy use.

## Features
- **Table Extraction:** Converts PDF tables to CSV or JSON.
- **Text Coordinate Extraction:** Extracts text with X/Y coordinates for visual processing.
- **Web Interface:** Simple upload form with progress tracking.
- **API:** RESTful API for programmatic access.

## Prerequisites
- **Python 3.8+** must be installed on the system.
- **pip** package manager.

## Installation & Running

### Windows (One-Click)
1.  Navigate to `tools/pdf_processor`.
2.  Double-click **`start.bat`**.
    - This script will automatically create a virtual environment, install dependencies, and start the server.
3.  The tool will open in your browser at `http://localhost:8001`.

### Linux / macOS
1.  Navigate to `tools/pdf_processor`.
2.  Make the script executable: `chmod +x start.sh`
3.  Run: `./start.sh`
4.  Access the tool at `http://localhost:8001`.

### Manual Setup (Platform Agnostic)
If you prefer to run it manually or verify steps:

1.  **Create Virtual Environment:**
    ```bash
    python -m venv venv
    ```

2.  **Activate Environment:**
    - Windows: `.\venv\Scripts\activate`
    - Linux/Mac: `source venv/bin/activate`

3.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Run Server:**
    ```bash
    python app.py
    ```

## Usage
1.  Open `http://localhost:8001`.
2.  Upload a PDF file.
3.  Choose output format (CSV or JSON).
4.  Click **Start Extraction**.
5.  Watch the progress and download the result when done.

## Integration
This tool is linked in the main application sidebar under **External Tools > PDF Table Extractor**. 
It runs on port `8001` by default. If deployed to a remote server, update the link in `frontend/src/config/menu.ts`.

## Deployment (Production)
For production deployment, it is recommended to use Docker.

**Build & Run:**
```bash
docker build -t pdf-extractor .
docker run -d -p 8001:8001 --name pdf-extractor pdf-extractor
```
