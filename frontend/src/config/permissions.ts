export const PermissionCode = {
    // Core
    VIEW_DASHBOARD: 'VIEW_DASHBOARD',
    VIEW_PROJECTS: 'VIEW_PROJECTS',

    // Admin
    MANAGE_USERS: 'MANAGE_USERS',
    MANAGE_ROLES: 'MANAGE_ROLES',

    // EPS
    MANAGE_EPS: 'MANAGE_EPS', // Create/Edit Projects/EPS nodes

    // Design (Drawings)
    DESIGN_READ: 'DESIGN.READ',
    DESIGN_UPLOAD: 'DESIGN.UPLOAD',
    DESIGN_APPROVE: 'DESIGN.APPROVE',

    // Planning (Schedule)
    PLANNING_READ: 'PLANNING.READ',
    PLANNING_EDIT: 'PLANNING.EDIT', // WBS, Activities, Links
    PLANNING_BASELINE: 'PLANNING.BASELINE',

    // BOQ (Scope)
    BOQ_READ: 'BOQ.READ',
    BOQ_MANAGE: 'BOQ.MANAGE', // Import/Edit

    // Execution (Site)
    EXECUTION_READ: 'EXECUTION.READ',
    EXECUTION_UPDATE: 'EXECUTION.UPDATE', // Daily Progress

    // Quality
    QUALITY_READ: 'QUALITY.READ',
    QUALITY_MANAGE: 'QUALITY.MANAGE',

    // EHS (Safety)
    EHS_READ: 'EHS.READ',
    EHS_MANAGE: 'EHS.MANAGE',

    // Labor
    LABOR_READ: 'LABOR.READ',
    LABOR_MANAGE: 'LABOR.MANAGE',

    // Tasks (Legacy/Generic)
    VIEW_TASKS: 'VIEW_TASKS',
    MANAGE_TASKS: 'MANAGE_TASKS',

    // Team (Legacy)
    VIEW_TEAM: 'VIEW_TEAM',
    MANAGE_TEAM: 'MANAGE_TEAM',

    // WBS (Legacy mappings for backward compatibility if needed, or remove)
    VIEW_WBS: 'WBS.READ', // Mapped to PLANNING_READ ideally
    MANAGE_WBS: 'WBS.UPDATE',

    // WBS Templates
    WBS_TEMPLATE_READ: 'WBS.TEMPLATE.READ',
    WBS_TEMPLATE_MANAGE: 'WBS.TEMPLATE.MANAGE',
    WBS_TEMPLATE_APPLY: 'WBS.TEMPLATE.APPLY',
} as const;

export type Permission = typeof PermissionCode[keyof typeof PermissionCode];
