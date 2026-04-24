# Azure Requirements (Cheap + Best Fit for SETU)

This is a lean, production-safe Azure footprint sized for our current load (around 10 RPS, ~1,500 users). It favors managed services that scale down when idle and keep ops light. Prices vary by region, but the selections below are cost-efficient and stable for this workload.

## Recommended Services (Staging + Production)

### 1) Frontend Hosting
- **Azure Static Web Apps (Standard)** for the React frontend.
- Reason: Simple, low-ops static hosting with a low-cost standard tier and built-in TLS/CDN edge.
- Note: Static Web Apps is a global service in the calculator and does not expose a region selector.

### 2) Backend API + PDF Tool
- **Azure Container Apps (Consumption plan)** for:
  - `setu-backend`
  - `setu-pdf-tool`
- Reason: Serverless container model with per-second billing, scale-to-zero, and request-based scaling. Ideal for cost control while still scaling for bursts.

### 3) Database
- **Azure Database for PostgreSQL – Flexible Server**
  - **Staging:** Burstable `B1ms` (1 vCore, 2 GiB)
  - **Production:** Burstable `B2ms` (2 vCore, 8 GiB) or General Purpose 2–4 vCores if sustained load rises
- Reason: Burstable SKUs and stop/start options keep cost low while still supporting production reliability.

### 4) Container Registry
- **Azure Container Registry (Basic)** to store images.
- Reason: Lowest-cost managed registry that integrates cleanly with Container Apps.

### 5) Object Storage
- **Azure Storage (Blob, Standard LRS)** for file uploads/exports (image-heavy workloads assumed).

### 6) Secrets & Config
- **Azure Key Vault (Standard)** to store DB credentials, JWT secret, and API keys.

### 7) Observability
- **Azure Monitor + Application Insights** for logs, metrics, and traces.

## Sizing Guidance (Initial Targets)

### Backend (Container Apps)
- **CPU/Memory:** start at `1 vCPU / 2–4 GiB` per replica
- **Scale:** min replicas = 2 (prod HA), 0 (staging); max replicas = 4–8
- **Ingress:** enable HTTP, HTTPS only

### PDF Tool (Container Apps)
- **CPU/Memory:** `0.5–1 vCPU / 1–2 GiB`
- **Scale:** min replicas = 1 (prod), 0 (staging); max = 2–4

### Database (PostgreSQL Flexible Server)
- **Staging:** B1ms, 64–128 GiB storage
- **Prod:** B2ms or GP 2–4 vCores, 128–256 GiB storage
- **Backups:** 7–14 days retention (increase for compliance)

## Environment Separation
- **Resource groups:** `setu-staging-rg` and `setu-prod-rg`
- **Separate DBs + Storage accounts** for staging and prod
- **Separate Key Vaults** to avoid secret crossover
- **Separate Container Apps environments** to isolate scaling and costs

## Cost-Control Defaults
- Staging services scale-to-zero where possible.
- Postgres stop/start enabled for staging off-hours.
- Log ingestion cap alerts (10 GB/month to start).

## Latest Approximate Monthly Estimate (ExportedEstimate (5).xlsx)

Region baseline used in the calculator:
- **South India** for compute, database, storage, registry, Key Vault, Monitor
- **Static Web Apps** is global (no region selector)

| Service | Region | Key inputs | Estimated monthly cost (INR) |
|---|---|---|---:|
| Static Web Apps (Standard) | Global | 1 app, 250 GB bandwidth overages | 3,697 |
| Azure Container Apps | South India | Consumption, 1 vCPU/3 GiB, 2 min replicas, 2M req/month | 5,979 |
| PostgreSQL Flexible Server | South India | Burstable B2ms, 200 GiB storage | 10,075 |
| Azure Container Registry | South India | Basic tier | 474 |
| Key Vault | South India | 200k ops | 57 |
| Azure Monitor | South India | ~0.2 GB/day analytics logs + 1 GB/day auxiliary logs | 984 |
| Storage Accounts (Blob) | South India | 500 GB capacity + bandwidth | 1,227 |

**Total (approx): ₹22,494 / month**

Notes:
- If you reduce min replicas to 1, Container Apps cost drops further.
- Storage bandwidth is set higher to reflect heavy image upload/download usage.

## Step-by-Step Deployment Plan (Staging + Production)

1. Create two resource groups:
   - `setu-staging-rg`
   - `setu-prod-rg`
2. Create ACR in each RG (Basic tier).
3. Create PostgreSQL Flexible Server:
   - Staging: B1ms
   - Prod: B2ms
4. Create Container Apps Environments:
   - `setu-staging-aca`
   - `setu-prod-aca`
5. Build and push Docker images to ACR:
   - `setu-backend`
   - `setu-pdf-tool`
6. Deploy Container Apps:
   - Backend: 1 vCPU/2–4 GiB, min 2 (prod), 0 (staging)
   - PDF Tool: 0.5–1 vCPU/1–2 GiB, min 1 (prod), 0 (staging)
7. Configure environment variables:
   - `DATABASE_*`, `JWT_SECRET`, `PDF_TOOL_URL`
   - `TYPEORM_MIGRATIONS_RUN=true` for controlled migration runs
8. Deploy Frontend using Static Web Apps:
   - Set `VITE_API_URL` (or `REACT_APP_API_URL`)
9. Run migrations:
   - `npm run migration:run` once per environment
10. Lock down production:
   - Separate Key Vaults, DBs, storage accounts
   - Staging never points to prod DB

Full command-level steps are documented in:
- `docs/azure/AZURE_STAGING_PROD_DEPLOYMENT.md`
