# Load Testing and Performance

Status: Draft  
Primary wave: F - Platform and Client Operations  
Related modules: Backend, frontend, database, Sync, Dashboard, PDF Processor, Deployment

## Purpose

Documents performance assumptions, load scenarios, test data, thresholds, bottlenecks, and repeatable load-test execution for SETU.

## Code Map

- Load-test assets: `load-tests/`
- Runtime targets: Docker Compose services and deployed backend/frontend/PDF service
- Metrics: API latency/error rate, database behavior, queue/sync health, PDF throughput, and client performance

## Required Documentation

Define personas, project sizes, concurrent users, read/write mixes, uploads/exports, dashboard queries, sync batches, peak windows, test environment, seed data, authentication, and cleanup. Record p50/p95/p99, throughput, error, resource, and saturation thresholds.

## Testing and Decisions

Run baseline, ramp, spike, soak, and recovery tests. Confirm production-like data volume, privacy-safe data, acceptance thresholds, monitoring, and owner for performance regressions.

