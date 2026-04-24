# SETU Staging Deployment Plan

Date: 2026-04-24
Target server: `Purvankara-VM3`
Target OS: `Ubuntu 20.04.6 LTS`
Deployment goal: Stage the full SETU application on the VM, validate it end to end, and keep the setup ready for later production hardening.

## Current Status Update

As of `2026-04-24`, the deployment is in progress and these facts are now confirmed:

- Docker plugin package `docker-compose-plugin` is not available from the current Ubuntu 20.04 apt sources
- use `docker-compose` commands, not `docker compose`
- deployment branch for now is `master`
- repository clone was started without the trailing `.`, so the repo currently sits under:
  - `/opt/setu/app/SETU`
- until we flatten the directory structure later, all repository-level commands should be run from:
  - `/opt/setu/app/SETU`

This document is updated below to match that current server state.

## Migration Foundation Update

As of `2026-04-25`, the repository now includes a migration bootstrap safeguard for empty databases:

- `backend/scripts/start-with-migrations.js` now detects a truly empty database
- for an empty database, it runs a one-time TypeORM `schema:sync`
- after that, it runs the normal migration chain
- several legacy create-migrations were hardened to be bootstrap-safe and idempotent enough for this flow

This means a brand-new staging database no longer depends on restoring a manual baseline dump just to get past missing legacy tables like `measurement_element`.

Relevant environment toggle:

```env
DB_BOOTSTRAP_EMPTY_SCHEMA=true
```

Default behavior:

- if the database has no application tables, bootstrap runs automatically
- if the database already has application tables, bootstrap is skipped and normal migrations continue

## 1. Objective

This document is a step-by-step staging deployment runbook for SETU on the provided Ubuntu VM. It is written so we can:

- prepare the VM safely
- install container tooling
- deploy frontend, backend, PostgreSQL, and PDF tool
- run database migrations
- verify application workflows
- capture rollback and backup basics before production

This plan assumes we will use Docker Compose because the repository already contains:

- [docker-compose.yml](C:/Users/omano/OneDrive%20-%20Puravankara%20Limited/Manoranjan/Antigravity%20Experiment/000%20Project%20PM/SETU/docker-compose.yml)
- [Dockerfile](C:/Users/omano/OneDrive%20-%20Puravankara%20Limited/Manoranjan/Antigravity%20Experiment/000%20Project%20PM/SETU/Dockerfile)
- backend startup migration wrapper in [start-with-migrations.js](C:/Users/omano/OneDrive%20-%20Puravankara%20Limited/Manoranjan/Antigravity%20Experiment/000%20Project%20PM/SETU/backend/scripts/start-with-migrations.js)

## 2. Current VM Baseline

Confirmed from the server details:

- Hostname: `Purvankara-VM3`
- Private IP: `192.168.10.2`
- CPU: `4 vCPU`
- RAM: `7.7 GiB`
- Swap: `4 GiB`
- Free disk: about `943 GiB`
- Internet outbound: working
- Installed: `git`
- Not yet installed at baseline: `docker`, `docker compose`, `node`, `npm`

This is enough for a staging deployment with app, DB, and supporting services on the same VM.

## 3. Deployment Strategy

We will stage the app in this order:

1. OS preparation and basic security
2. Docker Engine and Compose installation
3. Deployment directory setup under `/opt/setu`
4. Project clone and branch checkout
5. Environment file preparation
6. Docker Compose review and staging adjustments
7. Initial image build
8. PostgreSQL startup
9. Application startup with migrations
10. Functional smoke testing
11. Reverse proxy setup if browser access beyond port `3000` is needed
12. Backup, restart, and rollback preparation

## 4. Assumptions

These are the working assumptions for staging:

- PostgreSQL will run on the same VM in Docker
- the app can be accessed initially by IP and port
- SSL is not mandatory for the first internal staging round
- this is a staging environment, not final production
- Docker-based deployment is preferred over direct Node installation

If any of those change later, we can revise only the relevant sections instead of redoing the whole stack.

## 5. Important Repository Notes Before Deployment

There are a few things we should explicitly verify during staging:

### 5.1 PDF tool port mismatch

Current `docker-compose.yml` sets:

- app env `PDF_TOOL_URL=http://pdf-tool:8002`
- pdf tool published port `8001:8001`

That is a likely mismatch. During staging, confirm what port the PDF tool actually listens on inside the container. If it is `8001`, update the application env to:

