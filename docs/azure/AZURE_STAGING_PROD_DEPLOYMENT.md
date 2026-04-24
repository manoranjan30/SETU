# Azure Staging + Production Deployment (Step-by-Step)

This guide assumes our standard Docker images (`setu-backend`, `setu-pdf-tool`) and a React frontend. It keeps staging and production fully isolated so prod data stays safe.

## Current Estimate Snapshot (ExportedEstimate (5).xlsx)

Region baseline:
- South India for compute, database, storage, registry, Key Vault, Monitor
- Static Web Apps is global (no region selector)

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

## 0) Prereqs
- Azure subscription
- Azure CLI installed and logged in
- Docker Desktop signed in to Azure Container Registry (ACR)

## 1) Create Resource Groups

```bash
az group create -n setu-staging-rg -l centralindia
az group create -n setu-prod-rg -l centralindia
```

## 2) Create Container Registry (one per env)

```bash
az acr create -g setu-staging-rg -n setustagingacr -s Basic
az acr create -g setu-prod-rg -n setuprodacr -s Basic
```

Login:

```bash
az acr login -n setustagingacr
az acr login -n setuprodacr
```

## 3) Create PostgreSQL Flexible Server

**Staging**
```bash
az postgres flexible-server create \
  -g setu-staging-rg -n setu-staging-pg \
  --tier Burstable --sku-name B1ms \
  --storage-size 128 \
  --admin-user setuadmin
```

**Production**
```bash
az postgres flexible-server create \
  -g setu-prod-rg -n setu-prod-pg \
  --tier Burstable --sku-name B2ms \
  --storage-size 256 \
  --admin-user setuadmin
```

Add firewall rules (or VNet later):

```bash
az postgres flexible-server firewall-rule create \
  -g setu-prod-rg -n setu-prod-pg \
  --rule-name AllowAzure --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0
```

## 4) Create Container Apps Environment

```bash
az containerapp env create -g setu-staging-rg -n setu-staging-aca
az containerapp env create -g setu-prod-rg -n setu-prod-aca
```

## 5) Build + Push Images to ACR

```bash
# Staging
docker build -t setustagingacr.azurecr.io/setu-backend:staging -f backend/Dockerfile backend
docker build -t setustagingacr.azurecr.io/setu-pdf-tool:staging -f tools/pdf_processor/Dockerfile tools/pdf_processor
docker push setustagingacr.azurecr.io/setu-backend:staging
docker push setustagingacr.azurecr.io/setu-pdf-tool:staging

# Production
docker build -t setuprodacr.azurecr.io/setu-backend:prod -f backend/Dockerfile backend
docker build -t setuprodacr.azurecr.io/setu-pdf-tool:prod -f tools/pdf_processor/Dockerfile tools/pdf_processor
docker push setuprodacr.azurecr.io/setu-backend:prod
docker push setuprodacr.azurecr.io/setu-pdf-tool:prod
```

## 6) Deploy Backend Container App

```bash
az containerapp create \
  -g setu-prod-rg \
  -n setu-backend \
  --environment setu-prod-aca \
  --image setuprodacr.azurecr.io/setu-backend:prod \
  --target-port 3000 --ingress external \
  --cpu 1.0 --memory 2.0Gi \
  --min-replicas 1 --max-replicas 6
```

Set env vars (same pattern for staging):

```bash
az containerapp update -g setu-prod-rg -n setu-backend \
  --set-env-vars \
  DATABASE_HOST=setu-prod-pg.postgres.database.azure.com \
  DATABASE_PORT=5432 \
  DATABASE_USER=setuadmin \
  DATABASE_PASSWORD=REPLACE_ME \
  DATABASE_NAME=setu_db \
  JWT_SECRET=REPLACE_ME \
  PDF_TOOL_URL=https://setu-pdf-tool.example \
  TYPEORM_MIGRATIONS_RUN=true
```

## 7) Deploy PDF Tool Container App

```bash
az containerapp create \
  -g setu-prod-rg \
  -n setu-pdf-tool \
  --environment setu-prod-aca \
  --image setuprodacr.azurecr.io/setu-pdf-tool:prod \
  --target-port 8001 --ingress external \
  --cpu 0.5 --memory 1.0Gi \
  --min-replicas 1 --max-replicas 3
```

## 8) Frontend (Static Web Apps)

Option A: Use Azure Static Web Apps (Recommended)
1. Create Static Web App in Azure portal.
2. Connect to GitHub repo.
3. Build command: `npm run build`
4. App location: `/frontend`
5. Output: `/frontend/build` (or `/frontend/dist` if Vite)
6. Configure `REACT_APP_API_URL` (or `VITE_API_URL`) to point to backend URL.

Option B: Host on Storage + CDN if you want cheaper at scale.

## 9) Migrations

Run migration once per environment:

```bash
# local or pipeline with DATABASE_* set
cd backend
npm run migration:run
```

## 10) Staging vs Production Safety

- Separate DBs, Storage, Key Vaults, and resource groups.
- Only staging runs data migration/testing scripts.
- Production migrations run with explicit approval.
- Use readonly DB credentials in staging when inspecting prod data (optional).

## 11) CI/CD (Recommended)

- **Branch strategy:** `develop` -> staging, `main` -> production.
- Build/push images in pipeline, then `az containerapp update` with new image tags.
- Rollback by re-deploying the prior image tag.

## Required Configuration (Summary)

Backend:
- `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`
- `JWT_SECRET`
- `PDF_TOOL_URL`
- `TYPEORM_MIGRATIONS_RUN` (true only for controlled migrations)
- Optional:
  - `FIREBASE_SERVICE_ACCOUNT_PATH`
  - `AI_AZURE_*` and `AI_API_KEY` if AI features are enabled

Frontend:
- `VITE_API_URL` or `REACT_APP_API_URL`
