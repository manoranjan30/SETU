/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  PERMISSION PRESETS — ROLE ASSIGNMENT BUNDLES                          ║
 * ║                                                                        ║
 * ║  Each preset is a named bundle of permissions that maps to a real      ║
 * ║  job function. Presets are stackable and idempotent — applying two     ║
 * ║  presets that share permissions results in no duplicates.              ║
 * ║                                                                        ║
 * ║  Tier Conventions:                                                     ║
 * ║    1 = Read-Only (Viewer)                                              ║
 * ║    2 = Contributor (Create + Update, no Delete/Approve)                ║
 * ║    3 = Full Control (CRUD + Approvals + Management)                    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

export interface PermissionPreset {
  /** Unique machine-readable ID, e.g. 'PROGRESS_ENTRY_OPERATOR' */
  id: string;
  /** Display name shown in the UI */
  name: string;
  /** What this person can do — shown as subtitle in UI */
  description: string;
  /** Grouping label for UI organisation */
  group: PresetGroup;
  /** Tier 1=Viewer, 2=Contributor, 3=Full Control */
  tier: 1 | 2 | 3;
  /** Icon identifier for the UI (maps to Lucide icon name) */
  icon: string;
  /** Flat list of permission codes this preset grants */
  permissions: string[];
}

export interface CompositeRoleTemplate {
  /** Unique machine-readable ID */
  id: string;
  /** Display name */
  name: string;
  /** Description of the role */
  description: string;
  /** Icon identifier */
  icon: string;
  /** Ordered list of preset IDs that compose this role */
  presetIds: string[];
}

export type PresetGroup =
  | 'Project Execution'
  | 'Planning & Scheduling'
  | 'BOQ & Cost'
  | 'Quality (QA/QC)'
  | 'Safety (EHS)'
  | 'Design & Drawings'
  | 'Labor Management'
  | 'Administration';

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP A — PROJECT EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════

const PROGRESS_VIEWER: PermissionPreset = {
  id: 'PROGRESS_VIEWER',
  name: 'Progress Viewer',
  description:
    'Read-only view of site progress, schedules, and project data. Cannot enter or change anything.',
  group: 'Project Execution',
  tier: 1,
  icon: 'Eye',
  permissions: [
    'EPS.NODE.READ',
    'WBS.NODE.READ',
    'WBS.ACTIVITY.READ',
    'SCHEDULE.READ',
    'SCHEDULE.VERSION.READ',
    'SCHEDULE.CALENDAR.READ',
    'BOQ.ITEM.READ',
    'PLANNING.MATRIX.READ',
    'PLANNING.ANALYSIS.READ',
    'EXECUTION.ENTRY.READ',
    'MICRO.SCHEDULE.READ',
    'MICRO.ACTIVITY.READ',
    'PROGRESS.DASHBOARD.READ',
    'DASHBOARD.SUMMARY.READ',
    'DASHBOARD.ALERTS.READ',
    'PROJECT.TEAM.READ',
  ],
};

const PROGRESS_ENTRY_OPERATOR: PermissionPreset = {
  id: 'PROGRESS_ENTRY_OPERATOR',
  name: 'Progress Entry Operator',
  description:
    'Can view the activity list and submit daily site progress entries and micro-schedule logs.',
  group: 'Project Execution',
  tier: 2,
  icon: 'ClipboardCheck',
  permissions: [
    ...PROGRESS_VIEWER.permissions,
    'EXECUTION.ENTRY.CREATE',
    'EXECUTION.ENTRY.UPDATE',
    'EXECUTION.MICRO.CREATE',
    'MICRO.LOG.CREATE',
    'MICRO.LOG.UPDATE',
  ],
};

