# SETU Azure Deployment Checklist Mapped To This Repo

## Goal

Prepare the current codebase for the Azure production architecture described in:

- [AZURE_ARCHITECTURE_ONE_PAGER.md](C:/Users/omano/OneDrive%20-%20Puravankara%20Limited/Manoranjan/Antigravity%20Experiment/000%20Project%20PM/SETU/docs/azure/AZURE_ARCHITECTURE_ONE_PAGER.md)
- [AZURE_COSTED_BOM.md](C:/Users/omano/OneDrive%20-%20Puravankara%20Limited/Manoranjan/Antigravity%20Experiment/000%20Project%20PM/SETU/docs/azure/AZURE_COSTED_BOM.md)

## 1. Frontend Deployment Split

- [ ] Deploy frontend separately from the backend container
- [ ] Build frontend artifacts from [frontend/package.json](C:/Users/omano/OneDrive%20-%20Puravankara%20Limited/Manoranjan/Antigravity%20Experiment/000%20Project%20PM/SETU/frontend/package.json)
- [ ] Point frontend API base URL to the Azure API hostname
- [ ] Review [frontend/vite.config.ts](C:/Users/omano/OneDrive%20-%20Puravankara%20Limited/Manoranjan/Antigravity%20Experiment/000%20Project%20PM/SETU/frontend/vite.config.ts) so dev-only server/HMR settings are not relied on in production

Why:

