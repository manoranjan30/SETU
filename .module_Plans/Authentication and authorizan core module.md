Module 1 – Authentication & Authorization (Core)

Objective
Build ONLY the Authentication & Authorization core module.
Do not create or scaffold any other modules.

Scope (STRICT)

Authentication

Login / Logout

Secure password handling

JWT-based authentication

Authorization (RBAC)

Role-based access control

API + UI level authorization checks

Role Management (CRUD)

Create, Read, Update, Delete roles

Assign permissions to roles

User Management (CRUD)

Create, Read, Update, Delete users

Assign role(s) to users

Activate / Deactivate users

Backend Requirements

REST APIs only

Controllers, Services, Repositories separation

Auth middleware / guards

Database tables:

Users

Roles

Permissions (if required)

User-Role mapping

Enforce authorization on APIs

Frontend Requirements

Login screen

User Management CRUD screens

Role Management CRUD screens

Protected routes based on role

Validation and error handling

Physical Verification (MANDATORY)

Create role → persist in DB

Create user → assign role

Login as user

Allow / deny access based on role

Update / delete users and roles and verify behavior

Documentation Requirement
Create folder at root:

/Explanation


Inside it create file:

/Explanation/AUTHENTICATION_AUTHORIZATION.md


File must include:

Module overview

Backend flow explanation

Frontend flow explanation

ASCII / Markdown flow diagrams for:

Authentication

Authorization

User–Role relationship

Clear list of:

What is completed

What is NOT implemented

Rules

❌ Do NOT implement EPS, Projects, Dashboards, or any future modules

❌ Do NOT scaffold unused features

✅ Build, run, and test this module end-to-end

✅ Keep code clean and extensible

Completion Criteria
Module is complete only when:

APIs work

UI works

RBAC is enforced

Explanation file is complete

Manual end-to-end testing is possible