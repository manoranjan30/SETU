from fastapi import FastAPI, UploadFile, Query, HTTPException, File, BackgroundTasks, Form
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import pdfplumber
import tempfile
import os
import shutil
import csv
import uuid
import time
import json
import re
from pydantic import BaseModel
from typing import List, Dict, Optional, Any

app = FastAPI(title="PDF Processor", description="Extract data from PDFs with template-based extraction")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for job status
jobs: Dict[str, Dict] = {}


# ---------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------
class ZoneBounds(BaseModel):
    x: float
    y: float
    w: float
    h: float


class AnchorConfig(BaseModel):
    anchorText: Optional[str] = None
    relativePosition: Optional[str] = "right"
    fallbackRegex: Optional[str] = None


class TemplateField(BaseModel):
    key: str
    label: str
    type: str = "text"
    required: bool = False
    regex: Optional[str] = None


class TemplateZone(BaseModel):
    id: str
    name: str
    type: str
    bounds: ZoneBounds
    fields: List[TemplateField] = []
    extractionStrategy: Optional[str] = "auto"
    anchor: Optional[AnchorConfig] = None


class TemplateConfig(BaseModel):
    zones: List[TemplateZone] = []
    extractionMode: str = "all_pages"


class ExtractZoneRequest(BaseModel):
    bounds: ZoneBounds
    pageNumber: int = 1