```env
PDF_TOOL_URL=http://pdf-tool:8001
```

### 5.2 Firebase service account file

The production image copies:

```text
backend/firebase-service-account.json
```

Deployment will fail or features may break if this file is missing or invalid. Confirm whether staging should use:

- a real Firebase service account JSON
- a staging Firebase service account JSON
- or no Firebase-dependent features for the first stage

### 5.3 Secrets in current compose

The current compose file uses placeholder values such as:

- `POSTGRES_PASSWORD=password`
- `JWT_SECRET=supersecretkey`

Do not use those in shared staging or production. Replace them with strong values in environment files.

## 6. Target Directory Layout on the VM

Create a clean deployment structure:

```text
/opt/setu/
  app/                 # Git checkout
  env/                 # .env files and secrets
  data/
    postgres/          # PostgreSQL persistent data
    uploads/           # backend uploads
  backups/             # manual/automated DB dumps
  logs/                # optional host logs
```

## 7. Step-by-Step Execution Plan

### Step 1: Update Ubuntu packages

Run on the VM:

```bash
apt update
apt upgrade -y
apt install -y ca-certificates curl gnupg lsb-release unzip jq
```

Expected result:

- package index is updated
- essential utilities are present

### Step 2: Install Docker Engine and Compose

On this VM, the working installation path is:

```bash
apt install -y docker.io docker-compose
systemctl enable docker
systemctl start docker
docker --version
docker-compose --version
```

Expected result:

- Docker service is running
- `docker --version` works
- `docker-compose --version` works

Note:

- on this server, use `docker-compose` with a hyphen
- do not use `docker compose` unless the Compose plugin is installed later from a different source

### Step 3: Create a dedicated deployment user

For staging, avoid running the whole workflow as `root` after bootstrap:

```bash
adduser setu
usermod -aG docker setu
mkdir -p /opt/setu/{app,env,data/postgres,data/uploads,backups,logs}
chown -R setu:setu /opt/setu
```

Expected result:

- `setu` user exists
- Docker commands can be run by that user after re-login

### Step 4: Open only the ports needed

If `ufw` is being used:

```bash
ufw allow 22/tcp
ufw allow 3000/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

Notes:

- do not expose `5432` publicly unless there is a specific reason
- do not expose internal-only service ports unnecessarily

### Step 5: Clone the SETU repository

Switch to the deployment user:

```bash
su - setu
cd /opt/setu/app
git clone <YOUR_REPO_URL>
cd SETU
git checkout master
git pull origin master
```

Expected result:

- repo is available under `/opt/setu/app/SETU`
- branch `master` is checked out

Current note:

- because the repository was cloned without the trailing `.`, it created a nested folder named `SETU`
- that is acceptable for staging; we can flatten it later if needed

### Step 6: Prepare environment files

Create environment files under `/opt/setu/env`.

Suggested backend env file:

`/opt/setu/env/backend.env`

```env
NODE_ENV=production
PORT=3000
DATABASE_HOST=db
DATABASE_PORT=5432
DATABASE_USER=setu_admin
DATABASE_PASSWORD=CHANGE_THIS_TO_A_STRONG_PASSWORD
DATABASE_NAME=setu_staging
JWT_SECRET=CHANGE_THIS_TO_A_LONG_RANDOM_SECRET
RUN_DB_MIGRATIONS=true
DB_MIGRATION_SCRIPT=migration:run:dist
DB_BOOTSTRAP_EMPTY_SCHEMA=true
PDF_TOOL_URL=http://pdf-tool:8001
FIREBASE_SERVICE_ACCOUNT_PATH=firebase-service-account.json
```

If your frontend build uses Vite environment injection, prepare frontend env values in the build context or compose overrides. The important value is the API base URL, typically one of:

- `http://192.168.10.2:3000`
- `http://<domain>`
- `https://<domain>` after reverse proxy and SSL

For web deployment, prefer same-origin API calls:

- if `VITE_API_URL` is unset, the web app now defaults to `/api`
- if `VITE_API_URL` is set, point it at the public origin or public API origin
- do not rely on browser-side `http://localhost:3000` during staging

### Step 7: Copy Firebase credentials if needed

If Firebase-backed features are required in staging:

