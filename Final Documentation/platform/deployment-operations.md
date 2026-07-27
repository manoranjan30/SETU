# Deployment and Operations

Status: Draft  
Primary wave: F - Platform and Client Operations  
Related modules: Backend, frontend, Flutter, database, Plugins, App Config, Audit, Sync

## Purpose

Documents build, deployment, environment configuration, migrations, health checks, release, backup, recovery, monitoring, and incident response for SETU.

## Runtime Map

- Production/local services: `docker-compose.yml`
- Development services: `docker-compose.dev.yml`
- Backend: NestJS service, PostgreSQL, authentication/integrations
- Frontend: React/Vite application
- Mobile: Flutter build and release pipeline

## Required Documentation

Document environments, secrets, variables, ports, domains, database migrations, seed/reference data, artifact/version strategy, health/readiness, logging, backups, restore drills, rollback, feature flags, plugin deployment, and mobile release.

## Security, Testing, Decisions

Do not commit secrets. Test clean deployment, migration rollback, service failure, backup restore, access controls, and monitoring alerts. The external PDF extractor has been retired, so deployment checks should confirm `pdf-tool` and `PDF_TOOL_URL` are absent from active runtime config.
