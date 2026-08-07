# AI Insights Module

Status: Draft  
Primary wave: E - Analytics and Extensibility  
Related modules: Dashboard, Executive Dashboard, Progress, Planning, Quality, Snag, EHS, Cost/Budget, Audit

## Purpose

Produces AI-assisted summaries, risks, trends, recommendations, or explanations from approved SETU data sources.

## Documentation Requirements

Document insight types, source data, prompts/models/providers, refresh, confidence/uncertainty, citations or drill-downs, human review, feedback, retention, and failure/fallback behavior. Clearly distinguish generated inference from source fact.

## Code and Review

Inspect `backend/src/ai-insights/`, `frontend/src/services/aiInsights.service.ts`, AI views, configuration, provider credentials, and audit integration. Confirm data minimization and whether any external model receives project data.

## Security, Testing, Decisions

Restrict sensitive data, log model/provider failures without secrets, and require human validation for consequential decisions. Test stale/empty data, prompt/model failures, permissions, hallucination safeguards, citations, and reproducibility. Confirm approved model/provider, cost limits, and retention.