```bash
cp /path/to/your/staging-firebase-service-account.json /opt/setu/app/SETU/backend/firebase-service-account.json
chmod 600 /opt/setu/app/SETU/backend/firebase-service-account.json
```

If Firebase is not required for this test cycle, document that clearly before UAT so missing features do not look like unrelated bugs.

### Step 8: Create a staging compose file

Do not edit the base file blindly on the server. Create a server-specific override such as:

`/opt/setu/app/SETU/docker-compose.staging.yml`

Recommended direction:

- keep service names: `db`, `app`, `pdf-tool`
- mount host volumes from `/opt/setu/data/...`
- load backend env file using `env_file`
- avoid hardcoded secrets in the compose file

Suggested structure:

```yaml
services:
  db:
    restart: unless-stopped
    environment:
      POSTGRES_USER: setu_admin
      POSTGRES_PASSWORD: CHANGE_THIS_TO_A_STRONG_PASSWORD
      POSTGRES_DB: setu_staging
    volumes:
      - /opt/setu/data/postgres:/var/lib/postgresql/data

  app:
    restart: unless-stopped
    env_file:
      - /opt/setu/env/backend.env
    volumes:
      - /opt/setu/data/uploads:/usr/src/app/uploads
    ports:
      - "3000:3000"

  pdf-tool:
    restart: unless-stopped
```

Also verify the PDF tool internal port before finalizing the env file.

### Step 9: Review compose configuration before running

From `/opt/setu/app/SETU`:

```bash
docker-compose -f docker-compose.yml -f docker-compose.staging.yml config
```

Check specifically:

- the final DB credentials
- mounted upload path
- port exposure
- `PDF_TOOL_URL`
- any missing env values

Expected result:

- merged compose config renders successfully

### Step 10: Build the application images

```bash
cd /opt/setu/app/SETU
docker-compose -f docker-compose.yml -f docker-compose.staging.yml build
```

Expected result:

- backend image builds
- frontend static build completes within the app image
- pdf tool image builds

### Step 11: Start only the database first

```bash
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d db
docker-compose -f docker-compose.yml -f docker-compose.staging.yml ps
docker-compose -f docker-compose.yml -f docker-compose.staging.yml logs db --tail=100
```

Expected result:

- PostgreSQL container is healthy and ready

### Step 12: Start the full stack

```bash
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d
docker-compose -f docker-compose.yml -f docker-compose.staging.yml ps
```

Expected result:

- `db`, `app`, and `pdf-tool` containers are running

### Step 13: Watch migration startup logs carefully

The backend uses the migration wrapper script. Check logs:

```bash
docker-compose -f docker-compose.yml -f docker-compose.staging.yml logs app --tail=200 -f
```

Look for:

- database connection is ready
- migration lock acquired
- migrations executed successfully
- application startup completed

If the app exits repeatedly, investigate:

- missing env variables
- TypeORM entity metadata errors
- database credential mismatch
- missing Firebase file

### Step 13.1: Verify auth route correctly

The backend API is served under `/api`.

Use this exact command on the VM:

```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}'
```

Expected result:

- valid login returns JSON with `access_token`
- `http://localhost/auth/login` is not the correct API route and may return SPA HTML

### Step 14: Verify app reachability

From the VM:

```bash
curl -I http://localhost:3000
```

From a browser on the same network:

```text
http://192.168.10.2:3000
```

Expected result:

- the frontend is served
- browser loads the login screen or app shell
- browser login request goes to `/api/auth/login`
- login response is JSON, not HTML

### Step 15: Validate container state and resource usage

```bash
docker ps
docker stats --no-stream
df -h
free -h
```

Expected result:

- no unexpected container restarts
- memory use remains comfortable
- disk use remains healthy

## 8. Functional Smoke Test Checklist

Run these after the stack is up.

### Platform access

- login page loads
- valid user can sign in
- dashboard renders without blank sections
- left navigation loads correctly

### Backend health

- API-backed pages load data
- no visible 500 errors in browser network tab
- backend logs do not flood with exceptions

### Database and migrations

- tables exist as expected
- new Material ITP module tables are present
- app starts without re-running broken migrations

### File handling

- document upload works
- evidence photograph upload works
- uploaded files persist after container restart

### Quality module

- Quality Control opens
- Materials page opens
- ITP template panel loads
- approval panel is visible
- release strategy options show Material ITP approval and Material Test Result approval

### Planning and approvals

