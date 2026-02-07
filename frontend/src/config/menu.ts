import { PermissionCode, type Permission } from './permissions';
import { Home, Settings, Database, ClipboardList } from 'lucide-react';

export interface MenuItem {
    label: string;
    path: string;
    icon?: any;
    permission?: Permission; // If undefined, visible to all (or authentication only)
    children?: MenuItem[];
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
        icon: Database,
        permission: PermissionCode.VIEW_PROJECTS
    },
    {
        label: 'Admin',
        path: '/dashboard/admin', // Dummy parent path
        icon: Settings,
        permission: PermissionCode.MANAGE_USERS,
        children: [
            {
                label: 'Users',
                path: '/dashboard/users',
                permission: PermissionCode.MANAGE_USERS
            },
            {
                label: 'Roles',
                path: '/dashboard/roles',
                permission: PermissionCode.MANAGE_ROLES
            },
            {
                label: 'Permissions',
                path: '/dashboard/permissions',
                permission: PermissionCode.MANAGE_ROLES
            },
            {
                label: 'System Settings',
                path: '/dashboard/admin/settings',
                permission: PermissionCode.MANAGE_USERS
            }
        ]
    },
    {
        label: 'Site Execution',
        path: '/dashboard/execution',
        icon: ClipboardList,
        permission: PermissionCode.VIEW_PROJECTS // Reuse project permission for now
    }
];
