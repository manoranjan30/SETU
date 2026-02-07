"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERMISSION_DEPENDENCIES = exports.PermissionCode = void 0;
exports.expandPermissions = expandPermissions;
exports.PermissionCode = {
    VIEW_DASHBOARD: 'VIEW_DASHBOARD',
    VIEW_PROJECTS: 'VIEW_PROJECTS',
    MANAGE_USERS: 'MANAGE_USERS',
    MANAGE_ROLES: 'MANAGE_ROLES',
    MANAGE_EPS: 'MANAGE_EPS',
    DESIGN_READ: 'DESIGN.READ',
    DESIGN_UPLOAD: 'DESIGN.UPLOAD',
    DESIGN_APPROVE: 'DESIGN.APPROVE',
    PLANNING_READ: 'PLANNING.READ',
    PLANNING_EDIT: 'PLANNING.EDIT',
    PLANNING_BASELINE: 'PLANNING.BASELINE',
    BOQ_READ: 'BOQ.READ',
    BOQ_MANAGE: 'BOQ.MANAGE',
    EXECUTION_READ: 'EXECUTION.READ',
    EXECUTION_UPDATE: 'EXECUTION.UPDATE',
    QUALITY_READ: 'QUALITY.READ',
    QUALITY_MANAGE: 'QUALITY.MANAGE',
    EHS_READ: 'EHS.READ',
    EHS_MANAGE: 'EHS.MANAGE',
    LABOR_READ: 'LABOR.READ',
    LABOR_MANAGE: 'LABOR.MANAGE',
};
exports.PERMISSION_DEPENDENCIES = {
    [exports.PermissionCode.DESIGN_READ]: [exports.PermissionCode.VIEW_PROJECTS],
    [exports.PermissionCode.DESIGN_UPLOAD]: [exports.PermissionCode.DESIGN_READ, exports.PermissionCode.VIEW_PROJECTS],
    [exports.PermissionCode.DESIGN_APPROVE]: [exports.PermissionCode.DESIGN_READ, exports.PermissionCode.VIEW_PROJECTS],
    [exports.PermissionCode.PLANNING_READ]: [exports.PermissionCode.VIEW_PROJECTS],
    [exports.PermissionCode.PLANNING_EDIT]: [exports.PermissionCode.PLANNING_READ, exports.PermissionCode.VIEW_PROJECTS],
    [exports.PermissionCode.PLANNING_BASELINE]: [exports.PermissionCode.PLANNING_READ, exports.PermissionCode.VIEW_PROJECTS],
    [exports.PermissionCode.BOQ_READ]: [exports.PermissionCode.VIEW_PROJECTS],
    [exports.PermissionCode.BOQ_MANAGE]: [exports.PermissionCode.BOQ_READ, exports.PermissionCode.VIEW_PROJECTS],
    [exports.PermissionCode.EXECUTION_READ]: [exports.PermissionCode.VIEW_PROJECTS],
    [exports.PermissionCode.EXECUTION_UPDATE]: [exports.PermissionCode.EXECUTION_READ, exports.PermissionCode.VIEW_PROJECTS],
    [exports.PermissionCode.QUALITY_READ]: [exports.PermissionCode.VIEW_PROJECTS],
    [exports.PermissionCode.QUALITY_MANAGE]: [exports.PermissionCode.QUALITY_READ, exports.PermissionCode.VIEW_PROJECTS],
    [exports.PermissionCode.EHS_READ]: [exports.PermissionCode.VIEW_PROJECTS],
    [exports.PermissionCode.EHS_MANAGE]: [exports.PermissionCode.EHS_READ, exports.PermissionCode.VIEW_PROJECTS],
    [exports.PermissionCode.LABOR_READ]: [exports.PermissionCode.VIEW_PROJECTS],
    [exports.PermissionCode.LABOR_MANAGE]: [exports.PermissionCode.LABOR_READ, exports.PermissionCode.VIEW_PROJECTS],
};
function expandPermissions(directPermissions) {
    const expanded = new Set(directPermissions);
    let changed = true;
    while (changed) {
        changed = false;
        const currentSize = expanded.size;
        for (const perm of expanded) {
            const implied = exports.PERMISSION_DEPENDENCIES[perm];
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
//# sourceMappingURL=permission-config.js.map