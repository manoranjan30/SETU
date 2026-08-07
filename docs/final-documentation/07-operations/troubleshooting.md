# Troubleshooting

[Back to Index](../README.md)

## App Down / 502

```bash
docker-compose -f docker-compose.yml ps
docker logs setu_app --tail 300
docker inspect setu_app --format='Started={{.State.StartedAt}} Finished={{.State.FinishedAt}} RestartCount={{.RestartCount}} OOMKilled={{.State.OOMKilled}} ExitCode={{.State.ExitCode}}'
docker events --since "2 hours ago" | grep -i "setu_app\\|die\\|kill\\|stop\\|start"
```

## Migration Failure

Check logs for:

- Missing TypeORM entity metadata.
- Unsupported TypeScript reflected type such as `Object`.
- Enum migration against a missing enum type.
- Duplicate column/table creation.

## Web Build Failure

Run:

```bash
docker-compose -f docker-compose.yml build app
```

Common frontend build failures include unused imports, TypeScript type mismatch, and missing exported service methods.

