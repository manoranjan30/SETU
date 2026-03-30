# 2000+ Concurrent Users Capacity Assessment Plan

## Executive View
- The current application can potentially support 2000+ named users in the system.
- It should not be assumed to support 2000+ simultaneously active users on the current single-instance deployment without validation.
- The biggest risks are backend single-process limits, PostgreSQL connection pressure, heavy unpaginated read flows, file upload/report workloads on the API node, and lack of production edge components like reverse proxy, CDN, and connection pooling.

## Current Architecture Signals From Codebase
- Frontend:
  - React + Vite SPA
  - API client uses a single HTTP backend at `VITE_API_URL + /api`
- Backend:
  - NestJS application listening on port `3000`
  - Single Node.js process by default
  - TypeORM with PostgreSQL
  - No explicit DB pool sizing configured in `data-source.ts`
  - No Redis cache / queue tier in current stack
  - No worker separation for heavy jobs
  - Some cron/background work exists in-process
- Deployment:
  - Current Docker setup is essentially a single backend container + PostgreSQL
  - Frontend can be served by NestJS static output in production image
  - No dedicated reverse proxy/load balancer config is present in repo

## Practical Conclusion
- Current system is likely acceptable for:
  - a few hundred concurrent light users
  - perhaps higher if usage is bursty and read-heavy
- Current system is not yet proven safe for:
  - 2000+ concurrently active users
  - especially if many are using dashboards, progress entry, approvals, drawing/document operations, imports/exports, or AI/report functions at the same time

## What "2000 Concurrent Users" Must Mean
- Before sizing infrastructure, define concurrency as one of:
  - 2000 logged-in sessions
  - 2000 open browser tabs
  - 2000 users active within 5 minutes
  - 2000 simultaneous request-generating users
- Capacity planning must use request rate, not user count alone.

## Recommended Sizing Baseline
### Pilot / validation environment
- Frontend:
  - static hosting behind CDN or reverse proxy
- Backend:
  - 2 application instances
  - each `4 vCPU / 8 GB RAM`
- Database:
  - PostgreSQL `4 vCPU / 16 GB RAM`
  - SSD storage with strong IOPS
- Reverse proxy / load balancer:
  - Nginx or managed load balancer

### Safer starting point for real 2000+ active-user target
- Frontend:
  - CDN-backed static hosting
- Backend:
  - 3 to 4 instances
  - each `4-8 vCPU / 8-16 GB RAM`
- Database:
  - PostgreSQL `8 vCPU / 32 GB RAM`
  - connection pooling via PgBouncer
- Cache / async tier:
  - Redis for caching, rate smoothing, and job coordination
- Storage:
  - object storage / CDN for uploads and drawings instead of serving all files directly from the API node

## Required Hardening Before Claiming 2000+
### Application tier
- Run multiple backend replicas behind a load balancer
- Move heavy work off request thread:
  - PDF/report generation
  - AI insight jobs
  - large exports
  - document processing
- Add structured telemetry:
  - request rate
  - p95 / p99 latency
  - error rate
  - CPU / memory
  - DB query duration
- Add request timeout strategy and payload guardrails

### Database tier
- Define TypeORM / pg pool sizes explicitly
- Add PgBouncer for connection pooling
- Review slow queries in:
  - dashboard services
  - execution breakdown / progress services
  - planning/cost rollups
  - design register / quality list views
- Add pagination and indexing where missing
- Validate long-running aggregation queries under load

### Frontend / edge tier
- Serve frontend statically, not from dev server
- Put uploads and static assets behind CDN where possible
- Use gzip/brotli at proxy layer

## Likely Bottlenecks In This Codebase
- Single NestJS process handling everything
- No explicit database connection pool strategy
- Dashboard aggregation services likely expensive under simultaneous refreshes
- Progress/execution flows perform multi-step lookups and hierarchy traversal
- File upload/download and drawing modules can consume memory and bandwidth
- In-process background work shares CPU with API traffic

## Assessment Method To Make An Informed Decision
### Phase 1: Define workload model
- Identify top user journeys:
  - login
  - dashboard open/refresh
  - progress entry read
  - progress save + approval
  - planning/schedule screens
  - drawing register open/download
  - quality inspection lists
- Assign expected traffic mix percentages
- Define target SLAs:
  - p95 API latency
  - p99 API latency
  - acceptable error rate

### Phase 2: Add observability
- Add metrics for:
  - request count per endpoint
  - duration per endpoint
  - DB duration
  - memory usage
  - event-loop lag
  - slow query logging
- Capture system metrics:
  - CPU
  - RAM
  - network
  - DB connections
  - disk IOPS

### Phase 3: Run staged load tests
- Test at:
  - 100 concurrent active users
  - 300
  - 500
  - 1000
  - 1500
  - 2000
- Use realistic scenarios, not one endpoint only
- Measure:
  - p50/p95/p99 latency
  - error rate
  - saturation point
  - DB connection exhaustion

### Phase 4: Identify scaling breakpoints
- Find which resource saturates first:
  - CPU
  - memory
  - DB connections
  - slow query contention
  - bandwidth / file serving
- Separate read-heavy failures from write-heavy failures

### Phase 5: Re-test after fixes
- Add pooling, indexes, caching, and replicas
- Repeat the same scenario set
- Only then decide production sizing

## Acceptance Criteria For “Can Handle 2000+”
- Under the agreed workload model:
  - p95 latency remains within target
  - p99 latency remains within acceptable upper bound
  - error rate stays below threshold
  - no DB connection exhaustion
  - no sustained CPU pegging
  - memory stays stable without leak pattern
  - file/report operations do not starve transactional APIs

## Recommended Next Actions
- Short term:
  - perform endpoint inventory and rank heavy flows
  - add metrics and slow-query visibility
  - configure DB pooling and production load balancer
- Medium term:
  - run staged load tests
  - optimize slow queries and heavy dashboards
  - offload heavy jobs to worker queue
- Long term:
  - scale app horizontally
  - introduce Redis + PgBouncer
  - isolate heavy workloads from transactional API path

## Decision Guidance
- If you need a go/no-go answer today:
  - Do not promise 2000+ concurrent active users on the current setup.
  - Promise only after staged load testing on a production-like environment.
- If you need a procurement starting point:
  - begin with 3 backend instances of `4 vCPU / 8 GB`
  - PostgreSQL at `8 vCPU / 32 GB`
  - load balancer + PgBouncer + CDN
  - then validate and adjust based on measured traffic.
