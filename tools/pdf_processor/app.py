from fastapi import FastAPI, UploadFile, Query, HTTPException, File, BackgroundTasks, Form, Request
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

@app.get("/", response_class=HTMLResponse)
async def root():
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PDF Data Refiner</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
            body { font-family: 'Inter', sans-serif; background-color: #f1f5f9; }
            .glass { background: rgba(255, 255, 255, 0.98); }
            .grid-container { max-height: 60vh; overflow: auto; border: 1px solid #e2e8f0; border-radius: 8px; }
            table { border-collapse: separate; border-spacing: 0; width: 100%; }
            th { position: sticky; top: 0; background: #f8fafc; z-index: 10; padding: 12px; border-bottom: 2px solid #e2e8f0; text-align: left; font-size: 0.75rem; text-transform: uppercase; color: #64748b; cursor: grab; }
            th:active { cursor: grabbing; }
            th[draggable]:hover { background: #e2e8f0; }
            th span[contenteditable] { cursor: text; display: inline-block; min-width: 50px; padding: 2px 4px; border-radius: 4px; }
            th span[contenteditable]:focus { background: white; outline: 2px solid #3b82f6; }
            td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 0.875rem; color: #334155; }
            td[contenteditable]:focus { background: #fffbeb; outline: 2px solid #f59e0b; }
            tr:hover { background: #f8fafc; }
            tr.header-selected { background: #ede9fe !important; border-left: 4px solid #8b5cf6; }
            tr.row-selected { background: #dbeafe !important; }
            .toggle-active { background: #8b5cf6 !important; color: white !important; }
            .btn-action { @apply p-2 rounded-lg transition-all active:scale-95; }
            input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; accent-color: #3b82f6; }
        </style>
    </head>
    <body class="min-h-screen py-8 px-4">
        <div class="max-w-6xl mx-auto space-y-6">
            <!-- Header -->
            <div class="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div>
                    <h1 class="text-2xl font-bold text-slate-900">PDF Data Refiner</h1>
                    <p class="text-slate-500">Extract, Clean, and Export tabular data</p>
                </div>
                <div id="job-status-pill" class="hidden px-4 py-1 rounded-full bg-blue-50 text-blue-600 text-sm font-medium animate-pulse">
                    Processing...
                </div>
            </div>

            <!-- Upload Section -->
            <div id="upload-zone" class="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                <div id="drop-area" class="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-blue-500 transition-colors cursor-pointer group mb-6">
                    <input type="file" id="fileInp" class="hidden" accept=".pdf">
                    <div class="flex flex-col items-center">
                        <div class="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                            <svg class="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                        </div>
                        <p class="text-lg font-semibold text-slate-700" id="fileName">Select PDF Document</p>
                        <p class="text-slate-400 mt-1">Drag and drop or click to browse</p>
                    </div>
                </div>
                <button id="startBtn" class="w-full bg-slate-900 hover:bg-black text-white font-bold py-4 rounded-xl transition-all shadow-xl shadow-slate-200 disabled:opacity-50">
                    Extract Tables
                </button>
            </div>

            <!-- Editor Section (Hidden initially) -->
            <div id="editor-zone" class="hidden space-y-6">
                <!-- Toolbar -->
                <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 flex-wrap">
                    <button onclick="autoCleanup()" class="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-lg shadow-blue-100">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        Smart Auto-Join
                    </button>
                <button onclick="setAsHeader()" class="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium">
                        Set Selected as Header
                    </button>
                    <button id="headerSelectToggle" onclick="toggleHeaderSelectMode()" class="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                        Select Header Rows
                    </button>
                    <button id="mergeHeadersBtn" onclick="mergeHeaderRows()" class="hidden flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-lg shadow-violet-100" title="Merge header text only, keep data rows separate">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                        Headers Only
                    </button>
                    <button id="expandColumnsBtn" onclick="expandAndAlignColumns()" class="hidden flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-lg shadow-emerald-100" title="Interleave columns: H1_C1, H2_C1, H1_C2, H2_C2... and merge data rows">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"></path></svg>
                        Interleave Cols
                    </button>
                    <button onclick="mergeRowPairs()" class="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-lg shadow-amber-100" title="Merge every 2 consecutive rows, taking non-empty values from each">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                        Merge Row Pairs
                    </button>
                    <button onclick="deleteColumn()" class="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg font-medium">
                        Delete Col
                    </button>
                    <button onclick="deleteRow()" class="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg font-medium">
                        Delete Row
                    </button>
                    <div class="h-8 w-px bg-slate-200 mx-2"></div>
                    <select id="exportFormat" class="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none">
                        <option value="csv">Export as CSV</option>
                        <option value="json">Export as JSON</option>
                    </select>
                    <label class="flex items-center gap-2 text-sm text-slate-600">
                        <input type="checkbox" id="includeMetadata" checked class="rounded">
                        Include Metadata
                    </label>
                    <button onclick="exportData()" class="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold transition-all shadow-lg shadow-green-100 ml-auto">
                        Download Result
                    </button>
                </div>

                <!-- Metadata Panel -->
                <div id="metadata-panel" class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div class="p-4 bg-amber-50 border-b border-amber-100 flex justify-between items-center cursor-pointer" onclick="toggleMetadataPanel()">
                        <div class="flex items-center gap-2">
                            <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            <span class="text-sm font-semibold text-amber-800 uppercase tracking-wider">Extracted Metadata</span>
                        </div>
                        <svg id="metadata-chevron" class="w-5 h-5 text-amber-600 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                    <div id="metadata-content" class="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
                        <!-- Metadata fields will be populated here -->
                        <div class="text-slate-400 italic col-span-full">No metadata extracted yet. Process a PDF to see extracted fields.</div>
                    </div>
                </div>

                <!-- Data Grid -->
                <div class="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                    <div class="p-4 border-bottom border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <span class="text-sm font-semibold text-slate-600 uppercase tracking-wider">Extracted Data Preview</span>
                        <span id="row-count" class="text-xs font-mono text-slate-400">0 rows detected</span>
                    </div>
                    <div class="grid-container" id="grid">
                        <table id="dataTable">
                            <thead id="tableHead"></thead>
                            <tbody id="tableBody"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Progress Log (Overlay or Bottom) -->
            <div id="log-zone" class="hidden fixed bottom-6 right-6 w-80 bg-slate-900 rounded-xl shadow-2xl p-4 transition-all">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-xs font-bold text-slate-400 uppercase">Process Log</span>
                    <div id="mini-progress" class="text-blue-400 font-mono text-xs">0%</div>
                </div>
                <div id="log-container" class="h-32 overflow-y-auto font-mono text-[10px] text-slate-300 space-y-1"></div>
            </div>
        </div>

        <script>
            let gridData = [];
            let headers = [];
            let selectedRowIndex = null;
            let selectedRows = [];  // Multi-row selection
            let currentJobId = null;
            let headerSelectMode = false;
            let selectedHeaderRows = [];
            let metadata = {};
            let metadataCollapsed = false;
            let dragColIdx = null;  // For column drag & drop

            const fileInp = document.getElementById('fileInp');
            const fileName = document.getElementById('fileName');
            const dropArea = document.getElementById('drop-area');
            const startBtn = document.getElementById('startBtn');

            // --- File Management ---
            dropArea.onclick = () => fileInp.click();
            fileInp.onchange = (e) => handleFile(e.target.files[0]);

            function handleFile(file) {
                if (!file || file.type !== 'application/pdf') return alert('Please select a PDF');
                fileName.innerText = file.name;
                fileName.classList.add('text-blue-600');
            }

            // --- Extraction Flow ---
            startBtn.onclick = async () => {
                if (!fileInp.files[0]) return alert('Upload PDF first');
                
                startBtn.disabled = true;
                document.getElementById('job-status-pill').classList.remove('hidden');
                document.getElementById('log-zone').classList.remove('hidden');

                const formData = new FormData();
                formData.append('file', fileInp.files[0]);

                try {
                    const res = await fetch('/extract/start', { method: 'POST', body: formData });
                    const { job_id } = await res.json();
                    currentJobId = job_id;
                    pollProgress();
                } catch (e) { alert('Extraction failed: ' + e.message); }
            };

            async function pollProgress() {
                const res = await fetch(`/progress/${currentJobId}`);
                const data = await res.json();
                
                document.getElementById('mini-progress').innerText = data.percent + '%';
                const logCont = document.getElementById('log-container');
                logCont.innerHTML = data.logs.map(l => `<div>${l}</div>`).join('');
                logCont.scrollTop = logCont.scrollHeight;

                if (data.status === 'completed') {
                    document.getElementById('job-status-pill').innerText = 'Complete!';
                    document.getElementById('job-status-pill').className = 'px-4 py-1 rounded-full bg-green-50 text-green-600 text-sm font-medium';
                    setTimeout(fetchResults, 1000);
                } else if (data.status === 'failed') {
                    alert('Job failed: ' + data.error);
                } else {
                    setTimeout(pollProgress, 1000);
                }
            }

            async function fetchResults() {
                const res = await fetch(`/results/${currentJobId}`);
                const data = await res.json();
                gridData = data.rows;
                metadata = data.metadata || {};
                if (gridData.length > 0) {
                    headers = gridData[0].map((_, i) => `Column ${i + 1}`);
                }
                renderGrid();
                renderMetadata();
                document.getElementById('upload-zone').classList.add('hidden');
                document.getElementById('editor-zone').classList.remove('hidden');
                document.getElementById('log-zone').classList.add('hidden');
            }

            // --- Grid Features (Optimized) ---
            function renderGrid() {
                const head = document.getElementById('tableHead');
                const body = document.getElementById('tableBody');
                
                // Build header HTML
                let headerHTML = '<tr><th class="w-8 text-center"><input type="checkbox" id="selectAllCheckbox" title="Select All"></th>';
                for (let i = 0; i < headers.length; i++) {
                    headerHTML += `<th class="cursor-grab hover:bg-slate-200" draggable="true" data-col="${i}"><span contenteditable="true" data-col="${i}">${headers[i]}</span></th>`;
                }
                headerHTML += '</tr>';
                head.innerHTML = headerHTML;
                
                // Build body HTML (limit cell display length for performance)
                let bodyHTML = '';
                for (let rIdx = 0; rIdx < gridData.length; rIdx++) {
                    const row = gridData[rIdx];
                    const isSelected = selectedRows.includes(rIdx);
                    const isHeaderSelected = selectedHeaderRows.includes(rIdx);
                    bodyHTML += `<tr data-row="${rIdx}" class="${isSelected ? 'bg-blue-100' : ''} ${isHeaderSelected ? 'header-selected' : ''}">`;
                    bodyHTML += `<td class="text-center"><input type="checkbox" ${isSelected ? 'checked' : ''} data-row="${rIdx}"></td>`;
                    for (let cIdx = 0; cIdx < row.length; cIdx++) {
                        const cellText = row[cIdx] || '';
                        // Truncate very long cells for display performance
                        const displayText = cellText.length > 200 ? cellText.slice(0, 200) + '...' : cellText;
                        bodyHTML += `<td contenteditable="true" data-row="${rIdx}" data-col="${cIdx}" title="${cellText.length > 200 ? 'Click to edit full text' : ''}">${displayText}</td>`;
                    }
                    bodyHTML += '</tr>';
                }
                body.innerHTML = bodyHTML;
                
                // Attach event listeners using delegation (more efficient)
                attachGridEventListeners();
                updateRowCount();
            }

            // Event delegation for better performance
            function attachGridEventListeners() {
                const head = document.getElementById('tableHead');
                const body = document.getElementById('tableBody');
                
                // Header events
                head.querySelector('#selectAllCheckbox').onchange = (e) => toggleAllRows(e.target.checked);
                
                head.ondragstart = (e) => {
                    const th = e.target.closest('th[data-col]');
                    if (th) onColDragStart(parseInt(th.dataset.col));
                };
                head.ondragover = (e) => e.preventDefault();
                head.ondrop = (e) => {
                    const th = e.target.closest('th[data-col]');
                    if (th) onColDrop(parseInt(th.dataset.col));
                };
                head.onclick = (e) => {
                    const th = e.target.closest('th[data-col]');
                    if (th && !e.target.matches('span')) selectColumn(parseInt(th.dataset.col));
                };
                
                // Header span blur for editing
                head.querySelectorAll('span[data-col]').forEach(span => {
                    span.onblur = () => updateHeader(parseInt(span.dataset.col), span.innerText);
                });
                
                // Body events using delegation
                body.onclick = (e) => {
                    const row = e.target.closest('tr[data-row]');
                    if (row && !e.target.matches('input')) {
                        handleRowClick(parseInt(row.dataset.row), row);
                    }
                };
                
                body.onchange = (e) => {
                    if (e.target.matches('input[type="checkbox"]')) {
                        toggleRowSelect(parseInt(e.target.dataset.row), e.target.checked);
                    }
                };
                
                body.onblur = (e) => {
                    if (e.target.matches('td[data-row]')) {
                        const r = parseInt(e.target.dataset.row);
                        const c = parseInt(e.target.dataset.col);
                        gridData[r][c] = e.target.innerText;
                    }
                };
                body.addEventListener('blur', (e) => {
                    if (e.target.matches('td[data-row]')) {
                        const r = parseInt(e.target.dataset.row);
                        const c = parseInt(e.target.dataset.col);
                        gridData[r][c] = e.target.innerText;
                    }
                }, true);
            }

            function handleRowClick(rIdx, el) {
                if (headerSelectMode) {
                    // Toggle selection for header merge
                    const idx = selectedHeaderRows.indexOf(rIdx);
                    if (idx > -1) {
                        selectedHeaderRows.splice(idx, 1);
                        el.classList.remove('header-selected');
                    } else {
                        selectedHeaderRows.push(rIdx);
                        el.classList.add('header-selected');
                    }
                    // Show/hide merge buttons based on selection count
                    const mergeBtn = document.getElementById('mergeHeadersBtn');
                    const expandBtn = document.getElementById('expandColumnsBtn');
                    if (selectedHeaderRows.length >= 2) {
                        mergeBtn.classList.remove('hidden');
                        expandBtn.classList.remove('hidden');
                    } else {
                        mergeBtn.classList.add('hidden');
                        expandBtn.classList.add('hidden');
                    }
                } else {
                    // Normal single row selection
                    selectedRowIndex = rIdx;
                    highlightRow(el);
                }
            }

            function highlightRow(el) {
                document.querySelectorAll('tbody tr').forEach(r => r.classList.remove('bg-blue-50', 'border-l-4', 'border-blue-500'));
                el.classList.add('bg-blue-50', 'border-l-4', 'border-blue-500');
            }

            // --- Multi-Row Selection (Optimized - no full re-render) ---
            function toggleRowSelect(rIdx, checked) {
                if (checked) {
                    if (!selectedRows.includes(rIdx)) selectedRows.push(rIdx);
                } else {
                    const idx = selectedRows.indexOf(rIdx);
                    if (idx > -1) selectedRows.splice(idx, 1);
                }
                // Update only the affected row's class - no full re-render
                const row = document.querySelectorAll('tbody tr')[rIdx];
                if (row) {
                    row.classList.toggle('bg-blue-100', checked);
                }
                updateRowCount();
            }

            function toggleAllRows(checked) {
                selectedRows = checked ? gridData.map((_, i) => i) : [];
                // Update all checkboxes and row styles without re-render
                document.querySelectorAll('tbody tr').forEach((row, i) => {
                    const checkbox = row.querySelector('input[type="checkbox"]');
                    if (checkbox) checkbox.checked = checked;
                    row.classList.toggle('bg-blue-100', checked);
                });
                updateRowCount();
            }

            function updateRowCount() {
                document.getElementById('row-count').innerText = `${gridData.length} rows | ${selectedRows.length} selected`;
            }

            // --- Header Editing ---
            function updateHeader(colIdx, newName) {
                headers[colIdx] = newName.trim();
            }

            // --- Column Drag & Drop Reordering ---
            function onColDragStart(colIdx) {
                dragColIdx = colIdx;
            }

            function onColDrop(targetIdx) {
                if (dragColIdx === null || dragColIdx === targetIdx) return;
                
                // Swap headers
                const tempHeader = headers[dragColIdx];
                headers.splice(dragColIdx, 1);
                headers.splice(targetIdx, 0, tempHeader);
                
                // Swap all data columns
                gridData = gridData.map(row => {
                    const newRow = [...row];
                    const tempCell = newRow[dragColIdx];
                    newRow.splice(dragColIdx, 1);
                    newRow.splice(targetIdx, 0, tempCell);
                    return newRow;
                });
                
                dragColIdx = null;
                renderGrid();
            }

            function updateCell(r, e) {
                const colIdx = Array.from(e.target.parentElement.children).indexOf(e.target) - 1;  // -1 for checkbox column
                if (colIdx >= 0) gridData[r][colIdx] = e.target.innerText;
            }

            // --- Data Cleanup Tools ---
            function autoCleanup() {
                if (gridData.length < 2) return;
                const cleaned = [];
                let current = null;

                // Smart Logic: If Column 0 is empty, join with previous row
                gridData.forEach(row => {
                    const anchor = row[0].trim();
                    if (anchor !== "") {
                        if (current) cleaned.push(current);
                        current = [...row];
                    } else if (current) {
                        row.forEach((cell, i) => {
                            if (cell.trim()) current[i] += " " + cell.trim();
                        });
                    } else {
                        cleaned.push(row);
                    }
                });
                if (current) cleaned.push(current);
                gridData = cleaned;
                renderGrid();
            }

            function setAsHeader() {
                if (selectedRowIndex === null) return alert('Select a row first');
                headers = [...gridData[selectedRowIndex]];
                gridData = gridData.slice(selectedRowIndex + 1);
                selectedRowIndex = null;
                renderGrid();
            }

            function toggleHeaderSelectMode() {
                headerSelectMode = !headerSelectMode;
                const toggleBtn = document.getElementById('headerSelectToggle');
                const mergeBtn = document.getElementById('mergeHeadersBtn');
                const expandBtn = document.getElementById('expandColumnsBtn');
                
                if (headerSelectMode) {
                    toggleBtn.classList.add('toggle-active');
                    selectedHeaderRows = [];
                } else {
                    toggleBtn.classList.remove('toggle-active');
                    selectedHeaderRows = [];
                    mergeBtn.classList.add('hidden');
                    expandBtn.classList.add('hidden');
                    renderGrid();
                }
            }

            function mergeHeaderRows() {
                if (selectedHeaderRows.length < 2) return alert('Select at least 2 rows');
                
                // Sort selected rows to process in order
                selectedHeaderRows.sort((a, b) => a - b);
                
                // Get the number of columns from the first selected row
                const numCols = gridData[selectedHeaderRows[0]].length;
                const mergedHeader = [];
                
                // For each column, concatenate values from all selected rows
                for (let col = 0; col < numCols; col++) {
                    const parts = [];
                    for (const rowIdx of selectedHeaderRows) {
                        const cellValue = gridData[rowIdx][col].trim();
                        if (cellValue) parts.push(cellValue);
                    }
                    mergedHeader.push(parts.join(' '));
                }
                
                // Set as new headers
                headers = mergedHeader;
                
                // Remove all selected rows from data (in reverse order to preserve indices)
                const sortedDesc = [...selectedHeaderRows].sort((a, b) => b - a);
                for (const rowIdx of sortedDesc) {
                    gridData.splice(rowIdx, 1);
                }
                
                // Reset mode and selection
                selectedHeaderRows = [];
                headerSelectMode = false;
                document.getElementById('headerSelectToggle').classList.remove('toggle-active');
                document.getElementById('mergeHeadersBtn').classList.add('hidden');
                document.getElementById('expandColumnsBtn').classList.add('hidden');
                
                renderGrid();
            }

            function expandAndAlignColumns() {
                if (selectedHeaderRows.length < 2) return alert('Select at least 2 header rows');
                
                // Sort selected rows to process in order
                selectedHeaderRows.sort((a, b) => a - b);
                const numHeaderRows = selectedHeaderRows.length;
                
                // Get number of columns from first header row
                const numCols = gridData[selectedHeaderRows[0]].length;
                
                // Build interleaved header: H1_C1, H2_C1, H1_C2, H2_C2, ...
                const interleavedHeader = [];
                for (let col = 0; col < numCols; col++) {
                    for (const rowIdx of selectedHeaderRows) {
                        const cellValue = (gridData[rowIdx][col] || '').trim();
                        interleavedHeader.push(cellValue);
                    }
                }
                
                // Remove header rows from data (in reverse order to preserve indices)
                const sortedDesc = [...selectedHeaderRows].sort((a, b) => b - a);
                for (const rowIdx of sortedDesc) {
                    gridData.splice(rowIdx, 1);
                }
                
                // Interleave data rows: every N consecutive rows become 1 interleaved row
                // D1_C1, D2_C1, D1_C2, D2_C2, ...
                const interleavedData = [];
                
                for (let i = 0; i < gridData.length; i += numHeaderRows) {
                    const interleavedRow = [];
                    for (let col = 0; col < numCols; col++) {
                        for (let h = 0; h < numHeaderRows; h++) {
                            const dataRow = gridData[i + h] || [];
                            const cellValue = (dataRow[col] || '').trim();
                            interleavedRow.push(cellValue);
                        }
                    }
                    interleavedData.push(interleavedRow);
                }
                
                // Set new headers and data
                headers = interleavedHeader;
                gridData = interleavedData;
                
                // Reset mode and selection
                resetHeaderSelectMode();
                renderGrid();
            }

            function resetHeaderSelectMode() {
                selectedHeaderRows = [];
                headerSelectMode = false;
                document.getElementById('headerSelectToggle').classList.remove('toggle-active');
                document.getElementById('mergeHeadersBtn').classList.add('hidden');
                document.getElementById('expandColumnsBtn').classList.add('hidden');
            }

            // --- Merge Row Pairs (for BOQ-style tables with alternating data rows) ---
            function mergeRowPairs() {
                if (gridData.length < 2) return alert('Need at least 2 data rows to merge');
                
                const numCols = gridData[0].length;
                const mergedData = [];
                
                // Merge every 2 consecutive rows
                for (let i = 0; i < gridData.length; i += 2) {
                    const row1 = gridData[i] || [];
                    const row2 = gridData[i + 1] || [];
                    
                    const mergedRow = [];
                    for (let col = 0; col < numCols; col++) {
                        const val1 = (row1[col] || '').trim();
                        const val2 = (row2[col] || '').trim();
                        
                        // Take non-empty value, prefer row1 if both have values
                        // Or concatenate if both have values and they're different
                        if (val1 && val2 && val1 !== val2) {
                            mergedRow.push(val1 + ' / ' + val2);
                        } else {
                            mergedRow.push(val1 || val2);
                        }
                    }
                    mergedData.push(mergedRow);
                }
                
                gridData = mergedData;
                selectedRows = [];
                renderGrid();
            }


            let selectedColIdx = null;
            function selectColumn(i) {
                selectedColIdx = i;
                document.querySelectorAll('th').forEach(th => th.classList.remove('bg-red-100'));
                document.querySelectorAll('th')[i + 1].classList.add('bg-red-100');  // +1 for checkbox column
            }

            function deleteColumn() {
                if (selectedColIdx === null) return alert('Click a column header to select it');
                headers.splice(selectedColIdx, 1);
                gridData = gridData.map(row => {
                    const newRow = [...row];
                    newRow.splice(selectedColIdx, 1);
                    return newRow;
                });
                selectedColIdx = null;
                renderGrid();
            }

            function deleteRow() {
                // Delete multiple selected rows or single selected row
                if (selectedRows.length > 0) {
                    // Delete in reverse order to preserve indices
                    selectedRows.sort((a, b) => b - a).forEach(idx => {
                        gridData.splice(idx, 1);
                    });
                    selectedRows = [];
                } else if (selectedRowIndex !== null) {
                    gridData.splice(selectedRowIndex, 1);
                    selectedRowIndex = null;
                } else {
                    return alert('Select rows using checkboxes or click a row first');
                }
                renderGrid();
            }

            // --- Metadata Functions ---
            function renderMetadata() {
                const container = document.getElementById('metadata-content');
                const keys = Object.keys(metadata);
                
                if (keys.length === 0) {
                    container.innerHTML = '<div class="text-slate-400 italic col-span-full">No metadata extracted. Fields will appear here after processing.</div>';
                    return;
                }
                
                container.innerHTML = keys.map(key => `
                    <div class="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div class="text-xs text-slate-400 uppercase tracking-wide mb-1">${key}</div>
                        <div class="text-slate-800 font-medium break-words" contenteditable="true" onblur="updateMetadata('${key}', this.innerText)">${metadata[key] || '<span class=\\'text-slate-300\\'>-</span>'}</div>
                    </div>
                `).join('');
            }

            function updateMetadata(key, value) {
                metadata[key] = value;
            }

            function toggleMetadataPanel() {
                metadataCollapsed = !metadataCollapsed;
                const content = document.getElementById('metadata-content');
                const chevron = document.getElementById('metadata-chevron');
                
                if (metadataCollapsed) {
                    content.classList.add('hidden');
                    chevron.style.transform = 'rotate(180deg)';
                } else {
                    content.classList.remove('hidden');
                    chevron.style.transform = 'rotate(0deg)';
                }
            }

            // --- Final Export ---
            async function exportData() {
                const format = document.getElementById('exportFormat').value;
                const includeMetadata = document.getElementById('includeMetadata').checked;
                
                const payload = {
                    headers: headers,
                    rows: gridData,
                    format: format,
                    metadata: includeMetadata ? metadata : {}
                };

                const res = await fetch('/export', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `cleaned_data.${format}`;
                document.body.appendChild(a);
                a.click();
                a.remove();
            }
        </script>
    </body>
    </html>
    """



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
        jobs[job_id]["pdf_path"] = tmp_path  # Store PDF path for metadata extraction
        jobs[job_id]["percent"] = 100
        log_progress(job_id, "✨ Complete!")

    except Exception as e:
        log_progress(job_id, f"❌ Error: {str(e)}")
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)
        # Only delete PDF on failure
        if os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except:
                pass


@app.post("/extract_table")
async def extract_table_sync(
    file: UploadFile = File(...),
    output_format: str = Query("csv", enum=["json", "csv"]),
    top_margin: int = 0,
    bottom_margin: int = 1000,
):
    """Synchronous extraction for legacy clients."""
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        all_rows = []
        extracted_data = []
        with pdfplumber.open(tmp_path) as pdf:
            for i, page in enumerate(pdf.pages):
                if top_margin > 0 or bottom_margin < page.height:
                    page = page.crop((0, top_margin, page.width, bottom_margin))
                tables = page.extract_tables()
                if tables:
                    for table in tables:
                        cleaned = [[str(c or "").strip() for c in row] for row in table]
                        cleaned = [row for row in cleaned if any(row)]
                        if cleaned:
                            all_rows.extend(cleaned)
                            extracted_data.append({"page": i+1, "rows": cleaned})

        if output_format == "csv":
            result_path = tmp_path + ".csv"
            with open(result_path, 'w', newline='', encoding='utf-8') as f:
                csv.writer(f).writerows(all_rows)
        else:
            result_path = tmp_path + ".json"
            with open(result_path, 'w', encoding='utf-8') as f:
                json.dump({"data": extracted_data}, f, indent=2)

        return FileResponse(result_path, filename=f"extracted.{output_format}")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


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


@app.get("/results/{job_id}")
async def get_job_results(job_id: str):
    if job_id not in jobs or jobs[job_id]["status"] != "completed":
        raise HTTPException(status_code=404, detail="Results not ready")
    
    file_path = jobs[job_id]["result_file"]
    pdf_path = jobs[job_id].get("pdf_path", "")
    
    # Extract rows from result file
    if file_path.endswith(".json"):
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # Flatten pages into a single row list if needed
            rows = []
            for page in data.get("data", []):
                rows.extend(page.get("rows", []))
    else:
        # Default to reading CSV if it was saved that way
        rows = []
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            rows = list(reader)
    
    # Extract metadata from PDF
    metadata = {}
    if pdf_path and os.path.exists(pdf_path):
        metadata = extract_pdf_metadata(pdf_path)
    
    return {"rows": rows, "metadata": metadata}


def extract_pdf_metadata(pdf_path: str) -> dict:
    """Extract metadata fields from PDF using regex patterns."""
    metadata = {}
    
    # Define regex patterns for each metadata field (matching "Label :" format)
    patterns = {
        "Order No.": r"Order\s*No\.?\s*:\s*(\d+)",
        "Order Amend No.": r"Order\s*Amend\.?\s*No\.?\s*:\s*(\d+)",
        "Order Validity Start": r"Order\s*Validity\s*Start\s*:\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})",
        "Order Validity End": r"Order\s*Validity\s*End\s*:\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})",
        "Project Code": r"Project\s*Code\s*:\s*([A-Za-z0-9\-_]+)",
        "Order Date": r"Order\s*Date\s*:\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})",
        "Order Amend Date": r"Order\s*Amend\.?\s*Date\s*:\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})",
        "Order Type": r"Order\s*Type\s*:\s*([A-Za-z\s]+?)(?=\n|$)",
        "Project Description": r"Project\s*Description\s*:\s*(.+?)(?=\n|$)",
        "Invoice To": r"Invoice\s*To\s*:\s*(.+?)(?=\n|$)",
        "Contractor": r"Contractor\s*:\s*(.+?)(?=\n|$)",
        "Contractor Name": r"Contractor\s*Name\s*:\s*(.+?)(?=\n|$)",
        "Contact Address": r"Contact\s*Address\s*:\s*(.+?)(?=\n|$)",
        "Mobile Number": r"Mobile\s*(?:No\.?|Number)?\s*:\s*(\+?[\d\-\s]{10,})",
        "PAN": r"PAN\s*(?:No\.?)?\s*:\s*([A-Z]{5}\d{4}[A-Z])",
        "GSTIN No.": r"GSTIN\s*(?:No\.?)?\s*:\s*(\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d])",
        "UAM No.": r"UAM\s*(?:No\.?)?\s*:\s*([A-Za-z0-9\-]+)",
        "Email": r"(?:Email|E-mail)\s*:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})",
        "SCOPE of WORK": r"SCOPE\s*(?:of|OF)\s*WORK\s*:\s*(.+?)(?=\n\n|$)",
    }
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            # Extract text from first few pages (metadata usually in header)
            full_text = ""
            for i, page in enumerate(pdf.pages[:3]):  # Check first 3 pages
                full_text += page.extract_text() or ""
            
            # Apply each regex pattern
            for field_name, pattern in patterns.items():
                match = re.search(pattern, full_text, re.IGNORECASE | re.MULTILINE)
                if match:
                    metadata[field_name] = match.group(1).strip()
                else:
                    metadata[field_name] = ""
    except Exception as e:
        print(f"Error extracting metadata: {e}")
    
    return metadata


@app.post("/export")
async def export_cleaned_data(request: Request):
    data = await request.json()
    headers = data.get("headers", [])
    rows = data.get("rows", [])
    file_format = data.get("format", "csv")
    metadata = data.get("metadata", {})
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_format}") as tmp:
        if file_format == "csv":
            with open(tmp.name, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                
                # Write metadata rows at the top if present
                if metadata:
                    writer.writerow(["=== METADATA ===", ""])
                    for key, value in metadata.items():
                        writer.writerow([key, value])
                    writer.writerow([])  # Empty row separator
                    writer.writerow(["=== DATA ===", ""])
                
                if headers:
                    writer.writerow(headers)
                writer.writerows(rows)
        else:
            with open(tmp.name, 'w', encoding='utf-8') as f:
                json.dump({"metadata": metadata, "headers": headers, "rows": rows}, f, indent=2)
        
        return FileResponse(tmp.name, filename=f"cleaned_data.{file_format}")




if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

