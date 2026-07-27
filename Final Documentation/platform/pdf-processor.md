# PDF Processor Service - Retired

Status: Retired  
Primary wave: F - Platform and Client Operations  
Related modules: Design, Work Documents, BOQ, Reports, Plugins, Deployment

## Purpose

The external Python PDF extractor sidecar has been removed from SETU. Internal PDF generation, PDF viewing, uploads, exports, and in-process backend PDF parsing remain part of the app where they are implemented inside backend/frontend modules.

## Code and Runtime Map

- Removed runtime service: `pdf-tool`
- Removed setup path: `tools/pdf_processor/`
- Removed configuration: `PDF_TOOL_URL`, `VITE_PDF_TOOL_URL`
- Current runtime services: backend, frontend, PostgreSQL

## Required Documentation

Document any remaining module-local PDF behavior where it belongs: Quality reports, Design previews, Work Document uploads, Template Builder manual zones, and backend in-process parsers.

## Testing and Operations

After removal, verify Docker Compose starts only `db`, `backend`, and `frontend` in development, and only `db` plus `app` in production-like local compose. Also verify no UI navigation points to the retired extractor port.
