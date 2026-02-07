# REPO_STRUCTURE.md
## Repository Structure & Code Organization
### (Docker + Antigravity IDE Ready)
### Construction Project Intelligence & Control Platform

---

## 1. Purpose of This Document

This document defines the **authoritative repository structure** for the platform, including:

- application layout
- backend module boundaries
- Docker & infrastructure configuration
- AI-safe folder conventions for Google Antigravity IDE

This is a **binding governance document**.  
Any deviation is considered an architectural violation.

---

## 2. Core Repository Principles (Non-Negotiable)

1. **Monorepo**
   - All applications, packages, and infrastructure live in one repository

2. **AI-Safe Predictability**
   - Fixed folder names
   - No ad-hoc directories
   - No environment-specific hacks

3. **Clear Separation**
   - Apps â‰  Infrastructure â‰  Shared Packages
   - Docker files do NOT live inside domain modules

4. **Docker-First**
   - Every runnable service must be containerized
   - Local dev mirrors production topology

---

## 3. Top-Level Repository Layout (Authoritative)

/
apps/
packages/
docker/
config/
scripts/
docs/

 

No other top-level folders are permitted.

---

## 4. Applications (`/apps`)

/apps
api/
web/
mobile/

 

---

### 4.1 Backend API (`/apps/api`)

/apps/api
src/
modules/
shared/
config/
main.ts
prisma/
schema.prisma
migrations/
seed.ts
Dockerfile
package.json

 

#### Notes
- **Dockerfile is app-scoped**, not global
- Prisma lives inside the API app
- Antigravity IDE can safely infer backend context here

---

#### 4.1.1 Backend Modules (`/apps/api/src/modules`)

/modules
identity/
project/
boq/
planning/
baseline/
resource/
lookahead/
progress/
quality/
ehs/
execution-gate/
delay/
cost/
simulation/
documents/
workflow/
audit/
integration/

sql
Copy code

Each module MUST follow:

/<module-name>
controller/
service/
domain/
dto/
events/
tests/
permissions.ts
index.ts

 

No Docker files inside modules  
No cross-module imports

---

#### 4.1.2 Shared Backend Infrastructure (`/apps/api/src/shared`)

/shared
auth/
events/
tests/
database/
logging/
queue/
storage/
utils/

 

Rules:
- Infrastructure only
- No business rules
- Reusable across modules

---

### 4.2 Web Application (`/apps/web`)

/apps/web
src/
app/
components/
features/
hooks/
services/
state/
styles/
Dockerfile
package.json

 

Rules:
- No domain logic
- No permission logic
- Uses backend APIs only

---

### 4.3 Mobile Application (`/apps/mobile`)

/apps/mobile
src/
screens/
components/
services/
offline/
sync/
package.json

 

Notes:
- Mobile Dockerization is optional (dev-only)
- Offline-first design
- No backend logic

---

## 5. Shared Packages (`/packages`)

/packages
domain/
permissions/
events/
tests/
sdk/
ui/
config/

 

### Purpose
- Shared contracts
- Zero infrastructure logic
- Zero database access

---

## 6. Docker & Infrastructure (`/docker`)

This folder is **critical** for AI safety and clarity.

/docker
docker-compose.yml
docker-compose.dev.yml
docker-compose.prod.yml
.env.example
postgres/
init.sql
postgres.conf
redis/
redis.conf
README.md

 

### Rules
- **All orchestration lives here**
- Apps only expose ports; they do not orchestrate
- Antigravity IDE can reason about infra cleanly

---

## 7. Configuration (`/config`)

/config
env/
dev.env
test.env
prod.env
docker/
healthchecks.sh
ci/
pipeline.yml

 

---

## 8. Scripts (`/scripts`)

/scripts
db-migrate.ts
seed-data.ts
generate-events.ts

 

Rules:
- Operational scripts only
- Must use Prisma or APIs
- No domain logic

---

## 9. Documentation (`/docs`)

/docs
PRODUCT_VISION.md
SYSTEM_ARCHITECTURE.md
MODULE_BREAKDOWN_AND_BACKEND_ARCHITECTURE.md
AUTHORIZATION_MODEL.md
DOMAIN_GLOSSARY.md
DOMAIN_EVENTS.md
DATA_OWNERSHIP.md
REPO_STRUCTURE.md
ANTIGRAVITY_IDE_PROMPT_PLAYBOOK.md

 

These documents are **loaded into Antigravity IDE context** before coding.

---

## 10. Naming Conventions (Mandatory)

| Item | Convention |
|----|-----------|
| Folders | kebab-case |
| Files | kebab-case |
| Classes | PascalCase |
| Variables | camelCase |
| Events | PascalCase (past tense) |
| Docker services | kebab-case |

---

## 11. Forbidden Practices (Hard Stop)

Docker files inside modules  
Multiple docker-compose locations  
Environment variables hardcoded in code  
AI-generated temp folders  
Cross-module imports  
Infra logic inside apps  

---

## 12. Antigravity IDEâ€“Specific Rules

- AI must respect this structure before generating files
- AI must refuse to create files outside defined folders
- Docker files must be placed only in:
  - `/apps/*/Dockerfile`
  - `/docker/*`
- Prisma schema only in `/apps/api/prisma`

---

## 13. Why This Structure Works

- Mirrors SYSTEM_ARCHITECTURE.md exactly
- Clean separation of concerns
- AI-safe and deterministic
- Easy onboarding
- Docker & CI friendly
- Production-ready from Day 1

---

### Governance Rule

This repository structure is **authoritative and binding**.  
Any deviation”human or AI”is invalid.
