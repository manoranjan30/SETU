/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  PERMISSION REGISTRY — SINGLE SOURCE OF TRUTH                          ║
 * ║                                                                        ║
 * ║  To add permissions for a NEW module:                                  ║
 * ║  1. Define a new array constant (e.g., MYMODULE_PERMISSIONS)           ║
 * ║  2. Add it to ALL_MODULE_PERMISSIONS array at the bottom               ║
 * ║  3. Run the backend — permissions auto-register in DB                  ║
 * ║  4. Update frontend/src/config/permissions.ts with matching codes      ║
 * ║                                                                        ║
 * ║  Naming: MODULE.ENTITY.ACTION (ALL CAPS, dot-separated)               ║
 * ║  Legacy system codes (VIEW_DASHBOARD, etc.) are exceptions.            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import {
    PermissionAction,
    PermissionScope,
} from '../permissions/permission.entity';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PermissionDef {
    /** Unique code: MODULE.ENTITY.ACTION (ALL CAPS) */
    code: string;
    /** Human-readable name */
    name: string;
    /** Module name (ALL CAPS) */
    module: string;
    /** Action type */
    action: PermissionAction;
    /** Scope level (defaults to PROJECT) */
    scope?: PermissionScope;
    /** Optional description */
    description?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Generates standard CRUD + READ permissions for a module entity */
function crud(
    module: string,
    entity: string,
    readName: string,
    scope = PermissionScope.PROJECT,
): PermissionDef[] {
    return [
        { code: `${module}.${entity}.READ`, name: `View ${readName}`, module, action: PermissionAction.READ, scope },
        { code: `${module}.${entity}.CREATE`, name: `Create ${readName}`, module, action: PermissionAction.CREATE, scope },
        { code: `${module}.${entity}.UPDATE`, name: `Update ${readName}`, module, action: PermissionAction.UPDATE, scope },
        { code: `${module}.${entity}.DELETE`, name: `Delete ${readName}`, module, action: PermissionAction.DELETE, scope },
    ];
}

/** Creates a single permission definition */
function perm(
    code: string,
    name: string,
    module: string,
    action: PermissionAction,
    scope = PermissionScope.PROJECT,
): PermissionDef {
    return { code, name, module, action, scope };
}

const R = PermissionAction.READ;
const C = PermissionAction.CREATE;
const U = PermissionAction.UPDATE;
const D = PermissionAction.DELETE;
const S = PermissionAction.SPECIAL;
const SYS = PermissionScope.SYSTEM;
const PRJ = PermissionScope.PROJECT;

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM-LEVEL PERMISSIONS (Legacy codes — do not rename)
// ═══════════════════════════════════════════════════════════════════════════════

export const SYSTEM_PERMISSIONS: PermissionDef[] = [
    perm('VIEW_DASHBOARD', 'View Dashboard', 'SYSTEM', R, SYS),
    perm('VIEW_PROJECTS', 'View Projects', 'SYSTEM', R, SYS),
    perm('MANAGE_USERS', 'Manage Users', 'ADMIN', S, SYS),
    perm('MANAGE_ROLES', 'Manage Roles', 'ADMIN', S, SYS),
    perm('MANAGE_EPS', 'Manage EPS', 'EPS', S, SYS),
    perm('AUDIT.READ', 'View Audit Logs', 'ADMIN', R, SYS),
];

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 1: EPS (Enterprise Project Structure)
// ═══════════════════════════════════════════════════════════════════════════════

export const EPS_PERMISSIONS: PermissionDef[] = [
    ...crud('EPS', 'NODE', 'EPS Node'),
    perm('EPS.NODE.IMPORT', 'Import Project from File', 'EPS', C),
];

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 2: PROJECT (Team & Properties)
// ═══════════════════════════════════════════════════════════════════════════════

export const PROJECT_PERMISSIONS: PermissionDef[] = [
    perm('PROJECT.PROPERTIES.READ', 'View Project Properties', 'PROJECT', R),
    perm('PROJECT.PROPERTIES.UPDATE', 'Update Project Properties', 'PROJECT', U),
    perm('PROJECT.TEAM.READ', 'View Project Team', 'PROJECT', R),
    perm('PROJECT.TEAM.MANAGE', 'Manage Project Team', 'PROJECT', S),
];

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 3: WBS (Work Breakdown Structure)
// ═══════════════════════════════════════════════════════════════════════════════

export const WBS_PERMISSIONS: PermissionDef[] = [
    ...crud('WBS', 'NODE', 'WBS Node'),
    perm('WBS.NODE.IMPORT', 'Import WBS from File', 'WBS', C),
    ...crud('WBS', 'ACTIVITY', 'Activity'),
    perm('WBS.TEMPLATE.READ', 'View WBS Templates', 'WBS', R),
    perm('WBS.TEMPLATE.APPLY', 'Apply WBS Template', 'WBS', C),
    perm('WBS.TEMPLATE.MANAGE', 'Manage WBS Templates', 'WBS', S),
];

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 4: SCHEDULE (Planning & Calendar)
// ═══════════════════════════════════════════════════════════════════════════════

export const SCHEDULE_PERMISSIONS: PermissionDef[] = [
    perm('SCHEDULE.READ', 'View Schedule / Gantt', 'SCHEDULE', R),
    perm('SCHEDULE.UPDATE', 'Calculate / Recalculate Schedule', 'SCHEDULE', U),
    perm('SCHEDULE.IMPORT', 'Import Schedule from File', 'SCHEDULE', C),
    perm('SCHEDULE.VERSION.CREATE', 'Create Baseline Version', 'SCHEDULE', C),
    perm('SCHEDULE.VERSION.READ', 'View Baseline Versions', 'SCHEDULE', R),
    perm('SCHEDULE.CALENDAR.READ', 'View Calendar', 'SCHEDULE', R),
    perm('SCHEDULE.CALENDAR.CREATE', 'Create Calendar', 'SCHEDULE', C),
    perm('SCHEDULE.CALENDAR.UPDATE', 'Update Calendar', 'SCHEDULE', U),
    perm('SCHEDULE.CALENDAR.DELETE', 'Delete Calendar', 'SCHEDULE', D),
];

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 5: BOQ (Bill of Quantities)
// ═══════════════════════════════════════════════════════════════════════════════

export const BOQ_PERMISSIONS: PermissionDef[] = [
    ...crud('BOQ', 'ITEM', 'BOQ Item'),
    perm('BOQ.ITEM.IMPORT', 'Import BOQ from File', 'BOQ', C),
    perm('BOQ.MEASUREMENT.MANAGE', 'Manage Measurements', 'BOQ', S),
    perm('BOQ.MEASUREMENT.IMPORT', 'Import Measurements from File', 'BOQ', C),
    perm('BOQ.PROGRESS.CREATE', 'Log BOQ Progress', 'BOQ', C),
];

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 6: PLANNING (Execution Mapping)
// ═══════════════════════════════════════════════════════════════════════════════

export const PLANNING_PERMISSIONS: PermissionDef[] = [
    perm('PLANNING.MATRIX.READ', 'View Distribution Matrix', 'PLANNING', R),
    perm('PLANNING.MATRIX.UPDATE', 'Distribute / Undistribute', 'PLANNING', U),
    perm('PLANNING.ANALYSIS.READ', 'View Gap Analysis', 'PLANNING', R),
    perm('PLANNING.RECOVERY.MANAGE', 'Create Recovery Plan', 'PLANNING', S),
    perm('PLANNING.LOOKAHEAD.CREATE', 'Create Look-Ahead Plan', 'PLANNING', C),
];

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 7: EXECUTION (Site Progress)
// ═══════════════════════════════════════════════════════════════════════════════

export const EXECUTION_PERMISSIONS: PermissionDef[] = [
    perm('EXECUTION.ENTRY.READ', 'View Progress Logs', 'EXECUTION', R),
    perm('EXECUTION.ENTRY.CREATE', 'Log Daily Progress', 'EXECUTION', C),
    perm('EXECUTION.ENTRY.UPDATE', 'Edit Progress Log', 'EXECUTION', U),
    perm('EXECUTION.ENTRY.DELETE', 'Delete Progress Log', 'EXECUTION', D),
    perm('EXECUTION.MICRO.CREATE', 'Submit Micro-Schedule Log', 'EXECUTION', C),
    perm('EXECUTION.ENTRY.APPROVE', 'Approve / Reject Progress', 'EXECUTION', S),
];

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 8: MICRO SCHEDULE
// ═══════════════════════════════════════════════════════════════════════════════

export const MICRO_PERMISSIONS: PermissionDef[] = [
    ...crud('MICRO', 'SCHEDULE', 'Micro Schedule'),
    perm('MICRO.SCHEDULE.SUBMIT', 'Submit Micro Schedule', 'MICRO', S),
    perm('MICRO.SCHEDULE.APPROVE', 'Approve Micro Schedule', 'MICRO', S),
    perm('MICRO.SCHEDULE.MANAGE', 'Activate Micro Schedule', 'MICRO', S),
    ...crud('MICRO', 'ACTIVITY', 'Micro Activity'),
    perm('MICRO.LOG.CREATE', 'Log Daily Micro Progress', 'MICRO', C),
    perm('MICRO.LOG.UPDATE', 'Edit Micro Progress Log', 'MICRO', U),
    perm('MICRO.LOG.DELETE', 'Delete Micro Progress Log', 'MICRO', D),
];

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 9: PROGRESS (Analytics Dashboard)
// ═══════════════════════════════════════════════════════════════════════════════

export const PROGRESS_PERMISSIONS: PermissionDef[] = [
    perm('PROGRESS.DASHBOARD.READ', 'View Progress Analytics', 'PROGRESS', R),
    perm('PROGRESS.INSIGHTS.READ', 'View AI Insights', 'PROGRESS', R),
];

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 10: LABOR (Manpower)
// ═══════════════════════════════════════════════════════════════════════════════

export const LABOR_PERMISSIONS: PermissionDef[] = [
    perm('LABOR.CATEGORY.READ', 'View Labor Categories', 'LABOR', R),
    perm('LABOR.CATEGORY.MANAGE', 'Manage Labor Categories', 'LABOR', S),
    perm('LABOR.ENTRY.READ', 'View Attendance', 'LABOR', R),
    perm('LABOR.ENTRY.CREATE', 'Log Attendance', 'LABOR', C),
    perm('LABOR.MAPPING.MANAGE', 'Manage Activity Mapping', 'LABOR', S),
    perm('LABOR.ENTRY.IMPORT', 'Import Labor Data', 'LABOR', C),
];

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 11: EHS (Environment, Health & Safety)
// ═══════════════════════════════════════════════════════════════════════════════

export const EHS_PERMISSIONS: PermissionDef[] = [
    perm('EHS.DASHBOARD.READ', 'View EHS Dashboard', 'EHS', R),
    ...crud('EHS', 'OBSERVATION', 'Safety Observation'),
    ...crud('EHS', 'INCIDENT', 'Incident'),
    ...crud('EHS', 'INSPECTION', 'EHS Inspection'),
    ...crud('EHS', 'TRAINING', 'Training'),
    perm('EHS.ENVIRONMENTAL.READ', 'View Environmental Records', 'EHS', R),
    perm('EHS.ENVIRONMENTAL.CREATE', 'Create Environmental Record', 'EHS', C),
    perm('EHS.LEGAL.READ', 'View Legal Compliance', 'EHS', R),
    perm('EHS.LEGAL.MANAGE', 'Manage Legal Compliance', 'EHS', S),
    perm('EHS.MACHINERY.MANAGE', 'Manage Machinery Records', 'EHS', S),
    perm('EHS.PERFORMANCE.MANAGE', 'Manage Performance Metrics', 'EHS', S),
    perm('EHS.COMPETENCY.MANAGE', 'Manage Competencies', 'EHS', S),
    perm('EHS.VEHICLE.MANAGE', 'Manage Vehicles', 'EHS', S),
    perm('EHS.INCIDENTREGISTER.MANAGE', 'Manage Incident Register', 'EHS', S),
    perm('EHS.MANHOUR.READ', 'View Manhour Data', 'EHS', R),
    perm('EHS.MANHOUR.CREATE', 'Log Manhour Data', 'EHS', C),
];

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 12: QUALITY (QA/QC)
// ═══════════════════════════════════════════════════════════════════════════════

export const QUALITY_PERMISSIONS: PermissionDef[] = [
    perm('QUALITY.DASHBOARD.READ', 'View Quality Summary', 'QUALITY', R),
    ...crud('QUALITY', 'CHECKLIST', 'Checklist'),
    ...crud('QUALITY', 'TEST', 'Material Test'),
    ...crud('QUALITY', 'NCR', 'NCR / Observation'),
    ...crud('QUALITY', 'SNAG', 'Snag'),
    ...crud('QUALITY', 'AUDIT', 'Quality Audit'),
    perm('QUALITY.DOCUMENT.READ', 'View Quality Documents', 'QUALITY', R),
    perm('QUALITY.DOCUMENT.MANAGE', 'Manage Quality Documents', 'QUALITY', S),
    ...crud('QUALITY', 'ACTIVITYLIST', 'Activity List'),
    perm('QUALITY.ACTIVITYLIST.MANAGE', 'Clone Activity List', 'QUALITY', S),
    ...crud('QUALITY', 'ACTIVITY', 'Quality Activity'),
    perm('QUALITY.SEQUENCE.READ', 'View Sequence Graph', 'QUALITY', R),
    perm('QUALITY.SEQUENCE.UPDATE', 'Update Sequence Graph', 'QUALITY', U),
    perm('QUALITY.INSPECTION.READ', 'View Inspections (RFI)', 'QUALITY', R),
    perm('QUALITY.INSPECTION.RAISE', 'Raise Inspection (RFI)', 'QUALITY', C),
    perm('QUALITY.INSPECTION.APPROVE', 'Approve Inspection', 'QUALITY', S),
    perm('QUALITY.STRUCTURE.MANAGE', 'Manage Structure Templates', 'QUALITY', S),
];

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 13: DESIGN (Drawings)
// ═══════════════════════════════════════════════════════════════════════════════

export const DESIGN_PERMISSIONS: PermissionDef[] = [
    perm('DESIGN.CATEGORY.READ', 'View Drawing Categories', 'DESIGN', R),
    perm('DESIGN.CATEGORY.CREATE', 'Create Drawing Category', 'DESIGN', C),
    perm('DESIGN.DRAWING.READ', 'View Drawing Register', 'DESIGN', R),
    perm('DESIGN.DRAWING.CREATE', 'Create Drawing Entry', 'DESIGN', C),
    perm('DESIGN.DRAWING.UPLOAD', 'Upload Drawing Revision', 'DESIGN', C),
    perm('DESIGN.DRAWING.UPDATE', 'Update Drawing Details', 'DESIGN', U),
    perm('DESIGN.DRAWING.DELETE', 'Delete Drawing', 'DESIGN', D),
    perm('DESIGN.DRAWING.APPROVE', 'Approve Drawing (GFC)', 'DESIGN', S),
];

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 14: WORK ORDERS (Vendor Management)
// ═══════════════════════════════════════════════════════════════════════════════

export const WORKORDER_PERMISSIONS: PermissionDef[] = [
    ...crud('WORKORDER', 'VENDOR', 'Vendor'),
    perm('WORKORDER.ORDER.READ', 'View Work Orders', 'WORKORDER', R),
    perm('WORKORDER.ORDER.CREATE', 'Analyse WO PDF', 'WORKORDER', C),
    perm('WORKORDER.ORDER.IMPORT', 'Import WO Excel', 'WORKORDER', C),
    perm('WORKORDER.ORDER.DELETE', 'Delete Work Order', 'WORKORDER', D),
    perm('WORKORDER.MAPPING.READ', 'View Mapping Suggestions', 'WORKORDER', R),
    perm('WORKORDER.MAPPING.MANAGE', 'Manage WO-BOQ Mapping', 'WORKORDER', S),
    perm('WORKORDER.TEMPLATE.MANAGE', 'Manage WO Templates', 'WORKORDER', S),
];

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 15: RESOURCES (Master Data)
// ═══════════════════════════════════════════════════════════════════════════════

export const RESOURCE_PERMISSIONS: PermissionDef[] = [
    ...crud('RESOURCE', 'MASTER', 'Resource'),
    perm('RESOURCE.MASTER.IMPORT', 'Import Resources', 'RESOURCE', C),
    perm('RESOURCE.TEMPLATE.MANAGE', 'Manage Resource Templates', 'RESOURCE', S),
];

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 16: DASHBOARD (Management View)
// ═══════════════════════════════════════════════════════════════════════════════

export const DASHBOARD_PERMISSIONS: PermissionDef[] = [
    perm('DASHBOARD.SUMMARY.READ', 'View Project Summary', 'DASHBOARD', R),
    perm('DASHBOARD.ANALYTICS.READ', 'View Burn Rate / Milestones', 'DASHBOARD', R),
    perm('DASHBOARD.ALERTS.READ', 'View Alerts', 'DASHBOARD', R),
];

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 17: ADMIN (Users, Roles, Settings)
// ═══════════════════════════════════════════════════════════════════════════════

export const ADMIN_PERMISSIONS: PermissionDef[] = [
    ...crud('USER', 'MANAGEMENT', 'User', SYS),
    ...crud('ROLE', 'MANAGEMENT', 'Role', SYS),
    perm('AUDIT.LOG.READ', 'View Audit Logs', 'ADMIN', R, SYS),
    perm('ADMIN.SETTINGS.MANAGE', 'Manage System Settings', 'ADMIN', S, SYS),
    perm('ADMIN.TEMPLATE.MANAGE', 'Manage Report Templates', 'ADMIN', S, SYS),
];

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 18: TEMPLATE BUILDER (Checklist Templates)
// ═══════════════════════════════════════════════════════════════════════════════

export const TEMPLATE_PERMISSIONS: PermissionDef[] = [
    ...crud('TEMPLATE', 'BUILDER', 'Template'),
    perm('TEMPLATE.BUILDER.IMPORT', 'Import Template', 'TEMPLATE', C),
];

// ═══════════════════════════════════════════════════════════════════════════════
// ALL PERMISSIONS — Combined Registry
// ═══════════════════════════════════════════════════════════════════════════════

export const ALL_MODULE_PERMISSIONS: PermissionDef[][] = [
    SYSTEM_PERMISSIONS,
    EPS_PERMISSIONS,
    PROJECT_PERMISSIONS,
    WBS_PERMISSIONS,
    SCHEDULE_PERMISSIONS,
    BOQ_PERMISSIONS,
    PLANNING_PERMISSIONS,
    EXECUTION_PERMISSIONS,
    MICRO_PERMISSIONS,
    PROGRESS_PERMISSIONS,
    LABOR_PERMISSIONS,
    EHS_PERMISSIONS,
    QUALITY_PERMISSIONS,
    DESIGN_PERMISSIONS,
    WORKORDER_PERMISSIONS,
    RESOURCE_PERMISSIONS,
    DASHBOARD_PERMISSIONS,
    ADMIN_PERMISSIONS,
    TEMPLATE_PERMISSIONS,
];

/** Flat array of all permission definitions */
export const ALL_PERMISSIONS: PermissionDef[] = ALL_MODULE_PERMISSIONS.flat();

// ═══════════════════════════════════════════════════════════════════════════════
// MIGRATION MAP — Old inconsistent codes → New standardized ALL CAPS codes
// ═══════════════════════════════════════════════════════════════════════════════

export const MIGRATION_MAP: Record<string, string> = {
    // ─── BOQ (was PascalCase) ────────────────────────────────────────────────
    'BOQ.Item.Create': 'BOQ.ITEM.CREATE',
    'BOQ.Item.Read': 'BOQ.ITEM.READ',
    'BOQ.Item.Update': 'BOQ.ITEM.UPDATE',
    'BOQ.Item.Delete': 'BOQ.ITEM.DELETE',
    'BOQ.Import': 'BOQ.ITEM.IMPORT',
    'BOQ.READ': 'BOQ.ITEM.READ',           // Legacy shorthand
    'MANAGE_BOQ': 'BOQ.ITEM.UPDATE',        // Legacy manage code
    'VIEW_BOQ': 'BOQ.ITEM.READ',            // Legacy view code
    'MANAGE BOQ': 'BOQ.ITEM.UPDATE',        // Space variant
    'VIEW BOQ': 'BOQ.ITEM.READ',          // Space variant
    'BOQITEM.CREATE': 'BOQ.ITEM.CREATE',    // Typo variant

    // ─── Execution (was PascalCase + shorthand) ──────────────────────────────
    'Execution.Entry.Create': 'EXECUTION.ENTRY.CREATE',
    'Execution.Entry.Read': 'EXECUTION.ENTRY.READ',
    'Execution.Entry.Update': 'EXECUTION.ENTRY.UPDATE',
    'Execution.Entry.Approve': 'EXECUTION.ENTRY.APPROVE',
    'EXECUTION.READ': 'EXECUTION.ENTRY.READ',     // Legacy shorthand
    'EXECUTION.UPDATE': 'EXECUTION.ENTRY.UPDATE',  // Legacy shorthand
    'EXECUTION READ': 'EXECUTION.ENTRY.READ',     // Space variant
    'EXECUTION UPDATE': 'EXECUTION.ENTRY.UPDATE',  // Space variant

    // ─── Planning (legacy shorthand → new dotted format) ─────────────────────
    'PLANNING.READ': 'PLANNING.MATRIX.READ',       // Legacy shorthand

    // ─── Schedule (legacy shorthand) ─────────────────────────────────────────
    // 'SCHEDULE.READ' already matches registry — no migration needed

    // ─── Labor (was PascalCase) ──────────────────────────────────────────────
    'Labor.Entry.Create': 'LABOR.ENTRY.CREATE',
    'Labor.Entry.Read': 'LABOR.ENTRY.READ',
    'Labor.Category.Manage': 'LABOR.CATEGORY.MANAGE',

    // ─── EHS (was mixed) ─────────────────────────────────────────────────────
    'EHS.Read': 'EHS.DASHBOARD.READ',
    'EHS.Incident.Create': 'EHS.INCIDENT.CREATE',
    'EHS.Inspection.Create': 'EHS.INSPECTION.CREATE',
    'EHS.Compliance.Manage': 'EHS.LEGAL.MANAGE',

    // ─── Quality (was PascalCase) ────────────────────────────────────────────
    'Quality.Read': 'QUALITY.DASHBOARD.READ',
    'Quality.Inspection.Raise': 'QUALITY.INSPECTION.RAISE',
    'Quality.Inspection.Approve': 'QUALITY.INSPECTION.APPROVE',
    'Quality.Test.Manage': 'QUALITY.TEST.MANAGE',

    // ─── Design (was PascalCase) ─────────────────────────────────────────────
    'Design.Drawing.Read': 'DESIGN.DRAWING.READ',
    'Design.Drawing.Upload': 'DESIGN.DRAWING.UPLOAD',
    'Design.Drawing.Approve': 'DESIGN.DRAWING.APPROVE',
    'Design.Drawing.Delete': 'DESIGN.DRAWING.DELETE',
    'DESIGN.READ': 'DESIGN.DRAWING.READ',          // Legacy shorthand

    // ─── User & Role Management (was PascalCase) ─────────────────────────────
    'User.Management.Create': 'USER.MANAGEMENT.CREATE',
    'User.Management.Read': 'USER.MANAGEMENT.READ',
    'User.Management.Update': 'USER.MANAGEMENT.UPDATE',
    'User.Management.Delete': 'USER.MANAGEMENT.DELETE',
    'Role.Management.Create': 'ROLE.MANAGEMENT.CREATE',
    'Role.Management.Read': 'ROLE.MANAGEMENT.READ',
    'Role.Management.Update': 'ROLE.MANAGEMENT.UPDATE',
    'Role.Management.Delete': 'ROLE.MANAGEMENT.DELETE',

    // ─── Calendar (was separate module, now under SCHEDULE) ──────────────────
    'CALENDAR.CREATE': 'SCHEDULE.CALENDAR.CREATE',
    'CALENDAR.READ': 'SCHEDULE.CALENDAR.READ',
    'CALENDAR.UPDATE': 'SCHEDULE.CALENDAR.UPDATE',
    'CALENDAR.DELETE': 'SCHEDULE.CALENDAR.DELETE',

    // ─── Team Management (legacy codes) ──────────────────────────────────────
    'MANAGE_TEAM': 'PROJECT.TEAM.MANAGE',
    'VIEW_TEAM': 'PROJECT.TEAM.READ',
    'EDIT_PROJECT': 'PROJECT.PROPERTIES.UPDATE',

    // ─── Progress (legacy shorthand) ─────────────────────────────────────────
    'PROGRESS.READ': 'PROGRESS.DASHBOARD.READ',    // Legacy shorthand
    'VIEW DASHBOARD': 'PROGRESS.DASHBOARD.READ',   // Space variant
    'VIEW_DASHBOARD': 'PROGRESS.DASHBOARD.READ',   // Shorthand variant

    // ─── Global / Project ────────────────────────────────────────────────────
    'VIEW PROJECTS': 'VIEW_PROJECTS',              // Space variant
    'EDIT PROJECT': 'PROJECT.PROPERTIES.UPDATE',    // Space variant
    'MANAGE EPS': 'EPS.NODE.READ',                 // Space variant
    'VIEW TEAM': 'PROJECT.TEAM.READ',              // Space variant
    'MANAGE TEAM': 'PROJECT.TEAM.MANAGE',          // Space variant

    // ─── Typos ───────────────────────────────────────────────────────────────
    'MICOR.ACTIVITY.READ': 'MICRO.ACTIVITY.READ',  // Identified database typo
    'MICOR.LOG.CREATE': 'MICRO.LOG.CREATE',        // Identified database typo
};

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-GENERATED DEPENDENCY MAP
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Builds the permission dependency map automatically from conventions:
 *
 *  Rule 1: ALL module permissions imply VIEW_PROJECTS (you need project access)
 *  Rule 2: CREATE/UPDATE/DELETE/IMPORT implies the same entity's READ
 *  Rule 3: SPECIAL (Manage/Approve) implies the same entity's READ
 *  Rule 4: EPS mutations imply MANAGE_EPS
 *  Rule 5: USER.MANAGEMENT.* implies MANAGE_USERS
 *  Rule 6: ROLE.MANAGEMENT.* implies MANAGE_ROLES
 *  Rule 7: All permissions imply VIEW_DASHBOARD
 */
export function buildDependencyMap(
    permissions: PermissionDef[],
): Record<string, string[]> {
    const map: Record<string, string[]> = {};
    const codeSet = new Set(permissions.map((p) => p.code));

    for (const p of permissions) {
        // Skip the system-level codes themselves (they don't depend on anything)
        if (['VIEW_DASHBOARD', 'VIEW_PROJECTS', 'MANAGE_USERS', 'MANAGE_ROLES', 'MANAGE_EPS'].includes(p.code)) {
            continue;
        }

        const implied: string[] = [];
        const parts = p.code.split('.');

        // Rule 1: All non-system permissions imply VIEW_PROJECTS
        if (p.scope !== PermissionScope.SYSTEM || p.code.startsWith('USER.') || p.code.startsWith('ROLE.')) {
            implied.push('VIEW_PROJECTS');
        }

        // Rule 7: All permissions imply VIEW_DASHBOARD
        implied.push('VIEW_DASHBOARD');

        // Rule 2 & 3: Mutating actions imply READ of same entity
        if (p.action !== PermissionAction.READ && parts.length >= 2) {
            // Try MODULE.ENTITY.READ (3-part)
            if (parts.length === 3) {
                const readCode = `${parts[0]}.${parts[1]}.READ`;
                if (codeSet.has(readCode)) implied.push(readCode);
            }
            // Try MODULE.READ (2-part, e.g., SCHEDULE.READ)
            if (parts.length === 2) {
                const readCode = `${parts[0]}.READ`;
                if (codeSet.has(readCode) && readCode !== p.code) implied.push(readCode);
            }
        }

        // Rule 4: EPS mutations imply MANAGE_EPS
        if (p.module === 'EPS' && p.action !== PermissionAction.READ) {
            implied.push('MANAGE_EPS');
        }

        // Rule 5 & 6: User/Role management implies legacy system permissions
        if (p.code.startsWith('USER.MANAGEMENT.')) {
            implied.push('MANAGE_USERS');
        }
        if (p.code.startsWith('ROLE.MANAGEMENT.')) {
            implied.push('MANAGE_ROLES');
        }

        if (implied.length > 0) {
            map[p.code] = [...new Set(implied)];
        }
    }

    return map;
}

/** Pre-built dependency map from all registered permissions */
export const PERMISSION_DEPENDENCIES = buildDependencyMap(ALL_PERMISSIONS);

/**
 * Recursively resolves all permissions including implied dependencies.
 * This is the core expansion function used during JWT token generation.
 */
export function expandPermissions(directPermissions: string[]): string[] {
    const expanded = new Set<string>(directPermissions);

    let changed = true;
    while (changed) {
        changed = false;
        const currentSize = expanded.size;

        for (const p of expanded) {
            const implied = PERMISSION_DEPENDENCIES[p];
            if (implied) {
                implied.forEach((dep) => expanded.add(dep));
            }
        }

        if (expanded.size > currentSize) {
            changed = true;
        }
    }

    return Array.from(expanded);
}