- Release Strategy page loads
- material approval process values can be selected
- pending tasks page loads

### PDF tool

- any feature depending on the PDF tool works
- if it fails, compare actual PDF tool listening port vs configured `PDF_TOOL_URL`

## 9. Reverse Proxy Plan for Cleaner Access

For internal staging, you can begin with `http://192.168.10.2:3000`.

When you want a cleaner URL, add Nginx:

1. Install Nginx
2. Proxy `/` to `http://127.0.0.1:3000`
3. Later attach SSL if the VM gets a domain or public routing

Basic Nginx steps:

```bash
apt install -y nginx
systemctl enable nginx
systemctl start nginx
```

Suggested server block:

```nginx
server {
    listen 80;
    server_name _;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then validate and reload:

```bash
nginx -t
systemctl reload nginx
```

Routing note:

- SPA routes are non-`/api`
- backend routes are `/api/...`
- keep Flutter and other API clients pointed at `/api`

## 10. Restart and Recovery Operations

Useful operational commands:

### View running services

```bash
docker-compose -f docker-compose.yml -f docker-compose.staging.yml ps
```

### Tail backend logs

```bash
docker-compose -f docker-compose.yml -f docker-compose.staging.yml logs app -f
```

### Restart only the app

```bash
docker-compose -f docker-compose.yml -f docker-compose.staging.yml restart app
```

### Stop the whole stack

```bash
docker-compose -f docker-compose.yml -f docker-compose.staging.yml down
```

### Rebuild after code changes

```bash
git pull
docker-compose -f docker-compose.yml -f docker-compose.staging.yml build
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d
```

## 11. Backup Plan

Before major updates, take a DB dump:

```bash
mkdir -p /opt/setu/backups
docker exec -t setu_postgres pg_dump -U setu_admin setu_staging > /opt/setu/backups/setu_staging_$(date +%F_%H-%M-%S).sql
```

Also back up uploads:

```bash
tar -czf /opt/setu/backups/uploads_$(date +%F_%H-%M-%S).tar.gz /opt/setu/data/uploads
```

Minimum staging discipline:

- take a DB dump before schema-affecting upgrades
- keep recent upload snapshots
- verify backup files are readable

## 12. Rollback Plan

If a new deployment fails:

1. stop the new stack
2. checkout the previous known-good commit
3. rebuild images
4. restore DB only if the migration changed schema incompatibly
5. bring the stack back up

Basic rollback flow:

```bash
cd /opt/setu/app/SETU
docker-compose -f docker-compose.yml -f docker-compose.staging.yml down
git log --oneline -n 10
git checkout <PREVIOUS_GOOD_COMMIT>
docker-compose -f docker-compose.yml -f docker-compose.staging.yml build
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d
```

Use DB restore only when necessary, because rolling back code is cheaper than rolling back data.

## 13. Staging Exit Criteria

Staging is considered successful when all of the following are true:

- stack starts cleanly after a fresh `docker-compose up -d`
- migrations run without manual intervention
- frontend is reachable from browser
- login succeeds
- core modules load
- Material ITP and approval flows load without UI overlap or missing approval panels
- uploads persist across container restart
- logs show no repeating fatal errors

## 14. Recommended Next Improvements After First Stage

After the first stable staging cycle, the next improvements should be:

1. flatten `/opt/setu/app/SETU` to `/opt/setu/app` after staging is stable
2. move secrets fully out of compose into env files or secret storage
3. add Nginx reverse proxy config to the repo
4. add health checks for app and pdf tool
5. add automated nightly DB backup
6. add SSL once domain routing is finalized
7. document update procedure and operator checklist
8. create a dedicated staging branch instead of deploying directly from `master`

## 15. Immediate Action List

This is the shortest practical sequence to begin staging now:

1. install Docker and Compose on the VM
2. create `/opt/setu` directory structure
3. confirm the repo is present under `/opt/setu/app/SETU`
4. prepare `/opt/setu/env/backend.env`
5. verify Firebase JSON availability
6. verify PDF tool port and correct `PDF_TOOL_URL`
7. create `docker-compose.staging.yml`
8. run `docker-compose ... build`
9. start `db`, then full stack
10. run the smoke test checklist from this document

---

Owner: Deployment / Engineering
Environment: Staging
Next document to create after this stage: `SETU_PRODUCTION_DEPLOYMENT_PLAN.md`
