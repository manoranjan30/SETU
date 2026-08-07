# Database Backup

[Back to Index](../README.md)

Use PostgreSQL logical backup with `pg_dump` from the server. The exact container name may differ, but current server examples used `setu_postgres`.

## Backup Command

```bash
mkdir -p /opt/setu/backups
docker exec setu_postgres pg_dump -U setu_admin -d setu_staging -Fc > /opt/setu/backups/setu_staging_$(date +%Y%m%d_%H%M%S).dump
```

## Verify Backup File

```bash
ls -lh /opt/setu/backups
pg_restore -l /opt/setu/backups/<backup-file>.dump | head
```

## Restore Drill

Do restore drills into a separate test database. Never restore over production without a maintenance window and approval.

