# SETU Development Guide

This document outlines the workflows for developing and deploying the SETU application.

## 🚀 Launching the Application

Use the `launch_setu.bat` script in the root directory. It provides four modes:

### 1. Quick Start (Use existing build)
*   **Best for**: Just running the app to check something.
*   **Behavior**: Starts the containers exactly as they were last built. Does NOT update with new code changes.
*   **Speed**: Very Fast.

### 2. Rebuild and Start (Apply code changes)
*   **Best for**: "Production-like" testing of new changes.
*   **Behavior**: Recompiles the `Dockerfile` into a new image and restarts.
*   **Speed**: Slow (builds entire project).
*   **Note**: Changes made *after* the build starts will NOT be seen until you rebuild again.

### 3. Full Reset (Wipe Database)
*   **Best for**: Cleaning up corrupted data or starting fresh.
*   **Behavior**: Deletes the database volume, rebuilds images, and starts fresh.

### 4. Dev Mode (Hot Reload - Recommended for Coding) ⭐
*   **Best for**: Active Development.
*   **Behavior**:
    *   Starts Backend at `http://localhost:3000` (NestJS Watch Mode).
    *   Starts Frontend at `http://localhost:5173` (Vite Dev Server).
    *   **Hot Reload**: Any save to a file in `./frontend` or `./backend` is immediately reflected in the running app.
*   **Speed**: Initial start is medium, but updates are Instant.

## 🛠 Features & Architecture

### Backend (NestJS)
*   **Location**: `/backend`
*   **Port**: 3000
*   **Database**: PostgreSQL (Service: `db`)
*   **Key Folders**:
    *   `src/projects`: Project management logic.
    *   `src/wbs`: WBS, Activities, Schedule logic.
    *   `src/eps`: Enterprise Project Structure.
    *   `src/boq`: Bill of Quantities & Measurements.
    *   `src/planning`: CPM Engine & Planning.
    *   `src/quality`: Inspections, NCRs, Audits.
    *   `src/ehs`: Safety Incident, Manhours.
    *   `src/labor`: Daily Labor Reporting.

### Frontend (React + Vite)
*   **Location**: `/frontend`
*   **Port**: 5173 (Dev) / 3000 (Prod via NestJS Static Serve)
*   **Key Components**:
    *   `pages/EpsPage.tsx`: The main entry point (Project Hierarchy).
    *   `views/quality/*`: Quality Control module views.
    *   `views/ehs/*`: Safety module views.
    *   `pages/schedule/SchedulePage.tsx`: The main Gantt/Schedule grid.

## ✅ Build & Verification

Before pushing code or building Docker images, verify the build locally:

### Backend
1.  Navigate to `/backend`
2.  Run `npm run build` -> Should exit with code 0.
3.  Run `npm run lint` -> Check for major errors (auto-fix with `--fix`).

### Frontend
1.  Navigate to `/frontend`
2.  Run `npm run build` -> Compiles TS and runs Vite build.

## ⚠️ Important Notes
*   **Node Modules**: In Dev Mode, the container uses its *internal* `node_modules`. If you add a new dependency in `package.json`, you must **restart Dev Mode** (it will rebuild) so the container installs the new package.
*   **Ports**:
    *   Prod/Rebuild Mode: Everything is at `localhost:3000`.
    *   Dev Mode: Frontend is `localhost:5173`, Backend is `localhost:3000`.
