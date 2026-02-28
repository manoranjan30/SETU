import { PermissionCode, type Permission } from './permissions';
import { Home, Settings, Database, ClipboardList, ExternalLink } from 'lucide-react';

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
        label: 'Dashboard',
        path: '/dashboard',
        icon: Home,
        permission: PermissionCode.VIEW_DASHBOARD
    },
    {
        label: 'Projects',
        path: '/dashboard/eps',
        icon: Database
    },
    {
        label: 'Site Execution',
        path: '/dashboard/execution',
        icon: ClipboardList,
        // No permission here - let the children or page decide access, or use a basic read permission
        permission: PermissionCode.EXECUTION_READ
    },
    {
        label: 'Admin',
        path: '/dashboard/admin', // Dummy parent path
        icon: Settings,
        // REMOVED PARENT PERMISSION to allow access if ANY child is visible
        children: [
            {
                label: 'User Management',
                path: '/dashboard/users',
                permission: PermissionCode.USER_READ
            },
            {
                label: 'Role Management',
                path: '/dashboard/roles',
                permission: PermissionCode.ROLE_READ
            },
            {
                label: 'System Permissions',
                path: '/dashboard/permissions',
                permission: PermissionCode.ROLE_UPDATE // Viewing permissions usually requires role management rights
            },
            {
                label: 'System Logs',
                path: '/dashboard/admin/logs',
                permission: PermissionCode.AUDIT_READ
            },
            {
                label: 'Vendor Access Templates',
                path: '/dashboard/admin/vendor-access-templates',
                permission: PermissionCode.TEMP_ROLE_VIEW
            }
        ]
    },
    {
        label: 'External Tools',
        path: '/tools', // Dummy path
        icon: ExternalLink,
        children: [
            {
                label: 'PDF Table Extractor',
                path: 'http://localhost:8001',
                external: true
            }
        ]
    }
];
