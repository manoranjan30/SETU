# Server Deployment

[Back to Index](../README.md)

## Docker Compose Flow

```bash
cd /opt/setu/app/SETU
git status
git pull --no-rebase origin master
docker-compose -f docker-compose.yml config
docker-compose -f docker-compose.yml build app
docker-compose -f docker-compose.yml up -d
docker-compose -f docker-compose.yml ps
docker logs setu_app --tail 200
```

## Notes

- Resolve merge conflicts before build.
- Keep server-specific secrets out of committed documentation.
- Check migration errors before assuming the app crashed.
- Use `docker inspect` and `docker events` when investigating container restarts.

