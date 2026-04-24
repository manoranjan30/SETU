# Azure Service Hardware Requirements and Budget (Approval Pack)

This document provides a hardware-style requirement summary and separate budgets for Staging and Production environments for SETU. It is intended for next-level approval.

## Production (Monthly Budget)

Estimated monthly total: INR 22,494

| Component | Azure Service | Sizing / SKU | Estimated Monthly (INR) |
|---|---|---|---:|
| Frontend Hosting | Static Web Apps (Standard) | 1 app, 250 GB bandwidth overages | 3,697 |
| Backend API | Container Apps (Consumption) | 1 vCPU / 3 GiB, min 2 replicas, 2M req/month | 5,979 |
| PDF Tool | Container Apps (Consumption) | 0.5-1 vCPU / 1-2 GiB, min 1 | Included above |
| Database | PostgreSQL Flexible Server | Burstable B2ms, 200 GiB | 10,075 |
| Storage | Storage Accounts (Blob) | 500 GB + bandwidth | 1,227 |
| Container Registry | ACR Basic | 1 registry | 474 |
| Secrets | Key Vault Standard | 200k operations | 57 |
| Monitoring | Azure Monitor | ~0.2 GB/day analytics + 1 GB/day auxiliary | 984 |

## Staging (Monthly Budget)

Estimated monthly total: INR 7,000 to 9,000

| Component | Azure Service | Sizing / SKU | Estimated Monthly (INR) |
|---|---|---|---:|
| Frontend Hosting | Static Web Apps (Standard) | 1 app, reduced bandwidth | 2,000-3,000 |
| Backend API | Container Apps (Consumption) | 1 vCPU / 2 GiB, min 0 | 1,000-2,000 |
| PDF Tool | Container Apps (Consumption) | min 0 | 300-600 |
| Database | PostgreSQL Flexible Server | Burstable B1ms, 64-128 GiB | 2,000-3,000 |
| Storage | Storage Accounts (Blob) | 100-200 GB | 200-500 |
| Container Registry | ACR Basic | 1 registry | 474 |
| Secrets and Monitoring | Key Vault + Azure Monitor | minimal ingestion | 300-600 |

## Notes

- Static Web Apps is a global service (no region selector in the calculator).
- Production assumes high image upload/download bandwidth (250 GB).
- If we reduce min replicas from 2 to 1, Container Apps cost will drop further.