# ---------------------------------------------------------------------
# Zone Text Extraction (Auto-detection)
# ---------------------------------------------------------------------
@app.post("/extract/zone-text")
async def extract_zone_text(
    file: UploadFile = File(...),
    zone_data: str = Form(...)
):
    """Extract text and detect fields from a specific PDF region."""
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    try:
        zone = ExtractZoneRequest(**json.loads(zone_data))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid zone data: {str(e)}")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        with pdfplumber.open(tmp_path) as pdf:
            if zone.pageNumber > len(pdf.pages):
                raise HTTPException(status_code=400, detail="Page number out of range")

            page = pdf.pages[zone.pageNumber - 1]
            
            bbox = (
                zone.bounds.x,
                zone.bounds.y,
                zone.bounds.x + zone.bounds.w,
                zone.bounds.y + zone.bounds.h
            )

            cropped = page.crop(bbox)
            raw_text = cropped.extract_text() or ""
            words = cropped.extract_words(keep_blank_chars=True, x_tolerance=3, y_tolerance=3)
            tables = cropped.extract_tables()
            
            detected_fields = detect_label_value_pairs(raw_text)
            is_table = len(tables) > 0 and len(tables[0]) > 1
            
            table_data = []
            if is_table:
                for table in tables:
                    if table and len(table) > 0:
                        # First row as headers
                        headers = [str(cell or '').strip() for cell in table[0]] if table[0] else []
                        rows = []
                        for row in table[1:]:
                            row_data = {}
                            for i, cell in enumerate(row):
                                header = headers[i] if i < len(headers) else f"col_{i}"
                                row_data[header] = str(cell or '').strip()
                            if any(row_data.values()):
                                rows.append(row_data)
                        table_data.append({"headers": headers, "rows": rows})

            return {
                "success": True,
                "rawText": raw_text,
                "detectedFields": detected_fields,
                "isTable": is_table,
                "tableData": table_data,
                "wordCount": len(words),
                "lineCount": len(raw_text.split('\n')) if raw_text else 0
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction error: {str(e)}")
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


def detect_label_value_pairs(text: str) -> List[Dict]:
    """Auto-detect label-value pairs from text."""
    detected = []
    if not text:
        return detected

    for line in text.split('\n'):
        line = line.strip()
        if not line:
            continue
            
        # Pattern: "Label: Value"
        colon_match = re.match(r'^([^:]+):\s*(.+)$', line)
        if colon_match:
            label = colon_match.group(1).strip()
            value = colon_match.group(2).strip()
            if label and value and len(label) < 50:
                detected.append({
                    "label": label,
                    "value": value,
                    "key": sanitize_key(label),
                    "type": detect_field_type(value),
                    "confidence": 0.9
                })
                continue
        
        # Date pattern
        date_match = re.search(r'\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b', line)
        if date_match:
            detected.append({
                "label": "Date",
                "value": date_match.group(1),
                "key": "date",
                "type": "date",
                "confidence": 0.8
            })
            continue
            
        # Amount pattern
        amount_match = re.search(r'[₹$Rs.]*\s*([\d,]+\.?\d*)', line)
        if amount_match and re.search(r'\d{2,}', line):
            detected.append({
                "label": "Amount",
                "value": amount_match.group(1).strip(),
                "key": "amount",
                "type": "currency",
                "confidence": 0.7
            })

    return detected


def sanitize_key(label: str) -> str:
    key = label.lower()
    key = re.sub(r'[^a-z0-9]+', '_', key)
    key = key.strip('_')
    return key[:30] if key else "field"


def detect_field_type(value: str) -> str:
    value = value.strip()
    if re.match(r'^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$', value):
        return "date"
    if re.match(r'^[₹$Rs.]*\s*[\d,]+\.?\d*$', value):
        return "currency"
    if re.match(r'^[\d,]+\.?\d*$', value):
        return "number"
    return "text"


# ---------------------------------------------------------------------
# Template Testing (Multi-page support)
# ---------------------------------------------------------------------
@app.post("/extract/test-template")
async def test_template_extraction(
    file: UploadFile = File(...),
    template_json: str = Form(...),
    page_number: int = Form(0)  # 0 = all pages, otherwise specific page
):
    """Test template extraction with multi-page support."""
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    try:
        template = TemplateConfig(**json.loads(template_json))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid template: {str(e)}")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    results = []

    try:
        with pdfplumber.open(tmp_path) as pdf:
            total_pages = len(pdf.pages)
            
            # Determine which pages to process
            if page_number > 0 and page_number <= total_pages:
                pages_to_process = [pdf.pages[page_number - 1]]
            elif template.extractionMode == 'first_only':
                pages_to_process = [pdf.pages[0]]
            else:
                pages_to_process = pdf.pages

            for zone in template.zones:
                zone_result = {
                    "zoneId": zone.id,
                    "zoneName": zone.name,
                    "zoneType": zone.type,
                    "success": False,
                    "extractedValue": None,
                    "extractedFields": {},
                    "tableData": None,
                    "error": None,
                    "pageResults": []
                }

                accumulated_text = []
                accumulated_table = []

                for page_idx, page in enumerate(pages_to_process):
                    try:
                        bbox = (
                            zone.bounds.x,
                            zone.bounds.y,
                            zone.bounds.x + zone.bounds.w,
                            zone.bounds.y + zone.bounds.h
                        )

                        cropped = page.crop(bbox)
                        text = cropped.extract_text() or ""

                        if text.strip():
                            accumulated_text.append(text.strip())
                            
                            page_result = {
                                "page": page_idx + 1,
                                "text": text.strip()[:200]  # Preview
                            }
                            zone_result["pageResults"].append(page_result)

                        # For table zones, extract table structure
                        if zone.type == "table":
                            tables = cropped.extract_tables()
                            for table in tables:
                                if table and len(table) > 0:
                                    headers = [str(c or '').strip() for c in table[0]] if table[0] else []
                                    for row in table[1:]:
                                        row_dict = {}
                                        for i, cell in enumerate(row):
                                            h = headers[i] if i < len(headers) else f"col_{i}"
                                            row_dict[h] = str(cell or '').strip()
                                        if any(row_dict.values()):
                                            accumulated_table.append(row_dict)

                    except Exception as e:
                        zone_result["pageResults"].append({
                            "page": page_idx + 1,
                            "error": str(e)
                        })

                # Compile results
                if accumulated_text:
                    zone_result["success"] = True
                    zone_result["extractedValue"] = "\n---\n".join(accumulated_text)
                    
                    # Extract fields from combined text
                    combined_text = " ".join(accumulated_text)
                    if zone.fields:
                        for field in zone.fields:
                            value = extract_field_from_text(combined_text, field.label, field.type, field.regex)
                            zone_result["extractedFields"][field.key] = value
                else:
                    zone_result["error"] = "No text found in zone region"

                # Add table data if table zone
                if zone.type == "table" and accumulated_table:
                    zone_result["tableData"] = {
                        "headers": list(accumulated_table[0].keys()) if accumulated_table else [],
                        "rows": accumulated_table,
                        "rowCount": len(accumulated_table)
                    }
                    zone_result["success"] = True

                results.append(zone_result)

        return {
            "success": True,
            "pageCount": total_pages,
            "pagesProcessed": len(pages_to_process),
            "results": results,
            "summary": {
                "total": len(results),
                "passed": sum(1 for r in results if r["success"]),
                "failed": sum(1 for r in results if not r["success"])
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction error: {str(e)}")
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


def extract_field_from_text(text: str, label: str, field_type: str, regex: Optional[str] = None) -> Optional[str]:
    """Extract a field value from text."""
    if regex:
        match = re.search(regex, text)
        if match:
            return match.group(1) if match.groups() else match.group(0)
    
    # Label: value pattern
    pattern = re.escape(label) + r'\s*:?\s*([^\n]+)'
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    
    return None


# ---------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "pdf-processor", "version": "2.0"}


# ---------------------------------------------------------------------
# Background Job Processing (Original functionality)
# ---------------------------------------------------------------------
def log_progress(job_id: str, message: str, percent: int = None):
    if job_id in jobs:
        timestamp = time.strftime("%H:%M:%S")
        jobs[job_id]["logs"].append(f"[{timestamp}] {message}")
        if percent is not None:
            jobs[job_id]["percent"] = percent


def process_pdf_task(job_id: str, tmp_path: str, top_margin: int, bottom_margin: int, output_format: str):
    try:
        log_progress(job_id, "🚀 Starting PDF extraction...", 1)
        extracted_data = []
        all_rows = []

        with pdfplumber.open(tmp_path) as pdf:
            total_pages = len(pdf.pages)
            log_progress(job_id, f"PDF loaded: {total_pages} pages", 10)

            for i, page in enumerate(pdf.pages):
                percent = 10 + int((i / total_pages) * 80)
                log_progress(job_id, f"Processing page {i + 1}/{total_pages}...", percent)

                if top_margin > 0 or bottom_margin < page.height:
                    page = page.crop((0, top_margin, page.width, bottom_margin))

                tables = page.extract_tables()
                if tables:
                    log_progress(job_id, f"  Found {len(tables)} table(s)")
                    for table in tables:
                        cleaned = [[str(c or "").strip() for c in row] for row in table]
                        cleaned = [row for row in cleaned if any(row)]
                        if cleaned:
                            extracted_data.append({"page": i + 1, "rows": cleaned})
                            all_rows.extend(cleaned)

        log_progress(job_id, "Generating output...", 95)
        
        if output_format == "csv":
            result_file = tmp_path + ".csv"
            with open(result_file, 'w', newline='', encoding='utf-8') as f:
                csv.writer(f).writerows(all_rows)
        else:
            result_file = tmp_path + ".json"
            with open(result_file, 'w', encoding='utf-8') as f:
                json.dump({"data": extracted_data}, f, indent=2)

        jobs[job_id]["status"] = "completed"
        jobs[job_id]["result_file"] = result_file
        jobs[job_id]["percent"] = 100
        log_progress(job_id, "✨ Complete!")

    except Exception as e:
        log_progress(job_id, f"❌ Error: {str(e)}")
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)
    finally:
        if os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except:
                pass


@app.post("/extract/start")
async def start_extraction_job(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    output_format: str = Query("csv", enum=["json", "csv"]),
    top_margin: int = 0,
    bottom_margin: int = 1000,
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    job_id = str(uuid.uuid4())
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    jobs[job_id] = {"status": "processing", "percent": 0, "logs": [], "created_at": time.time()}
    background_tasks.add_task(process_pdf_task, job_id, tmp_path, top_margin, bottom_margin, output_format)

    return {"job_id": job_id, "message": "Job started"}


@app.get("/progress/{job_id}")
async def get_job_progress(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]


@app.get("/download/{job_id}")
async def download_result(job_id: str):
    if job_id not in jobs or jobs[job_id]["status"] != "completed":
        raise HTTPException(status_code=404, detail="Result not ready")
    
    file_path = jobs[job_id]["result_file"]
    filename = "extracted" + (".csv" if file_path.endswith(".csv") else ".json")
    return FileResponse(file_path, filename=filename)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
