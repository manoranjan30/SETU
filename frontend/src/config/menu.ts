import { PermissionCode, type Permission } from "./permissions";
import {
  Home,
  Settings,
  Database,
  ClipboardList,
  ExternalLink,
  Brain,
} from "lucide-react";

export interface MenuItem {
  label: string;
  path: string;
  icon?: any;
  permission?: Permission; // If undefined, visible to all (or authentication only)
  children?: MenuItem[];
  external?: boolean;
}

export const MENU_CONFIG: MenuItem[] = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: Home,
    permission: PermissionCode.VIEW_DASHBOARD,
  },
  {
    label: "Projects",
    path: "/dashboard/eps",
    icon: Database,
  },
  {
    label: "Site Execution",
    path: "/dashboard/execution",
    icon: ClipboardList,
    // No permission here - let the children or page decide access, or use a basic read permission
    permission: PermissionCode.EXECUTION_READ,
  },
  {
    label: "Admin",
    path: "/dashboard/admin", // Dummy parent path
    icon: Settings,
    // REMOVED PARENT PERMISSION to allow access if ANY child is visible
    children: [
      {
        label: "User Management",
        path: "/dashboard/users",
        permission: PermissionCode.USER_READ,
      },
      {
        label: "Role Management",
        path: "/dashboard/roles",
        permission: PermissionCode.ROLE_READ,
      },
      {
        label: "System Permissions",
        path: "/dashboard/permissions",
        permission: PermissionCode.ROLE_UPDATE, // Viewing permissions usually requires role management rights
      },
      {
        label: "System Logs",
        path: "/dashboard/admin/logs",
        permission: PermissionCode.AUDIT_READ,
      },
      {
        label: "Vendor Access Templates",
        path: "/dashboard/admin/vendor-access-templates",
        permission: PermissionCode.TEMP_ROLE_VIEW,
      },
      {
        label: "Dashboard Builder",
        path: "/dashboard/admin/dashboard-builder",
        permission: PermissionCode.ADMIN_DASHBOARD_READ,
      },
      {
        label: "Custom Reports",
        path: "/dashboard/admin/reports",
        permission: PermissionCode.ADMIN_REPORT_READ,
      },
      {
        label: "Plugins",
        path: "/dashboard/admin/plugins",
        permission: PermissionCode.PLUGIN_REGISTRY_READ,
      },
      {
        label: "Issue Tracker Departments",
        path: "/dashboard/admin/issue-tracker",
        permission: PermissionCode.MANAGE_USERS,
      },
    ],
  },
  {
    label: "AI Insights",
    path: "/dashboard/ai-insights",
    icon: Brain,
    permission: PermissionCode.AI_INSIGHTS_READ,
    children: [
      {
        label: "Analyse",
        path: "/dashboard/ai-insights",
        permission: PermissionCode.AI_INSIGHTS_READ,
      },
      {
        label: "AI Settings",
        path: "/dashboard/ai-insights/admin",
        permission: PermissionCode.AI_INSIGHTS_ADMIN,
      },
    ],
  },
  {
    label: "External Tools",
    path: "/tools", // Dummy path
    icon: ExternalLink,
    children: [
      {
        label: "PDF Table Extractor",
        path: "http://localhost:8001",
        external: true,
      },
    ],
  },
];
