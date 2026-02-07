
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
} as const;

export type Permission = typeof PermissionCode[keyof typeof PermissionCode];

// Define Implicit Dependencies
// Key: The permission you HAVE
// Value: The permissions you automatically GET (Implied)
export const PERMISSION_DEPENDENCIES: Record<string, string[]> = {
    // Design
    [PermissionCode.DESIGN_READ]: [PermissionCode.VIEW_PROJECTS],
    [PermissionCode.DESIGN_UPLOAD]: [PermissionCode.DESIGN_READ, PermissionCode.VIEW_PROJECTS],
    [PermissionCode.DESIGN_APPROVE]: [PermissionCode.DESIGN_READ, PermissionCode.VIEW_PROJECTS],

    // Planning
    [PermissionCode.PLANNING_READ]: [PermissionCode.VIEW_PROJECTS],
    [PermissionCode.PLANNING_EDIT]: [PermissionCode.PLANNING_READ, PermissionCode.VIEW_PROJECTS],
    [PermissionCode.PLANNING_BASELINE]: [PermissionCode.PLANNING_READ, PermissionCode.VIEW_PROJECTS],

    // BOQ
    [PermissionCode.BOQ_READ]: [PermissionCode.VIEW_PROJECTS],
    [PermissionCode.BOQ_MANAGE]: [PermissionCode.BOQ_READ, PermissionCode.VIEW_PROJECTS],

    // Execution
    [PermissionCode.EXECUTION_READ]: [PermissionCode.VIEW_PROJECTS],
    [PermissionCode.EXECUTION_UPDATE]: [PermissionCode.EXECUTION_READ, PermissionCode.VIEW_PROJECTS],

    // Quality
    [PermissionCode.QUALITY_READ]: [PermissionCode.VIEW_PROJECTS],
    [PermissionCode.QUALITY_MANAGE]: [PermissionCode.QUALITY_READ, PermissionCode.VIEW_PROJECTS],

    // EHS
    [PermissionCode.EHS_READ]: [PermissionCode.VIEW_PROJECTS],
    [PermissionCode.EHS_MANAGE]: [PermissionCode.EHS_READ, PermissionCode.VIEW_PROJECTS],

    // Labor
    [PermissionCode.LABOR_READ]: [PermissionCode.VIEW_PROJECTS],
    [PermissionCode.LABOR_MANAGE]: [PermissionCode.LABOR_READ, PermissionCode.VIEW_PROJECTS],
};

/**
 * Recursively resolves all permissions including implied dependencies
 */
export function expandPermissions(directPermissions: string[]): string[] {
    const expanded = new Set<string>(directPermissions);

    // We iterate until size stops growing to handle nested dependencies (A->B->C)
    // Though current map is 1-level, this is future proof.
    let changed = true;
    while (changed) {
        changed = false;
        const currentSize = expanded.size;

        for (const perm of expanded) {
            const implied = PERMISSION_DEPENDENCIES[perm];
            if (implied) {
                implied.forEach(p => expanded.add(p));
            }
        }

        if (expanded.size > currentSize) {
            changed = true;
        }
    }

    return Array.from(expanded);
}
