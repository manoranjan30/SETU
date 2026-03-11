export const TEMP_USER_ASSIGNABLE_PERMISSIONS = {
  QUALITY: [
    { key: "QUALITY.INSPECTION.RAISE", label: "Raise RFI" },
    { key: "QUALITY.INSPECTION.READ", label: "View RFIs" },
    { key: "QUALITY.SITE_OBS.READ", label: "View Observations" },
    { key: "QUALITY.SITE_OBS.RECTIFY", label: "Submit Rectification" },
    { key: "QUALITY.DOCUMENT.MANAGE", label: "Upload Evidence Photos" },
    { key: "QUALITY.CHECKLIST.CREATE", label: "Fill Checklists" },
  ],
  PROGRESS: [
    { key: "EXECUTION.ENTRY.CREATE", label: "Submit Progress Entry" },
    { key: "EXECUTION.MICRO.CREATE", label: "Submit Micro Progress" },
    { key: "PROGRESS.DASHBOARD.READ", label: "View Progress Dashboard" },
  ],
  SNAG: [
    { key: "QUALITY.SNAG.READ", label: "View Snag List" },
    { key: "QUALITY.SNAG.UPDATE", label: "Respond to Snag Items" },
  ],
};
