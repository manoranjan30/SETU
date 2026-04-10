# SETU Backup And Rollback Plan

## Objective

Create a safe restore point before implementing MSP XML export, revised working schedule re-import, and round-trip schedule sync logic.

This plan is intended to make sure that if any change breaks:

- schedule dates
- activity hierarchy
- floor links
- WO links
- calendars
- imports/exports

we can return to a known-good state quickly and with confidence.

---

## Guiding Principle

For SETU, backup does not mean only source code backup.

A safe rollback requires backup of:

- source code
- database
- uploaded and generated files
- environment and deployment configuration
- release artifacts
- restore instructions

---

## Backup Scope

### 1. Source Code Backup

Back up all application code and supporting assets:

- `backend/`
- `frontend/`
- database migrations
- scripts
- config files
- lock files
- deployment files
- module plans
- import/export templates

Source code backup methods:

- push all committed code to remote Git
- create a release branch
- create a Git tag
- create one offline ZIP snapshot of the full repository

### 2. Database Backup

Take both full and module-focused backups.

Full database backup:

- complete schema
- complete data

Critical module-level backup:

- WBS nodes
- activities
- activity relationships
- activity schedules
- work calendars
- work weeks
- floor/EPS mapping tables
- WO linkage tables
- schedule revision tables
- audit logs related to planning and import/export

Backup requirements:

- full dump before release
- module-specific export for rapid inspection
- restore test on staging before go-live

### 3. File Storage Backup

Back up all business files that may be needed for rollback or audit:

- uploaded XML files
- uploaded Excel/CSV files
- exported XML/Excel files
- document attachments
- templates
- generated reports

If files are stored outside the repo, they must still be part of the backup plan.

### 4. Environment And Deployment Backup

Capture deployment state:

- app version
- deployed commit hash
- server names
- environment variable inventory
- process manager config
- web server config
- Docker or service definitions
- scheduled jobs
- storage locations

Do not store secrets in plain text inside the plan. Store only references to the secure vault location.

### 5. Release Artifact Backup

Retain the exact deployable version:

- backend build artifact or image
- frontend production build
- dependency versions
- package lock state

This ensures rollback does not depend on rebuilding from a changed dependency ecosystem.

---

## Release Baseline Strategy

Create named restore points before each risky stage.

### Restore Points

- `R0` = current stable production baseline
- `R1` = before MSP XML export feature
- `R2` = before MSP revised XML re-import merge feature
- `R3` = before production go-live of round-trip sync

### Naming Convention

Use consistent names across Git, DB dumps, and storage snapshots.

Example:

- Git tag: `pre-msp-roundtrip-r1-2026-04-01`
- Release branch: `release/pre-msp-roundtrip-r1`
- DB dump: `setu_prod_r1_2026-04-01_full.bak`
- Module dump: `setu_prod_r1_schedule_2026-04-01.sql`
- File backup: `setu_files_r1_2026-04-01.zip`

---

## Backup Procedure

### Phase A. Code Freeze Preparation

Before taking baseline backup:

- stop new schedule-related feature merges
- ensure all current changes are committed or consciously excluded
- record current production version and commit hash
- list open known issues

### Phase B. Source Code Backup

Steps:

1. Commit current stable code.
2. Push to remote repository.
3. Create release branch.
4. Create annotated tag.
5. Export repository ZIP snapshot for offline archive.

Checklist:

- backend included
- frontend included
- config included
- migrations included
- lock files included
- scripts included

### Phase C. Database Backup

Steps:

1. Take a full database dump.
2. Take a schema-only backup.
3. Take schedule-module focused backup.
4. Store with restore point label.
5. Validate that backup files are readable.

Schedule-focused data should include:

- WBS structure
- activities
- predecessors/successors
- calendars and exceptions
- links to floors/EPS
- links to work orders
- schedule revisions
- audit trail if present

### Phase D. File Backup

Steps:

1. Copy import/export folders.
2. Copy uploaded attachments.
3. Copy templates and generated files.
4. Store snapshot with same restore point label.

### Phase E. Environment Backup

Steps:

1. Record deployed environment values securely.
2. Export service configuration.
3. Record storage paths and cron jobs.
4. Record third-party integration touchpoints.

---

## Restore Procedure

Rollback must be executable, not theoretical.

### Code Rollback

- redeploy the tagged release branch or commit
- restore matching backend and frontend artifacts

### Database Rollback

- stop write activity if needed
- restore full DB backup
- verify schema and row counts
- verify schedule-related tables specifically

### File Rollback

- restore storage snapshot matching the same restore point
- verify imported/exported schedule files are accessible if needed

### Environment Rollback

- revert deployment configuration if changed
- confirm service startup and integration connectivity

---

## Rollback Triggers

Rollback should be considered immediately if any of the following occur:

- activity dates shift incorrectly after import
- original floor links are lost
- original WO links are lost
- activity relationships are broken
- calendars or holidays import incorrectly
- duplicate activities are created unexpectedly
- revised working schedule corrupts original mapping
- major performance regression blocks planner usage
- production data integrity cannot be trusted

---

## Verification After Backup

Taking a backup is not enough. We must verify restore readiness.

### Staging Restore Test

For every major restore point:

1. Restore DB on staging.
2. deploy matching code version
3. attach matching file snapshot
4. open application successfully
5. confirm login works
6. open one sample project
7. open master schedule
8. open working schedule
9. verify floor links
10. verify WO links
11. verify calendars
12. verify activity relationships

### Data Validation Checklist

- WBS count matches
- activity count matches
- relationship count matches
- calendar count matches
- sample floor mappings match
- sample WO mappings match

---

## Retention Policy

Recommended retention:

- daily rolling backups: 7 to 14 days
- weekly backups: 4 to 8 weeks
- milestone backups: permanent for major releases

Permanent milestone retention should include:

- pre-MSP export
- pre-reimport merge
- pre-production rollout

---

## Ownership

Recommended owners:

- Engineering: source code backup and release tag
- DBA or backend owner: database dump and restore validation
- DevOps or deployment owner: environment and artifact backup
- Product or module owner: business verification of schedules, floors, and WO links

---

## Execution Checklist

### Before R1

- create Git tag and release branch
- take full DB backup
- take schedule-focused DB backup
- archive file storage snapshot
- record environment and deployment state
- complete staging restore test

### Before R2

- repeat full backup cycle
- compare R1 and current schema changes
- verify schedule-link integrity before new rollout

### Before Production Go-Live

- create final pre-release backup
- confirm rollback owner and contact path
- confirm restore files are accessible
- confirm rollback dry run has been tested

---

## Recommendation For The MSP Round-Trip Work

Do not begin MSP XML export/re-import implementation until:

- `R0` is archived
- `R1` backup is complete
- database restore has been tested on staging
- a rollback owner is assigned
- schedule/floor/WO integrity checkpoints are documented

---

## Final Note

For a project of this size, Git alone is not a backup strategy.

Safe rollback requires:

- versioned code
- restorable database
- preserved business files
- deployable artifacts
- tested recovery procedure

That combination is the real backup plan.
