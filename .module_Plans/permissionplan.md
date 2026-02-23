📘 PERMISSION MANAGEMENT & DYNAMIC MENU ARCHITECTURE
(RBAC + Project Team + EPS Scoped + UI Dynamic Rendering)
1️⃣ SYSTEM OBJECTIVE

Build a centralized permission engine that:

Controls API access (backend enforcement mandatory)

Controls side menu visibility dynamically

Restricts project access based on team assignment

Applies role-based permissions

Works for Web (React) and Mobile (Flutter)

Supports EPS hierarchical filtering

Is scalable to enterprise level

2️⃣ ACCESS CONTROL MODEL

We are implementing:

RBAC (Role Based Access Control)
+
Project Team Membership Restriction
+
EPS Scoped Data Filtering
+
UI Dynamic Rendering Based on Permissions
3️⃣ CORE ENTITIES
🧑 USERS
id
name
email
password
default_role_id
is_active
🏷 ROLES
id
name
description
is_system_role

Examples:

Super Admin

Project Manager

Planning Engineer

QA Engineer

Viewer

🔑 PERMISSIONS
id
module
action
code (unique)
description

Permission naming format:

[module].[action]

Examples:

schedule.create
schedule.read
schedule.update
schedule.delete

quality.checklist.create
boq.item.read
report.export
🔗 ROLE_PERMISSIONS
role_id
permission_id

(Many-to-Many relationship)

🏗 PROJECTS
id
name
eps_path
status

Example:

1/3/7/12
👥 PROJECT_TEAM_MEMBERS
id
project_id
user_id
role_id (optional override)

⚠ CRITICAL RULE:

If user is NOT in project_team_members,
→ User CANNOT access that project
→ Even if role has permissions

4️⃣ PERMISSION RESOLUTION LOGIC (FINAL FLOW)

When API is called:

STEP 1 — Validate JWT

If invalid → reject.

STEP 2 — Check User Active

If is_active = false → reject.

STEP 3 — Check Project Team Membership
SELECT * FROM project_team_members
WHERE user_id = :user
AND project_id = :project

If not found → reject.

STEP 4 — Determine Role

Priority:

1. Project-specific role (if defined)
2. Default user role
STEP 5 — Check Permission

Example API:

POST /projects/:id/schedule

Required permission:

schedule.create

Check:

Does role have this permission?

If YES → allow
If NO → reject

5️⃣ DYNAMIC SIDE MENU VISIBILITY RULES

Side menu must be generated based on permission list.

Example: Planning Module (Schedule)

Planning menu should appear ONLY IF:

User has ANY of:

schedule.read
schedule.create
schedule.update
schedule.delete

Logic:

IF permissions contain any permission starting with "schedule."
THEN show Planning module
ELSE hide Planning module
Inside Planning Module
Show "Create Schedule" button ONLY IF:
schedule.create
Show Edit option ONLY IF:
schedule.update
Show Delete option ONLY IF:
schedule.delete
View Only Mode:

If only:

schedule.read

Then:

Show module

Hide create/edit/delete buttons

Disable inline editing

6️⃣ PROJECT VISIBILITY RULES

After login, backend must return only assigned projects:

SELECT projects.*
FROM projects
JOIN project_team_members
ON projects.id = project_team_members.project_id
WHERE project_team_members.user_id = :user

User should only see:

Assigned projects in dropdown

No other project visible in UI

No direct URL access allowed

7️⃣ EPS DATA FILTERING

Each project row contains:

eps_path = '1/3/7/12'

Future-ready extension:

Optional table:

user_eps_scope
user_id
eps_node_id

Filter:

WHERE eps_path LIKE :eps_scope%

This enables hierarchical access similar to Primavera.

8️⃣ LOGIN RESPONSE STRUCTURE (CRITICAL FOR UI)

After successful login:

{
  "user": {
    "id": 5,
    "name": "Ram"
  },
  "permissions": [
    "schedule.read",
    "schedule.create",
    "quality.read"
  ],
  "project_ids": [1, 4, 7]
}

Frontend must store:

permissions

allowed project IDs

9️⃣ REACT SIDE MENU IMPLEMENTATION RULE

Example:

const canAccessPlanning = permissions.some(p =>
  p.startsWith("schedule.")
);

if (canAccessPlanning) {
   showPlanningMenu();
}
🔟 FLUTTER MOBILE IMPLEMENTATION RULE

After login:

Store permissions in secure storage.

Example:

bool canCreateSchedule =
  permissions.contains('schedule.create');

Hide widgets based on permission.

Example:

if (permissions.any((p) => p.startsWith('schedule.'))) {
   return PlanningMenu();
}

⚠ Backend validation still mandatory.

1️⃣1️⃣ NESTJS BACKEND ARCHITECTURE
Folder Structure
auth/
  guards/
    jwt.guard.ts

permission/
  permission.module.ts
  permission.service.ts
  permission.guard.ts

project-team/
  project-team.module.ts
  project.guard.ts

common/
  decorators/
    require-permission.decorator.ts
Permission Decorator Example
@RequirePermission('schedule.create')
@Post()
createSchedule()
Guard Execution Order
JWT Guard
→ Project Guard
→ Permission Guard
→ Controller
1️⃣2️⃣ FINAL AUTHORIZATION FLOW
User Login
   ↓
Backend returns permissions + assigned projects
   ↓
Frontend builds dynamic side menu
   ↓
User selects project
   ↓
API call with project_id
   ↓
Project Guard validates membership
   ↓
Permission Guard validates action
   ↓
Data filtered by EPS
   ↓
Response returned
1️⃣3️⃣ SECURITY RULES (NON-NEGOTIABLE)

Never trust frontend permission.

Always validate:

JWT

Project team membership

Role permission

Always log critical actions.

1️⃣4️⃣ AUDIT LOG TABLE
id
user_id
project_id
module
action
record_id
timestamp
ip_address

Track:

schedule delete

approval actions

role changes

team changes

1️⃣5️⃣ EXAMPLE SCENARIO (YOUR TOUGH CASE)
Role: Planning Engineer

Permissions:

schedule.read
schedule.create
schedule.update
Assigned to Project A

Result:

✅ Planning module visible
✅ Create button visible
✅ Edit allowed
❌ Delete hidden
❌ Cannot see Project B
❌ Cannot access via URL
❌ Cannot call API manually

If user removed from Project A team:

Result:

❌ Project disappears from dropdown
❌ All schedule APIs blocked
❌ Even if role still has permission

1️⃣6️⃣ ENTERPRISE READY FEATURES

This design supports:

Multi-project system

Mobile + Web sync

Workflow permissions (approve/reject)

EPS hierarchy

Future microservices

500+ concurrent users

Compliance audit

Role cloning

Permission matrix UI

✅ FINAL SUMMARY

Access is granted ONLY when:

User is active
AND
User assigned to project
AND
Role has required permission
AND
EPS scope matches

Side menu visibility is based on:

Permission list returned at login

Project visibility is based on:

Project team membership

API access is enforced by:

NestJS Guards