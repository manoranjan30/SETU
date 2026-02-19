export const PermissionCode = {
    // Core & System
    VIEW_DASHBOARD: 'SYSTEM.DASHBOARD.VIEW',

    // EPS & Projects
    MANAGE_EPS: 'EPS.NODE.MANAGE',
    MANAGE_PROJECT_TEAM: 'PROJECT.TEAM.MANAGE',
    READ_PROJECT_PROPS: 'PROJECT.PROPERTIES.READ',
    UPDATE_PROJECT_PROPS: 'PROJECT.PROPERTIES.UPDATE',

    // WBS
    WBS_READ: 'WBS.NODE.READ',
    WBS_CREATE: 'WBS.NODE.CREATE',
    WBS_UPDATE: 'WBS.NODE.UPDATE',
    WBS_DELETE: 'WBS.NODE.DELETE',
    WBS_ACTIVITY_CREATE: 'WBS.ACTIVITY.CREATE',
    WBS_ACTIVITY_UPDATE: 'WBS.ACTIVITY.UPDATE',
    WBS_ACTIVITY_DELETE: 'WBS.ACTIVITY.DELETE',
    WBS_TEMPLATE_APPLY: 'WBS.TEMPLATE.APPLY',

    // Schedule
    SCHEDULE_READ: 'SCHEDULE.READ',
    SCHEDULE_UPDATE: 'SCHEDULE.UPDATE',
    SCHEDULE_BASELINE: 'SCHEDULE.BASELINE.MANAGE',

    // BOQ (Budget & Scope)
    BOQ_READ: 'BOQ.Item.Read',
    BOQ_CREATE: 'BOQ.Item.Create',
    BOQ_UPDATE: 'BOQ.Item.Update',
    BOQ_DELETE: 'BOQ.Item.Delete',
    BOQ_IMPORT: 'BOQ.Import',

    // Execution (Progress)
    EXECUTION_READ: 'Execution.Entry.Read',
    EXECUTION_CREATE: 'Execution.Entry.Create',
    EXECUTION_UPDATE: 'Execution.Entry.Update',
    EXECUTION_APPROVE: 'Execution.Entry.Approve',

    // Labor
    LABOR_READ: 'Labor.Entry.Read',
    LABOR_CREATE: 'Labor.Entry.Create',
    LABOR_CATEGORY_MANAGE: 'Labor.Category.Manage',

    // EHS (Safety)
    EHS_READ: 'EHS.Read',
    EHS_INCIDENT_CREATE: 'EHS.Incident.Create',
    EHS_INSPECTION_CREATE: 'EHS.Inspection.Create',
    EHS_COMPLIANCE_MANAGE: 'EHS.Compliance.Manage',

    // Quality (QA/QC)
    QUALITY_READ: 'Quality.Read',
    QUALITY_INSPECTION_RAISE: 'Quality.Inspection.Raise',
    QUALITY_INSPECTION_APPROVE: 'Quality.Inspection.Approve',
    QUALITY_TEST_MANAGE: 'Quality.Test.Manage',

    // Design
    DESIGN_READ: 'Design.Drawing.Read',
    DESIGN_UPLOAD: 'Design.Drawing.Upload',
    DESIGN_APPROVE: 'Design.Drawing.Approve',
    DESIGN_DELETE: 'Design.Drawing.Delete',

    // Admin (Users & Roles)
    USER_CREATE: 'User.Management.Create',
    USER_READ: 'User.Management.Read',
    USER_UPDATE: 'User.Management.Update',
    USER_DELETE: 'User.Management.Delete',

    ROLE_CREATE: 'Role.Management.Create',
    ROLE_READ: 'Role.Management.Read',
    ROLE_UPDATE: 'Role.Management.Update',
    ROLE_DELETE: 'Role.Management.Delete',
} as const;

export type Permission = typeof PermissionCode[keyof typeof PermissionCode];
