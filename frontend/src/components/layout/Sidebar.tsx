import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { MENU_CONFIG, type MenuItem } from '../../config/menu';
import { LogOut, ChevronDown, ChevronRight, Database, Layers, Layout, Grid, Box, Users, ShieldAlert, ChevronLeft, CheckCircle, FileText, Clipboard, User } from 'lucide-react';

const SidebarItem = ({ item, depth = 0, isCollapsed }: { item: MenuItem; depth?: number; isCollapsed: boolean }) => {
    const location = useLocation();
    const { hasPermission } = useAuth();
    const [isOpen, setIsOpen] = useState(false);

    // 1. Check strict denial (if item has a permission and user doesn't have it)
    // BUT we relax this for parents with children -> we check that later
    const hasItemPermission = !item.permission || hasPermission(item.permission);

    // 2. Check children visibility - only show if not collapsed
    // Recursively check if children are visible based on THEIR permissions
    const visibleChildren = item.children?.filter(child =>
        !child.permission || hasPermission(child.permission)
    ) || [];

    const hasVisibleChildren = visibleChildren.length > 0;

    // 3. Final Visibility Decision
    if (item.children) {
        // If it's a parent/group, it is visible ONLY if it has visible children
        // regardless of its own permission (since we treat parents as containers)
        if (!hasVisibleChildren) return null;
    } else {
        // High-level check: access denied if permission exists and user lacks it
        if (!hasItemPermission) return null;
    }

    // Double check (redundant but safe)
    if (item.permission && !hasPermission(item.permission)) return null;

    const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
    const paddingLeft = isCollapsed ? 0 : (depth * 16 + 24); // Base padding 24px

    if (hasVisibleChildren) {
        // Render as Parent with Dropdown
        // Note: We use visibleChildren for rendering the dropdown content to ensure hidden children stay hidden
        return (
            <div>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`w-full flex items-center justify-between py-2 text-sm hover:text-blue-600 transition-colors ${isActive ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                    style={{ paddingLeft: `${paddingLeft}px`, paddingRight: isCollapsed ? '0' : '24px' }}
                >
                    <div className={`flex items-center ${isCollapsed ? 'justify-center w-full' : ''}`}>
                        {item.icon && <item.icon className={`w-4 h-4 ${isCollapsed ? '' : 'mr-3'}`} />}
                        {!isCollapsed && item.label}
                    </div>
                    {!isCollapsed && (isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
                </button>
                {isOpen && !isCollapsed && (
                    <div className="bg-gray-50 border-l-2 border-gray-100 ml-6">
                        {visibleChildren.map(child => (
                            <SidebarItem key={child.path} item={child} depth={depth + 1} isCollapsed={isCollapsed} />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    if (item.external) {
        return (
            <a
                href={item.path}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center py-2 text-sm hover:text-blue-600 transition-colors relative text-gray-700`}
                style={{ paddingLeft: `${paddingLeft}px`, paddingRight: isCollapsed ? '0' : '24px' }}
                title={isCollapsed ? item.label : ''}
            >
                <div className={`flex items-center ${isCollapsed ? 'justify-center w-full' : ''}`}>
                    {item.icon && <item.icon className={`w-4 h-4 ${isCollapsed ? '' : 'mr-3'}`} />}
                    {!isCollapsed && item.label}
                </div>
            </a>
        );
    }

    return (
        <Link
            to={item.path}
            className={`flex items-center py-2 text-sm hover:text-blue-600 transition-colors relative ${isActive ? 'bg-blue-50 text-blue-600 font-medium' + (isCollapsed ? '' : ' border-r-2 border-blue-600') : 'text-gray-700'}`}
            style={{ paddingLeft: `${paddingLeft}px`, paddingRight: isCollapsed ? '0' : '24px' }}
            title={isCollapsed ? item.label : ''}
        >
            <div className={`flex items-center ${isCollapsed ? 'justify-center w-full' : ''}`}>
                {item.icon && <item.icon className={`w-4 h-4 ${isCollapsed ? '' : 'mr-3'}`} />}
                {!isCollapsed && item.label}
            </div>
            {isCollapsed && isActive && (
                <div className="absolute left-0 w-1 h-8 bg-blue-600 rounded-r-full" />
            )}
        </Link>
    );
};

