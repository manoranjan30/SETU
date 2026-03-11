export type ThemeName =
  | "shadcn-admin"
  | "tailadmin"
  | "horizon-ui"
  | "berry-dashboard"
  | "mantis"
  | "setu-modern-pro";

export const themeNames: ThemeName[] = [
  "shadcn-admin",
  "tailadmin",
  "horizon-ui",
  "berry-dashboard",
  "mantis",
  "setu-modern-pro",
];

export const themeLabels: Record<ThemeName, string> = {
  "shadcn-admin": "Shadcn Admin (Default)",
  tailadmin: "TailAdmin",
  "horizon-ui": "Horizon UI",
  "berry-dashboard": "Berry Dashboard",
  mantis: "Mantis",
  "setu-modern-pro": "SETU Modern Pro",
};

export const chartPalettes: Record<ThemeName, string[]> = {
  "shadcn-admin": [
    "#2563eb",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#06b6d4",
    "#f97316",
    "#0ea5e9",
  ],
  tailadmin: [
    "#3c50e0",
    "#22c55e",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#06b6d4",
    "#14b8a6",
    "#f97316",
  ],
  "horizon-ui": [
    "#4318ff",
    "#2b3674",
    "#05cd99",
    "#f97316",
    "#ffb547",
    "#6ad2ff",
    "#a3aed0",
    "#e31a1a",
  ],
  "berry-dashboard": [
    "#5e35b1",
    "#1e88e5",
    "#43a047",
    "#fb8c00",
    "#e53935",
    "#8e24aa",
    "#00acc1",
    "#3949ab",
  ],
  mantis: [
    "#4caf50",
    "#2196f3",
    "#ffc107",
    "#ff5722",
    "#9c27b0",
    "#00bcd4",
    "#8bc34a",
    "#3f51b5",
  ],
  "setu-modern-pro": [
    "#3b82f6",
    "#8b5cf6",
    "#14b8a6",
    "#f59e0b",
    "#ef4444",
    "#06b6d4",
    "#22c55e",
    "#f97316",
  ],
};

const semanticBase = {
  valid: "#10b981",
  expired: "#ef4444",
  expiring: "#f59e0b",
  critical: "#ef4444",
  major: "#f97316",
  minor: "#f59e0b",
  nearMiss: "#22c55e",
  firstAid: "#3b82f6",
};

export const semanticChartColors: Record<ThemeName, Record<string, string>> = {
  "shadcn-admin": semanticBase,
  tailadmin: semanticBase,
  "horizon-ui": { ...semanticBase, firstAid: "#4318ff", nearMiss: "#05cd99" },
  "berry-dashboard": {
    ...semanticBase,
    firstAid: "#1e88e5",
    nearMiss: "#43a047",
  },
  mantis: { ...semanticBase, firstAid: "#2196f3", nearMiss: "#4caf50" },
  "setu-modern-pro": {
    ...semanticBase,
    firstAid: "#3b82f6",
    nearMiss: "#14b8a6",
    major: "#f97316",
  },
};
