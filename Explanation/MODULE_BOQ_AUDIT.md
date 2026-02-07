# BOQ Module: Governance, Permissions, and Audit

## Overview
The BOQ Module is now enhanced with a strict governance layer to ensure data integrity and accountability. This document outlines the Permission System, Audit Trail, and Usage Guidelines.

## 1. Permissions
Access to BOQ data is controlled by Role-Based Access Control (RBAC).

| Permission Code | Name | Description |
| :--- | :--- | :--- |
| `VIEW_BOQ` | View BOQ | Read-only access to BOQ items and measurements. |
| `MANAGE_BOQ` | Manage BOQ | Create, Edit, and Delete BOQ items. |
| `IMPORT_BOQ` | Import BOQ | Access to Bulk Import tools (Excel). |

### Role Assignments (Default)
- **Admin**: Has all permissions.
- **User**: Has `VIEW_BOQ`. (Can be upgraded by assigning additional roles).

## 2. Audit Trail
Every modification to the BOQ Structure is strictly logged.

### Tracked Events
- **CREATE**: New Item creation (Manual or Import).
- **UPDATE**: Changes to Description, UOM, or Quantity.
- **DELETE**: Removal of Items.
- **IMPORT**: Bulk operations.

### Audit Log Schema
Query the `audit_log` table:
- `timestamp`: UTC Time of action.
- `userId`: ID of the actor.
- `action`: `CREATE`, `UPDATE`, `DELETE`.
- `resourceType`: `BOQ_ITEM` or `MEASUREMENT`.
- `details`: JSON snapshot of the change.

## 3. Developer Guide
### API Security
All BOQ endpoints are guarded:
```typescript
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('boq')
```

### Adding Audit to New Features
Inject `AuditService` and call `log()`:
```typescript
await this.auditService.log(
    userId, 
    'ACTION_NAME', 
    'RESOURCE_TYPE', 
    resourceId, 
    { key: 'details' }
);
```

## 4. Prompting Instructions for AI
When extending this module, always:
1.  Check for `MANAGE_BOQ` permission on modification routes.
2.  Extract `userId` from `@GetUser()`.
3.  Call `auditService.log()` for any state change.