const PROGRESS_APPROVER: PermissionPreset = {
  id: 'PROGRESS_APPROVER',
  name: 'Progress Approver',
  description:
    'Can approve or reject site progress submissions. Includes all entry operator permissions.',
  group: 'Project Execution',
  tier: 3,
  icon: 'BadgeCheck',
  permissions: [
    ...PROGRESS_ENTRY_OPERATOR.permissions,
    'EXECUTION.ENTRY.DELETE',
    'EXECUTION.ENTRY.APPROVE',
    'MICRO.SCHEDULE.APPROVE',
    'MICRO.LOG.DELETE',
    'DASHBOARD.EXECUTIVE.READ',
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP B — PLANNING & SCHEDULING
// ═══════════════════════════════════════════════════════════════════════════════

const SCHEDULE_VIEWER: PermissionPreset = {
  id: 'SCHEDULE_VIEWER',
  name: 'Schedule Viewer',
  description:
    'Read-only access to Gantt charts, baselines, calendars, and distribution matrix.',
  group: 'Planning & Scheduling',
  tier: 1,
  icon: 'CalendarDays',
  permissions: [
    'EPS.NODE.READ',
    'WBS.NODE.READ',
    'WBS.ACTIVITY.READ',
    'SCHEDULE.READ',
    'SCHEDULE.VERSION.READ',
    'SCHEDULE.CALENDAR.READ',
    'PLANNING.MATRIX.READ',
    'PLANNING.ANALYSIS.READ',
    'PROGRESS.DASHBOARD.READ',
    'DASHBOARD.SUMMARY.READ',
    'DASHBOARD.ANALYTICS.READ',
    'DASHBOARD.ALERTS.READ',
    'PROJECT.TEAM.READ',
  ],
};

const SCHEDULE_PLANNER: PermissionPreset = {
  id: 'SCHEDULE_PLANNER',
  name: 'Schedule Planner',
  description:
    'Can build and update WBS structures, import schedules, create micro-schedules, and create look-ahead plans.',
  group: 'Planning & Scheduling',
  tier: 2,
  icon: 'GanttChart',
  permissions: [
    ...SCHEDULE_VIEWER.permissions,
    'WBS.NODE.CREATE',
    'WBS.NODE.UPDATE',
    'WBS.ACTIVITY.CREATE',
    'WBS.ACTIVITY.UPDATE',
    'WBS.TEMPLATE.READ',
    'WBS.TEMPLATE.APPLY',
    'SCHEDULE.UPDATE',
    'SCHEDULE.IMPORT',
    'SCHEDULE.VERSION.CREATE',
    'SCHEDULE.CALENDAR.CREATE',
    'SCHEDULE.CALENDAR.UPDATE',
    'PLANNING.MATRIX.UPDATE',
    'PLANNING.LOOKAHEAD.CREATE',
    'MICRO.SCHEDULE.CREATE',
    'MICRO.SCHEDULE.UPDATE',
    'MICRO.SCHEDULE.SUBMIT',
    'MICRO.ACTIVITY.CREATE',
    'MICRO.ACTIVITY.UPDATE',
    'MICRO.ACTIVITY.READ',
    'MICRO.SCHEDULE.READ',
  ],
};

const SCHEDULE_ADMIN: PermissionPreset = {
  id: 'SCHEDULE_ADMIN',
  name: 'Schedule Admin',
  description:
    'Full schedule control — can delete WBS nodes, manage template library, create recovery plans, and activate micro-schedules.',
  group: 'Planning & Scheduling',
  tier: 3,
  icon: 'Settings2',
  permissions: [
    ...SCHEDULE_PLANNER.permissions,
    'WBS.NODE.DELETE',
    'WBS.NODE.IMPORT',
    'WBS.ACTIVITY.DELETE',
    'WBS.TEMPLATE.MANAGE',
    'SCHEDULE.CALENDAR.DELETE',
    'MICRO.SCHEDULE.DELETE',
    'MICRO.SCHEDULE.MANAGE',
    'MICRO.ACTIVITY.DELETE',
    'PLANNING.RECOVERY.MANAGE',
    'DASHBOARD.EXECUTIVE.READ',
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP C — BOQ & COST
// ═══════════════════════════════════════════════════════════════════════════════

const BOQ_VIEWER: PermissionPreset = {
  id: 'BOQ_VIEWER',
  name: 'BOQ Viewer',
  description:
    'Read-only access to Bill of Quantities, work orders, and cost data.',
  group: 'BOQ & Cost',
  tier: 1,
  icon: 'FileSpreadsheet',
  permissions: [
    'EPS.NODE.READ',
    'BOQ.ITEM.READ',
    'WORKORDER.ORDER.READ',
    'WORKORDER.VENDOR.READ',
    'WORKORDER.MAPPING.READ',
    'DASHBOARD.ANALYTICS.READ',
    'PROJECT.TEAM.READ',
  ],
};

const BOQ_CONTRIBUTOR: PermissionPreset = {
  id: 'BOQ_CONTRIBUTOR',
  name: 'BOQ Contributor',
  description:
    'Can create and update BOQ items, manage measurements, import data, and link work orders.',
  group: 'BOQ & Cost',
  tier: 2,
  icon: 'ClipboardList',
  permissions: [
    ...BOQ_VIEWER.permissions,
    'BOQ.ITEM.CREATE',
    'BOQ.ITEM.UPDATE',
    'BOQ.MEASUREMENT.MANAGE',
    'BOQ.MEASUREMENT.IMPORT',
    'BOQ.PROGRESS.CREATE',
    'WORKORDER.ORDER.CREATE',
    'WORKORDER.ORDER.IMPORT',
    'WORKORDER.MAPPING.MANAGE',
    'WORKORDER.VENDOR.CREATE',
    'WORKORDER.VENDOR.UPDATE',
  ],
};

const BOQ_ADMIN: PermissionPreset = {
  id: 'BOQ_ADMIN',
  name: 'BOQ Admin',
  description:
    'Full BOQ control — can delete items, bulk import, and manage vendor work order templates.',
  group: 'BOQ & Cost',
  tier: 3,
  icon: 'Database',
  permissions: [
    ...BOQ_CONTRIBUTOR.permissions,
    'BOQ.ITEM.DELETE',
    'BOQ.ITEM.IMPORT',
    'WORKORDER.VENDOR.DELETE',
    'WORKORDER.ORDER.DELETE',
    'WORKORDER.TEMPLATE.MANAGE',
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP D — QUALITY (QA/QC)
// ═══════════════════════════════════════════════════════════════════════════════

const QUALITY_VIEWER: PermissionPreset = {
  id: 'QUALITY_VIEWER',
  name: 'Quality Viewer',
  description:
    'Read-only view of QC records, checklists, inspection status, NCRs, and snags.',
  group: 'Quality (QA/QC)',
  tier: 1,
  icon: 'ClipboardCheck',
  permissions: [
    'QUALITY.DASHBOARD.READ',
    'QUALITY.CHECKLIST.READ',
    'QUALITY.ACTIVITYLIST.READ',
    'QUALITY.ACTIVITY.READ',
    'QUALITY.SEQUENCE.READ',
    'QUALITY.INSPECTION.READ',
    'QUALITY.NCR.READ',
    'QUALITY.SNAG.READ',
    'QUALITY.TEST.READ',
    'QUALITY.AUDIT.READ',
    'QUALITY.DOCUMENT.READ',
    'EPS.NODE.READ',
    'PROJECT.TEAM.READ',
  ],
};

const QC_FIELD_INSPECTOR: PermissionPreset = {
  id: 'QC_FIELD_INSPECTOR',
  name: 'QC Field Inspector',
  description:
    'Can raise RFIs, log NCRs and snags, perform material tests. Ideal for QC engineers on site.',
  group: 'Quality (QA/QC)',
  tier: 2,
  icon: 'Search',
  permissions: [
    ...QUALITY_VIEWER.permissions,
    'QUALITY.INSPECTION.RAISE',
    'QUALITY.NCR.CREATE',
    'QUALITY.NCR.UPDATE',
    'QUALITY.SNAG.CREATE',
    'QUALITY.SNAG.UPDATE',
    'QUALITY.TEST.CREATE',
    'QUALITY.TEST.UPDATE',
  ],
};

const QC_MANAGER: PermissionPreset = {
  id: 'QC_MANAGER',
  name: 'QC Manager',
  description:
    'Full QC control — manages checklists, activity lists, sequence graphs, approves inspections.',
  group: 'Quality (QA/QC)',
  tier: 3,
  icon: 'ShieldCheck',
  permissions: [
    ...QC_FIELD_INSPECTOR.permissions,
    'QUALITY.CHECKLIST.CREATE',
    'QUALITY.CHECKLIST.UPDATE',
    'QUALITY.CHECKLIST.DELETE',
    'QUALITY.ACTIVITYLIST.CREATE',
    'QUALITY.ACTIVITYLIST.UPDATE',
    'QUALITY.ACTIVITYLIST.DELETE',
    'QUALITY.ACTIVITYLIST.MANAGE',
    'QUALITY.ACTIVITY.CREATE',
    'QUALITY.ACTIVITY.UPDATE',
    'QUALITY.ACTIVITY.DELETE',
    'QUALITY.SEQUENCE.UPDATE',
    'QUALITY.INSPECTION.APPROVE',
    'QUALITY.NCR.DELETE',
    'QUALITY.SNAG.DELETE',
    'QUALITY.TEST.DELETE',
    'QUALITY.AUDIT.CREATE',
    'QUALITY.AUDIT.UPDATE',
    'QUALITY.AUDIT.DELETE',
    'QUALITY.DOCUMENT.MANAGE',
    'QUALITY.STRUCTURE.MANAGE',
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP E — SAFETY (EHS)
// ═══════════════════════════════════════════════════════════════════════════════

const EHS_VIEWER: PermissionPreset = {
  id: 'EHS_VIEWER',
  name: 'EHS Viewer',
  description:
    'Read-only view of all safety records, incidents, inspections, trainings, and manhour data.',
  group: 'Safety (EHS)',
  tier: 1,
  icon: 'ShieldAlert',
  permissions: [
    'EHS.DASHBOARD.READ',
    'EHS.OBSERVATION.READ',
    'EHS.INCIDENT.READ',
    'EHS.INSPECTION.READ',
    'EHS.TRAINING.READ',
    'EHS.MANHOUR.READ',
    'EHS.ENVIRONMENTAL.READ',
    'EHS.LEGAL.READ',
    'EPS.NODE.READ',
    'PROJECT.TEAM.READ',
  ],
};

const EHS_FIELD_OFFICER: PermissionPreset = {
  id: 'EHS_FIELD_OFFICER',
  name: 'EHS Field Officer',
  description:
    'Can log safety observations, incidents, manhours, training records, and environmental data on site.',
  group: 'Safety (EHS)',
  tier: 2,
  icon: 'HardHat',
  permissions: [
    ...EHS_VIEWER.permissions,
    'EHS.OBSERVATION.CREATE',
    'EHS.OBSERVATION.UPDATE',
    'EHS.INCIDENT.CREATE',
    'EHS.INSPECTION.CREATE',
    'EHS.INSPECTION.UPDATE',
    'EHS.TRAINING.CREATE',
    'EHS.MANHOUR.CREATE',
    'EHS.ENVIRONMENTAL.CREATE',
  ],
};

const EHS_MANAGER: PermissionPreset = {
  id: 'EHS_MANAGER',
  name: 'EHS Manager',
  description:
    'Full EHS control — manages all records, legal compliance, machinery, vehicles, and incident register.',
  group: 'Safety (EHS)',
  tier: 3,
  icon: 'ShieldCheck',
  permissions: [
    ...EHS_FIELD_OFFICER.permissions,
    'EHS.OBSERVATION.DELETE',
    'EHS.INCIDENT.DELETE',
    'EHS.INSPECTION.DELETE',
    'EHS.TRAINING.DELETE',
    'EHS.LEGAL.MANAGE',
    'EHS.MACHINERY.MANAGE',
    'EHS.PERFORMANCE.MANAGE',
    'EHS.COMPETENCY.MANAGE',
    'EHS.VEHICLE.MANAGE',
    'EHS.INCIDENTREGISTER.MANAGE',
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP F — DESIGN & DRAWINGS
// ═══════════════════════════════════════════════════════════════════════════════

const DRAWINGS_VIEWER: PermissionPreset = {
  id: 'DRAWINGS_VIEWER',
  name: 'Drawings Viewer',
  description: 'Can browse and download drawings and their revision history.',
  group: 'Design & Drawings',
  tier: 1,
  icon: 'FileImage',
  permissions: [
    'DESIGN.CATEGORY.READ',
    'DESIGN.DRAWING.READ',
    'EPS.NODE.READ',
    'PROJECT.TEAM.READ',
  ],
};

const DRAWINGS_CONTRIBUTOR: PermissionPreset = {
  id: 'DRAWINGS_CONTRIBUTOR',
  name: 'Drawings Contributor',
  description:
    'Can register new drawings, upload revisions, and update drawing metadata.',
  group: 'Design & Drawings',
  tier: 2,
  icon: 'Upload',
  permissions: [
    ...DRAWINGS_VIEWER.permissions,
    'DESIGN.CATEGORY.CREATE',
    'DESIGN.DRAWING.CREATE',
    'DESIGN.DRAWING.UPLOAD',
    'DESIGN.DRAWING.UPDATE',
  ],
};

const DRAWINGS_ADMIN: PermissionPreset = {
  id: 'DRAWINGS_ADMIN',
  name: 'Drawings Admin',
  description:
    'Full drawings control — can approve GFC drawings and delete entries.',
  group: 'Design & Drawings',
  tier: 3,
  icon: 'Stamp',
  permissions: [
    ...DRAWINGS_CONTRIBUTOR.permissions,
    'DESIGN.DRAWING.DELETE',
    'DESIGN.DRAWING.APPROVE',
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP G — LABOR MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

const LABOR_ENTRY_OPERATOR: PermissionPreset = {
  id: 'LABOR_ENTRY_OPERATOR',
  name: 'Labor Entry Operator',
  description:
    'Can log daily attendance headcount and link labor to activities.',
  group: 'Labor Management',
  tier: 2,
  icon: 'Users',
  permissions: [
    'LABOR.CATEGORY.READ',
    'LABOR.ENTRY.READ',
    'LABOR.ENTRY.CREATE',
    'LABOR.MAPPING.MANAGE',
    'EPS.NODE.READ',
    'PROJECT.TEAM.READ',
  ],
};

const LABOR_ADMIN: PermissionPreset = {
  id: 'LABOR_ADMIN',
  name: 'Labor Admin',
  description:
    'Full labor management — creates labor categories and can import bulk manpower data.',
  group: 'Labor Management',
  tier: 3,
  icon: 'UserCog',
  permissions: [
    ...LABOR_ENTRY_OPERATOR.permissions,
    'LABOR.CATEGORY.MANAGE',
    'LABOR.ENTRY.IMPORT',
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP H — ADMINISTRATION
// ═══════════════════════════════════════════════════════════════════════════════

const USER_ADMIN: PermissionPreset = {
  id: 'USER_ADMIN',
  name: 'User & Role Admin',
  description:
    'Can create and manage users, assign roles, and view system audit logs.',
  group: 'Administration',
  tier: 3,
  icon: 'UserShield',
  permissions: [
    'USER.MANAGEMENT.READ',
    'USER.MANAGEMENT.CREATE',
    'USER.MANAGEMENT.UPDATE',
    'USER.MANAGEMENT.DELETE',
    'ROLE.MANAGEMENT.READ',
    'ROLE.MANAGEMENT.CREATE',
    'ROLE.MANAGEMENT.UPDATE',
    'ROLE.MANAGEMENT.DELETE',
    'AUDIT.LOG.READ',
    'ADMIN.SETTINGS.MANAGE',
  ],
};

const RESOURCE_ADMIN: PermissionPreset = {
  id: 'RESOURCE_ADMIN',
  name: 'Resource & Template Admin',
  description:
    'Can manage resource master data, templates, and checklist builder.',
  group: 'Administration',
  tier: 3,
  icon: 'Package',
  permissions: [
    'RESOURCE.MASTER.READ',
    'RESOURCE.MASTER.CREATE',
    'RESOURCE.MASTER.UPDATE',
    'RESOURCE.MASTER.DELETE',
    'RESOURCE.MASTER.IMPORT',
    'RESOURCE.TEMPLATE.MANAGE',
    'TEMPLATE.BUILDER.READ',
    'TEMPLATE.BUILDER.CREATE',
    'TEMPLATE.BUILDER.UPDATE',
    'TEMPLATE.BUILDER.DELETE',
    'TEMPLATE.BUILDER.IMPORT',
    'WBS.TEMPLATE.READ',
    'WBS.TEMPLATE.MANAGE',
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// ALL ATOMIC PRESETS — Exported flat list
// ═══════════════════════════════════════════════════════════════════════════════

export const ALL_PERMISSION_PRESETS: PermissionPreset[] = [
  // Project Execution
  PROGRESS_VIEWER,
  PROGRESS_ENTRY_OPERATOR,
  PROGRESS_APPROVER,
  // Planning & Scheduling
  SCHEDULE_VIEWER,
  SCHEDULE_PLANNER,
  SCHEDULE_ADMIN,
  // BOQ & Cost
  BOQ_VIEWER,
  BOQ_CONTRIBUTOR,
  BOQ_ADMIN,
  // Quality
  QUALITY_VIEWER,
  QC_FIELD_INSPECTOR,
  QC_MANAGER,
  // EHS Safety
  EHS_VIEWER,
  EHS_FIELD_OFFICER,
  EHS_MANAGER,
  // Design
  DRAWINGS_VIEWER,
  DRAWINGS_CONTRIBUTOR,
  DRAWINGS_ADMIN,
  // Labor
  LABOR_ENTRY_OPERATOR,
  LABOR_ADMIN,
  // Administration
  USER_ADMIN,
  RESOURCE_ADMIN,
];

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSITE ROLE TEMPLATES — Pre-stacked bundles for common roles
// ═══════════════════════════════════════════════════════════════════════════════

export const COMPOSITE_ROLE_TEMPLATES: CompositeRoleTemplate[] = [
  {
    id: 'SITE_ENGINEER',
    name: 'Site Engineer',
    description:
      'Field team: enters daily progress, logs manpower, raises safety and QC items. Access to all read views.',
    icon: 'HardHat',
    presetIds: [
      'PROGRESS_ENTRY_OPERATOR',
      'LABOR_ENTRY_OPERATOR',
      'EHS_FIELD_OFFICER',
      'QC_FIELD_INSPECTOR',
      'DRAWINGS_VIEWER',
    ],
  },
  {
    id: 'PLANNING_ENGINEER',
    name: 'Planning Engineer',
    description:
      'Builds and maintains schedules, distributes BOQ, creates micro-schedules and look-ahead plans.',
    icon: 'GanttChart',
    presetIds: [
      'SCHEDULE_PLANNER',
      'BOQ_VIEWER',
      'QUALITY_VIEWER',
      'DRAWINGS_VIEWER',
    ],
  },
  {
    id: 'PROJECT_MANAGER',
    name: 'Project Manager',
    description:
      'Reviews all data, approves progress, oversees quality, safety, drawings, and labor.',
    icon: 'Briefcase',
    presetIds: [
      'PROGRESS_APPROVER',
      'SCHEDULE_PLANNER',
      'BOQ_CONTRIBUTOR',
      'QC_MANAGER',
      'EHS_MANAGER',
      'DRAWINGS_ADMIN',
      'LABOR_ADMIN',
    ],
  },
  {
    id: 'QUANTITY_SURVEYOR',
    name: 'Quantity Surveyor',
    description:
      'Manages BOQ items, measurements, subcontractor work orders, and cost tracking.',
    icon: 'Calculator',
    presetIds: ['BOQ_ADMIN', 'SCHEDULE_VIEWER', 'PROGRESS_VIEWER'],
  },
  {
    id: 'QC_ENGINEER',
    name: 'QA/QC Engineer',
    description:
      'Manages quality checklists, activity lists, raises and approves RFIs, logs material tests.',
    icon: 'Microscope',
    presetIds: ['QC_MANAGER', 'DRAWINGS_VIEWER', 'SCHEDULE_VIEWER'],
  },
  {
    id: 'SAFETY_OFFICER',
    name: 'Safety Officer',
    description:
      'Full EHS management — logs all safety observations, incidents, manhours, and legal compliance.',
    icon: 'ShieldAlert',
    presetIds: ['EHS_MANAGER', 'LABOR_ENTRY_OPERATOR', 'PROGRESS_VIEWER'],
  },
  {
    id: 'CLIENT_AUDITOR',
    name: 'Client / External Auditor',
    description:
      'Read-only access across all modules. Cannot enter or change any data.',
    icon: 'Eye',
    presetIds: [
      'PROGRESS_VIEWER',
      'BOQ_VIEWER',
      'QUALITY_VIEWER',
      'EHS_VIEWER',
      'DRAWINGS_VIEWER',
      'SCHEDULE_VIEWER',
    ],
  },
  {
    id: 'SYSTEM_ADMIN',
    name: 'System Administrator',
    description:
      'Full system administration — manages users, roles, resources, and templates. Has all permissions.',
    icon: 'Terminal',
    presetIds: ['USER_ADMIN', 'RESOURCE_ADMIN', 'SCHEDULE_ADMIN', 'BOQ_ADMIN'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Resolve a list of preset IDs into a deduplicated flat array of permission codes */
export function resolvePresetPermissions(presetIds: string[]): string[] {
  const presetMap = new Map(ALL_PERMISSION_PRESETS.map((p) => [p.id, p]));
  const codes = new Set<string>();

  for (const id of presetIds) {
    const preset = presetMap.get(id);
    if (preset) {
      preset.permissions.forEach((code) => codes.add(code));
    }
  }

  return Array.from(codes);
}

/** Get a preset by ID */
export function getPreset(id: string): PermissionPreset | undefined {
  return ALL_PERMISSION_PRESETS.find((p) => p.id === id);
}

/** Get a composite template by ID */
export function getRoleTemplate(id: string): CompositeRoleTemplate | undefined {
  return COMPOSITE_ROLE_TEMPLATES.find((t) => t.id === id);
}

/** Get all presets grouped by their group field */
export function getPresetsGrouped(): Record<string, PermissionPreset[]> {
  return ALL_PERMISSION_PRESETS.reduce(
    (acc, preset) => {
      if (!acc[preset.group]) acc[preset.group] = [];
      acc[preset.group].push(preset);
      return acc;
    },
    {} as Record<string, PermissionPreset[]>,
  );
}
