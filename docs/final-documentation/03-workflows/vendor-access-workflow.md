# Vendor Access Workflow

[Back to Index](../README.md) | Related: [WorkDoc And Vendors](../02-modules/workdoc-and-vendors.md), [Admin](../02-modules/admin.md)

```mermaid
flowchart TD
    Admin[Admin] --> Template[Vendor Access Template]
    Template --> VendorUser[Vendor/temporary user]
    VendorUser --> Project[Project-scoped access]
    Project --> Allowed[Allowed module actions]
    Allowed --> WorkDoc[WorkDoc/Execution/Quality actions]
```

## Source Code

- Backend: `backend/src/temp-user`, `backend/src/workdoc`, `backend/src/projects`
- Frontend: `frontend/src/pages/admin/VendorAccessTemplatesPage.tsx`

