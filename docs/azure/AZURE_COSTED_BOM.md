# SETU Azure Costed BOM

## Pricing Basis

- Date captured: 2026-04-07
- Region baseline: `Central India`
- Currency: `USD`
- Source type:
  - live Azure Retail Prices API for Container Apps and PostgreSQL
  - conservative estimate for a few low-cost supporting services where the public retail feed is awkward to normalize quickly
- This is a planning BOM, not a commercial quote

## Workload Basis

- 1,500 provisioned users
- 10 sustained requests/second
- 20 to 30 requests/second peak bursts
- 2 always-on API replicas
- 8 max API replicas
- 250 GiB Blob storage
- 256 GiB PostgreSQL storage
- 10 GB/month observability ingestion starting point

## Azure SKU-by-SKU BOM

| Service | SKU / shape | Qty | Monthly estimate | Cost basis |
|---|---|---:|---:|---|
| Azure Static Web Apps | Standard | 1 | $9 | planning estimate |
| Azure Front Door | Standard/Premium entry setup | 1 | $35 to $60 | conservative low-traffic estimate |
| Azure Container Apps | Standard consumption, 2 replicas x 2 vCPU x 4 GiB always active | 1 | $326 | live retail API-based calculation |
| Azure Database for PostgreSQL Flexible Server | General Purpose, 4 vCores, 16 GiB | 1 | $365 | live retail API-based calculation |
| PostgreSQL storage | Premium Managed Disk, 256 GiB | 1 | $34 | live retail API-based calculation |
| PostgreSQL backup | 100 GiB effective LRS backup footprint | 1 | $11 | live retail API-based estimate |
| Azure Blob Storage | GPv2 Standard Hot, 250 GiB | 1 | $6 to $8 | conservative estimate |
| Azure Container Registry | Standard | 1 | $20 | planning estimate |
| Azure Key Vault | Standard ops + secrets | 1 | $3 to $8 | conservative estimate |
| Application Insights + Log Analytics | 10 GB/month ingestion | 1 | $25 to $35 | conservative estimate |
| Bandwidth / data transfer | moderate monthly egress | 1 | $20 to $40 | conservative estimate |

## Estimated Monthly Total

### Baseline range

- Low end: about `$854/month`
- High end: about `$916/month`

### Practical planning number

- Use `$900/month` as the working baseline for infrastructure only

## Cost Math For The Two Main Services

### 1. Azure Container Apps

Live list prices captured for `centralindia`:

- Standard vCPU active usage: `$0.000024 / second`
- Standard memory active usage: `$0.000003 / GiB-second`
- Standard requests: `$0.40 / 1M requests`

Monthly compute estimate for 2 always-active replicas:

- vCPU:
  - 2 replicas x 2 vCPU x 730 hours x 3600 seconds x $0.000024
  - about `$252.29`
- Memory:
  - 2 replicas x 4 GiB x 730 hours x 3600 seconds x $0.000003
  - about `$63.07`
- Requests:
  - 10 RPS x 2,592,000 seconds/month = 25.92M requests/month
  - 25.92 x $0.40
  - about `$10.37`

Estimated ACA total:

- about `$325.73/month`

### 2. PostgreSQL Flexible Server

Live list prices captured for `centralindia`:

- General Purpose Ddsv4 compute: `$0.125 / vCore-hour`
- Storage: `$0.131 / GiB-month`

Monthly estimate:

- Compute:
  - 4 vCores x 730 hours x $0.125
  - about `$365.00`
- Storage:
  - 256 GiB x $0.131
  - about `$33.54`

Subtotal:

- about `$398.54/month`

## Exclusions

Not included in the baseline total:

- Azure OpenAI or other LLM inference costs
- email/SMS notification providers
- CI/CD runner minutes
- high-volume CDN egress
- disaster recovery in a second region
- penetration testing, backups exported to another region, or enterprise support plans

## Scale-Up Cost Triggers

Raise budget above the baseline when any of these happen:

- API min replicas move from 2 to 4
- PostgreSQL moves from 4 vCores to 8 vCores
- Blob storage grows past 1 TiB
- observability ingestion exceeds 30 GB/month
- Front Door traffic or WAF policy count materially rises

## Planning Recommendation

- Budget `USD 900/month` for the first stable production rollout
- Keep `USD 1,300/month` approved as short-term headroom for tuning, burst traffic, and observability growth
