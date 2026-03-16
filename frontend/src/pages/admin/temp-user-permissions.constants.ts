export const TEMP_USER_ASSIGNABLE_PERMISSIONS = {
  ACCESS: [
    { key: "EPS.NODE.READ", label: "See Assigned Projects" },
  ],
  QUALITY: [
    { key: "QUALITY.DASHBOARD.READ", label: "Open Quality Workspace" },
    { key: "QUALITY.ACTIVITYLIST.READ", label: "View Activity Lists" },
    { key: "QUALITY.ACTIVITY.READ", label: "View Activity Details" },
    { key: "QUALITY.INSPECTION.RAISE", label: "Raise RFI" },
    { key: "QUALITY.INSPECTION.READ", label: "View RFIs" },
    { key: "QUALITY.INSPECTION.APPROVE", label: "Approve RFI via Release Strategy" },
    { key: "QUALITY.OBSERVATION.RESOLVE", label: "Submit QC Rectification" },
    { key: "QUALITY.SITE_OBS.READ", label: "View Observations" },
    { key: "QUALITY.SITE_OBS.RECTIFY", label: "Submit Rectification" },
    { key: "QUALITY.DOCUMENT.MANAGE", label: "Upload Evidence Photos" },
    { key: "QUALITY.CHECKLIST.CREATE", label: "Fill Checklists" },
  ],
  PROGRESS: [
    { key: "EXECUTION.ENTRY.READ", label: "View Progress Workspace" },
    { key: "EXECUTION.ENTRY.CREATE", label: "Submit Progress Entry" },
    { key: "EXECUTION.MICRO.CREATE", label: "Submit Micro Progress" },
    { key: "PROGRESS.DASHBOARD.READ", label: "View Progress Dashboard" },
  ],
  SNAG: [
    { key: "QUALITY.SNAG.READ", label: "View Snag List" },
    { key: "QUALITY.SNAG.UPDATE", label: "Respond to Snag Items" },
  ],
};