- The current top-level [Dockerfile](C:/Users/omano/OneDrive%20-%20Puravankara%20Limited/Manoranjan/Antigravity%20Experiment/000%20Project%20PM/SETU/Dockerfile#L24) copies the built frontend into the NestJS image. That works, but it is not the cleanest Azure operating model for scale or rollback.

## 2. API Container Readiness

- [ ] Keep backend image build based on [Dockerfile](C:/Users/omano/OneDrive%20-%20Puravankara%20Limited/Manoranjan/Antigravity%20Experiment/000%20Project%20PM/SETU/Dockerfile)
- [ ] Add a production `/health` or `/ready` endpoint
- [ ] Add container health probes in Azure Container Apps
- [ ] Confirm `npm run start:prod:migrated` is safe for startup behavior in Azure

Repo mapping:

- [backend/package.json](C:/Users/omano/OneDrive%20-%20Puravankara%20Limited/Manoranjan/Antigravity%20Experiment/000%20Project%20PM/SETU/backend/package.json)
- [backend/src/app.controller.ts](C:/Users/omano/OneDrive%20-%20Puravankara%20Limited/Manoranjan/Antigravity%20Experiment/000%20Project%20PM/SETU/backend/src/app.controller.ts)

## 3. Replace Local Upload Storage

- [ ] Remove dependency on local `/uploads` for durable production storage
- [ ] Store uploaded files in Azure Blob Storage
- [ ] Store only blob URLs or blob keys in PostgreSQL
- [ ] Add signed download strategy if files should not be public
- [ ] Review all modules that currently use disk upload destinations

Repo mapping:

- [backend/src/main.ts](C:/Users/omano/OneDrive%20-%20Puravankara%20Limited/Manoranjan/Antigravity%20Experiment/000%20Project%20PM/SETU/backend/src/main.ts#L84)
- [backend/src/app.module.ts](C:/Users/omano/OneDrive%20-%20Puravankara%20Limited/Manoranjan/Antigravity%20Experiment/000%20Project%20PM/SETU/backend/src/app.module.ts#L364)
- [backend/src/quality/quality.controller.ts](C:/Users/omano/OneDrive%20-%20Puravankara%20Limited/Manoranjan/Antigravity%20Experiment/000%20Project%20PM/SETU/backend/src/quality/quality.controller.ts)
- [backend/src/design/design.controller.ts](C:/Users/omano/OneDrive%20-%20Puravankara%20Limited/Manoranjan/Antigravity%20Experiment/000%20Project%20PM/SETU/backend/src/design/design.controller.ts)
- [backend/src/common/upload.controller.ts](C:/Users/omano/OneDrive%20-%20Puravankara%20Limited/Manoranjan/Antigravity%20Experiment/000%20Project%20PM/SETU/backend/src/common/upload.controller.ts)

## 4. Secrets And Identity

- [ ] Move JWT secret to Azure Key Vault
- [ ] Move DB credentials to Azure Key Vault
- [ ] Remove `firebase-service-account.json` from the runtime image path
- [ ] Replace file-based Firebase credential loading with Key Vault or managed identity flow where possible

Repo mapping:

- [Dockerfile](C:/Users/omano/OneDrive%20-%20Puravankara%20Limited/Manoranjan/Antigravity%20Experiment/000%20Project%20PM/SETU/Dockerfile#L21)
- [backend/package.json](C:/Users/omano/OneDrive%20-%20Puravankara%20Limited/Manoranjan/Antigravity%20Experiment/000%20Project%20PM/SETU/backend/package.json)
- [backend/src/auth/auth.module.ts](C:/Users/omano/OneDrive%20-%20Puravankara%20Limited/Manoranjan/Antigravity%20Experiment/000%20Project%20PM/SETU/backend/src/auth/auth.module.ts)

## 5. Database Hardening

- [ ] Deploy Azure Database for PostgreSQL Flexible Server
- [ ] Run TypeORM migrations against Azure PostgreSQL before traffic cutover
- [ ] Confirm pool sizing per API replica
- [ ] Add slow-query logging and query monitoring
- [ ] Validate indexes for dashboard, planning, progress, and design read flows

Repo mapping:

- [backend/src/data-source.ts](C:/Users/omano/OneDrive%20-%20Puravankara%20Limited/Manoranjan/Antigravity%20Experiment/000%20Project%20PM/SETU/backend/src/data-source.ts)
- [backend/src/app.module.ts](C:/Users/omano/OneDrive%20-%20Puravankara%20Limited/Manoranjan/Antigravity%20Experiment/000%20Project%20PM/SETU/backend/src/app.module.ts#L196)
- [load-tests/k6/reports/20260328-191256/load-test-report.md](C:/Users/omano/OneDrive%20-%20Puravankara%20Limited/Manoranjan/Antigravity%20Experiment/000%20Project%20PM/SETU/load-tests/k6/reports/20260328-191256/load-test-report.md#L11)

## 6. Observability

- [ ] Add Application Insights SDK or OpenTelemetry instrumentation for NestJS
- [ ] Log correlation IDs across requests
- [ ] Emit structured logs for database, upload, auth, and slow endpoints
- [ ] Create alerts for:
- [ ] API 5xx rate
- [ ] API p95 latency
- [ ] container CPU and memory
- [ ] PostgreSQL CPU and connection pressure

## 7. Networking And Security

- [ ] Put Azure Front Door in front of frontend and API
- [ ] Enable WAF managed rules
- [ ] Restrict backend ingress to Front Door where practical
- [ ] Prefer private access from Container Apps to PostgreSQL, Blob, and Key Vault
- [ ] Review CORS configuration for production domains

Repo mapping:

- [backend/src/main.ts](C:/Users/omano/OneDrive%20-%20Puravankara%20Limited/Manoranjan/Antigravity%20Experiment/000%20Project%20PM/SETU/backend/src/main.ts#L59)

## 8. CI/CD

- [ ] Build frontend and backend separately in CI
- [ ] Push backend image to Azure Container Registry
- [ ] Deploy frontend to Static Web Apps
- [ ] Deploy backend to Container Apps using revision-based rollout
- [ ] Run migrations before switching production traffic
- [ ] Add rollback path to previous revision

Repo mapping:

- [Dockerfile](C:/Users/omano/OneDrive%20-%20Puravankara%20Limited/Manoranjan/Antigravity%20Experiment/000%20Project%20PM/SETU/Dockerfile)
- [docker-compose.yml](C:/Users/omano/OneDrive%20-%20Puravankara%20Limited/Manoranjan/Antigravity%20Experiment/000%20Project%20PM/SETU/docker-compose.yml)
- [docker-compose.dev.yml](C:/Users/omano/OneDrive%20-%20Puravankara%20Limited/Manoranjan/Antigravity%20Experiment/000%20Project%20PM/SETU/docker-compose.dev.yml)

## 9. Performance Validation Before Production

- [ ] Re-run k6 tests against a production-like Azure environment
- [ ] Produce valid p50, p95, p99, error-rate, and throughput metrics
- [ ] Do not sign off capacity based only on local Docker runs
- [ ] Validate all critical read flows, not just auth

Repo mapping:

- [load-tests/k6/README.md](C:/Users/omano/OneDrive%20-%20Puravankara%20Limited/Manoranjan/Antigravity%20Experiment/000%20Project%20PM/SETU/load-tests/k6/README.md)
- [load-tests/k6/reports/20260328-191256/load-test-report.md](C:/Users/omano/OneDrive%20-%20Puravankara%20Limited/Manoranjan/Antigravity%20Experiment/000%20Project%20PM/SETU/load-tests/k6/reports/20260328-191256/load-test-report.md)

## 10. Go-Live Gate

Ready for go-live only when:

- [ ] file storage is on Blob Storage
- [ ] secrets are removed from the image and env-file sprawl
- [ ] health probes are in place
- [ ] k6 read scenarios pass in Azure
- [ ] alerts and dashboards are live
- [ ] rollback to prior revision is tested