const Sidebar = () => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Extract project ID from path if present
    const match = location.pathname.match(/\/dashboard\/projects\/(\d+)/);
    const activeProjectId = match ? match[1] : null;

    return (
        <aside className={`${isCollapsed ? 'w-20' : 'w-64'} bg-white shadow-md flex flex-col h-full transition-all duration-300 relative`}>
            {/* Collapse Toggle Button */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute -right-3 top-10 bg-white border shadow-sm rounded-full p-1 hover:bg-gray-50 z-20 text-gray-400 hover:text-blue-600 transition-colors"
                title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
                {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            <div className={`p-6 border-b overflow-hidden ${isCollapsed ? 'flex justify-center' : ''}`}>
                <h1 className="text-2xl font-bold text-blue-600 flex items-center">
                    <ShieldIcon className="w-6 h-6 flex-shrink-0" />
                    {!isCollapsed && <span className="ml-2 whitespace-nowrap">SETU</span>}
                </h1>
                {!isCollapsed && (
                    <>
                        <p className="text-xs text-gray-500 mt-2 truncate">
                            Logged in as <span className="font-medium text-gray-700">{user?.username}</span>
                        </p>
                        {user?.roles?.includes('Admin') && (
                            <span className="inline-block mt-1 px-2 py-0.5 text-xs font-semibold text-white bg-red-500 rounded-full">
                                Admin
                            </span>
                        )}
                    </>
                )}
            </div>

            <nav className="flex-1 overflow-y-auto py-4 overflow-x-hidden">
                {MENU_CONFIG.map(item => (
                    <SidebarItem key={item.path} item={item} isCollapsed={isCollapsed} />
                ))}

                {/* Dynamic Project Modules */}
                {activeProjectId && (
                    <div className="mt-6">
                        {!isCollapsed ? (
                            <div className="px-6 py-2 text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Database className="w-3 h-3" />
                                Active Project
                            </div>
                        ) : (
                            <div className="border-t mx-4 my-2" />
                        )}
                        <div className="mt-1">
                            <SidebarItem
                                isCollapsed={isCollapsed}
                                item={{
                                    label: 'WBS Structure',
                                    path: `/dashboard/projects/${activeProjectId}/wbs`,
                                    icon: Layers,
                                    permission: 'WBS.NODE.READ'
                                }}
                            />
                            <SidebarItem
                                isCollapsed={isCollapsed}
                                item={{
                                    label: 'Bill of Quantities',
                                    path: `/dashboard/projects/${activeProjectId}/boq`,
                                    icon: Layout,
                                    permission: 'BOQ.ITEM.READ'
                                }}
                            />
                            <SidebarItem
                                isCollapsed={isCollapsed}
                                item={{
                                    label: 'Planning & Schedule',
                                    path: `/dashboard/projects/${activeProjectId}/planning`,
                                    icon: Grid,
                                    permission: 'PLANNING.MATRIX.READ'
                                }}
                            />
                            <SidebarItem
                                isCollapsed={isCollapsed}
                                item={{
                                    label: 'Progress',
                                    path: `/dashboard/projects/${activeProjectId}/progress`,
                                    icon: Box,
                                    permission: 'PROGRESS.DASHBOARD.READ'
                                }}
                            />
                            <SidebarItem
                                isCollapsed={isCollapsed}
                                item={{
                                    label: 'Manpower',
                                    path: `/dashboard/projects/${activeProjectId}/manpower`,
                                    icon: Users,
                                    permission: 'LABOR.ENTRY.READ'
                                }}
                            />
                            <SidebarItem
                                isCollapsed={isCollapsed}
                                item={{
                                    label: 'Site Safety (EHS)',
                                    path: `/dashboard/projects/${activeProjectId}/ehs`,
                                    icon: ShieldAlert,
                                    permission: 'EHS.DASHBOARD.READ'
                                }}
                            />
                            <SidebarItem
                                isCollapsed={isCollapsed}
                                item={{
                                    label: 'Quality Control',
                                    path: `/dashboard/projects/${activeProjectId}/quality`,
                                    icon: CheckCircle,
                                    permission: 'QUALITY.DASHBOARD.READ'
                                }}
                            />
                            <SidebarItem
                                isCollapsed={isCollapsed}
                                item={{
                                    label: 'Quality Requests',
                                    path: `/dashboard/projects/${activeProjectId}/quality/requests`,
                                    icon: ShieldAlert,
                                    permission: 'QUALITY.INSPECTION.READ'
                                }}
                            />
                            <SidebarItem
                                isCollapsed={isCollapsed}
                                item={{
                                    label: 'QA/QC Approvals',
                                    path: `/dashboard/projects/${activeProjectId}/quality/approvals`,
                                    icon: CheckCircle,
                                    permission: 'QUALITY.INSPECTION.APPROVE'
                                }}
                            />
                            <SidebarItem
                                isCollapsed={isCollapsed}
                                item={{
                                    label: 'Activity Lists',
                                    path: `/dashboard/projects/${activeProjectId}/quality/activity-lists`,
                                    icon: Clipboard,
                                    permission: 'QUALITY.ACTIVITYLIST.READ'
                                }}
                            />
                            <SidebarItem
                                isCollapsed={isCollapsed}
                                item={{
                                    label: 'Design (Drawings)',
                                    path: `/dashboard/projects/${activeProjectId}/design`,
                                    icon: FileText,
                                    permission: 'DESIGN.DRAWING.READ'
                                }}
                            />
                        </div>
                    </div>
                )}
            </nav>

            <div className={`p-4 border-t bg-gray-50 flex flex-col gap-2 ${isCollapsed ? 'items-center' : ''}`}>
                <Link
                    to="/dashboard/profile"
                    className={`flex items-center text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors ${isCollapsed ? 'p-2' : 'w-full px-4 py-2'}`}
                    title={isCollapsed ? "My Profile" : ""}
                >
                    <User className={`w-4 h-4 ${isCollapsed ? '' : 'mr-3'} text-gray-500`} />
                    {!isCollapsed && <span>My Profile</span>}
                </Link>
                <button
                    onClick={logout}
                    className={`flex items-center text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors ${isCollapsed ? 'p-2' : 'w-full px-4 py-2'}`}
                    title={isCollapsed ? "Logout" : ""}
                >
                    <LogOut className={`w-4 h-4 ${isCollapsed ? '' : 'mr-3'}`} />
                    {!isCollapsed && <span>Logout</span>}
                </button>
            </div>
        </aside>
    );
};

// Helper icon
const ShieldIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
);

export default Sidebar;
