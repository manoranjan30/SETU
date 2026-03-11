import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { MENU_CONFIG, type MenuItem } from "../../config/menu";
import {
  Bell,
  Clock,
  AlertCircle,
  X,
  LogOut,
  ChevronDown,
  ChevronRight,
  Database,
  Layers,
  Layout,
  Grid,
  Box,
  Users,
  ShieldAlert,
  ChevronLeft,
  CheckCircle,
  FileText,
  User,
} from "lucide-react";
import {
  notificationService,
  type PendingTasksResponse,
} from "../../services/notification.service";
import { useEffect } from "react";
import { ThemePicker } from "../common/ThemePicker";

const SidebarItem = ({
  item,
  depth = 0,
  isCollapsed,
}: {
  item: MenuItem;
  depth?: number;
  isCollapsed: boolean;
}) => {
  const location = useLocation();
  const { hasPermission } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // 1. Check strict denial (if item has a permission and user doesn't have it)
  // BUT we relax this for parents with children -> we check that later
  const hasItemPermission = !item.permission || hasPermission(item.permission);

  // 2. Check children visibility - only show if not collapsed
  // Recursively check if children are visible based on THEIR permissions
  const visibleChildren =
    item.children?.filter(
      (child) => !child.permission || hasPermission(child.permission),
    ) || [];

  const hasVisibleChildren = visibleChildren.length > 0;

  // 3. Final Visibility Decision
  // If it's a parent/group, it is visible if it has ANY visible sub-item
  // OR if its own direct permission matches.
  if (item.children) {
    if (!hasVisibleChildren && !hasItemPermission) return null;
  } else {
    // If it's a leaf node, strict permission match is required
    if (!hasItemPermission) return null;
  }

  const isActive =
    location.pathname === item.path ||
    location.pathname.startsWith(item.path + "/");
  const paddingLeft = isCollapsed ? 0 : depth * 16 + 24; // Base padding 24px

  if (hasVisibleChildren) {
    // Render as Parent with Dropdown
    // Note: We use visibleChildren for rendering the dropdown content to ensure hidden children stay hidden
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`mx-2 my-0.5 w-[calc(100%-16px)] rounded-lg flex items-center justify-between py-2 text-sm hover:text-primary hover:bg-surface-raised/80 transition-colors ${isActive ? "text-primary font-semibold bg-primary-muted/70 ring-1 ring-primary/20" : "text-text-secondary"}`}
          style={{
            paddingLeft: `${paddingLeft}px`,
            paddingRight: isCollapsed ? "0" : "24px",
          }}
        >
          <div
            className={`flex items-center ${isCollapsed ? "justify-center w-full" : ""}`}
          >
            {item.icon && (
              <item.icon className={`w-4 h-4 ${isCollapsed ? "" : "mr-3"}`} />
            )}
            {!isCollapsed && item.label}
          </div>
          {!isCollapsed &&
            (isOpen ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            ))}
        </button>
        {isOpen && !isCollapsed && (
          <div className="bg-surface-base/70 border-l-2 border-border-subtle ml-8 rounded-l-lg py-1">
            {visibleChildren.map((child) => (
              <SidebarItem
                key={child.path}
                item={child}
                depth={depth + 1}
                isCollapsed={isCollapsed}
              />
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
        className={`mx-2 my-0.5 w-[calc(100%-16px)] rounded-lg flex items-center py-2 text-sm hover:text-primary hover:bg-surface-raised/80 transition-colors relative text-text-secondary`}
        style={{
          paddingLeft: `${paddingLeft}px`,
          paddingRight: isCollapsed ? "0" : "24px",
        }}
        title={isCollapsed ? item.label : ""}
      >
        <div
          className={`flex items-center ${isCollapsed ? "justify-center w-full" : ""}`}
        >
          {item.icon && (
            <item.icon className={`w-4 h-4 ${isCollapsed ? "" : "mr-3"}`} />
          )}
          {!isCollapsed && item.label}
        </div>
      </a>
    );
  }

  return (
    <Link
      to={item.path}
      className={`mx-2 my-0.5 w-[calc(100%-16px)] rounded-lg flex items-center py-2 text-sm hover:text-primary hover:bg-surface-raised/80 transition-colors relative ${isActive ? "bg-primary-muted/80 text-primary font-semibold shadow-sm ring-1 ring-primary/25" : "text-text-secondary"}`}
      style={{
        paddingLeft: `${paddingLeft}px`,
        paddingRight: isCollapsed ? "0" : "24px",
      }}
      title={isCollapsed ? item.label : ""}
    >
      <div
        className={`flex items-center ${isCollapsed ? "justify-center w-full" : ""}`}
      >
        {item.icon && (
          <item.icon className={`w-4 h-4 ${isCollapsed ? "" : "mr-3"}`} />
        )}
        {!isCollapsed && item.label}
      </div>
      {isCollapsed && isActive && (
        <div className="absolute left-0 w-1 h-8 bg-primary rounded-r-full" />
      )}
    </Link>
  );
};

const Sidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [pendingData, setPendingData] = useState<PendingTasksResponse | null>(
    null,
  );
  const [showNotifications, setShowNotifications] = useState(false);

  // Extract project ID from path if present
  const match = location.pathname.match(/\/dashboard\/projects\/(\d+)/);
  const activeProjectId = match ? parseInt(match[1], 10) : undefined;

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const data = await notificationService.getPendingTasks(activeProjectId);
        setPendingData(data);
      } catch (err) {
        console.error("Error fetching notifications:", err);
      }
    };
    fetchPending();
    // Refresh every 5 mins
    const interval = setInterval(fetchPending, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [activeProjectId]);

  return (
    <aside
      className={`${isCollapsed ? "w-20" : "w-64"} bg-surface-card border-r border-border-default shadow-lg flex flex-col h-full transition-all duration-300 relative`}
    >
      {/* Collapse Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-10 bg-surface-card border border-border-default shadow-md rounded-full p-1 hover:bg-surface-base z-20 text-text-disabled hover:text-primary transition-colors"
        title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>

      <div
        className={`p-6 border-b border-border-default bg-gradient-to-b from-primary-muted/60 to-transparent overflow-hidden ${isCollapsed ? "flex justify-center" : ""}`}
      >
        <h1 className="text-2xl font-extrabold text-primary flex items-center tracking-tight">
          <ShieldIcon className="w-6 h-6 flex-shrink-0" />
          {!isCollapsed && <span className="ml-2 whitespace-nowrap">SETU</span>}
        </h1>
        {!isCollapsed && (
          <>
            <p className="text-xs text-text-muted mt-2 truncate">
              Logged in as{" "}
              <span className="font-medium text-text-secondary">
                {user?.username}
              </span>
            </p>
            {user?.roles?.includes("Admin") && (
              <span className="inline-block mt-1 px-2 py-0.5 text-xs font-semibold text-white bg-error rounded-full">
                Admin
              </span>
            )}
          </>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 overflow-x-hidden px-1">
        {MENU_CONFIG.map((item) => (
          <SidebarItem key={item.path} item={item} isCollapsed={isCollapsed} />
        ))}

        {/* Dynamic Project Modules */}
        {activeProjectId && (
          <div className="mt-6">
            {!isCollapsed ? (
              <div className="px-6 py-2 text-xs font-bold text-text-disabled uppercase tracking-widest flex items-center gap-2">
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
                  label: "WBS Structure",
                  path: `/dashboard/projects/${activeProjectId}/wbs`,
                  icon: Layers,
                  permission: "WBS.NODE.READ",
                }}
              />
              <SidebarItem
                isCollapsed={isCollapsed}
                item={{
                  label: "Bill of Quantities",
                  path: `/dashboard/projects/${activeProjectId}/boq`,
                  icon: Layout,
                  permission: "BOQ.ITEM.READ",
                }}
              />
              <SidebarItem
                isCollapsed={isCollapsed}
                item={{
                  label: "Planning & Schedule",
                  path: `/dashboard/projects/${activeProjectId}/planning`,
                  icon: Grid,
                  permission: "PLANNING.MATRIX.READ",
                }}
              />
              <SidebarItem
                isCollapsed={isCollapsed}
                item={{
                  label: "Progress",
                  path: `/dashboard/projects/${activeProjectId}/progress`,
                  icon: Box,
                  permission: "PROGRESS.DASHBOARD.READ",
                }}
              />
              <SidebarItem
                isCollapsed={isCollapsed}
                item={{
                  label: "Manpower",
                  path: `/dashboard/projects/${activeProjectId}/manpower`,
                  icon: Users,
                  permission: "LABOR.ENTRY.READ",
                }}
              />
              <SidebarItem
                isCollapsed={isCollapsed}
                item={{
                  label: "Site Safety (EHS)",
                  path: `/dashboard/projects/${activeProjectId}/ehs`,
                  icon: ShieldAlert,
                  permission: "EHS.DASHBOARD.READ",
                }}
              />
              <SidebarItem
                isCollapsed={isCollapsed}
                item={{
                  label: "Quality Control",
                  path: `/dashboard/projects/${activeProjectId}/quality`,
                  icon: CheckCircle,
                  permission: "QUALITY.DASHBOARD.READ",
                }}
              />
              <SidebarItem
                isCollapsed={isCollapsed}
                item={{
                  label: "Design (Drawings)",
                  path: `/dashboard/projects/${activeProjectId}/design`,
                  icon: FileText,
                  permission: "DESIGN.DRAWING.READ",
                }}
              />
            </div>
          </div>
        )}
      </nav>

      <div
        className={`p-4 border-t border-border-default bg-surface-base/90 flex flex-col gap-2 ${isCollapsed ? "items-center" : ""}`}
      >
        {!isCollapsed && <ThemePicker compact />}
        <button
          onClick={() => setShowNotifications(true)}
          className={`flex items-center text-sm text-text-secondary hover:bg-surface-raised rounded-md transition-colors relative ${isCollapsed ? "p-2" : "w-full px-4 py-2"}`}
          title={isCollapsed ? "Notifications" : ""}
        >
          <Bell
            className={`w-4 h-4 ${isCollapsed ? "" : "mr-3"} text-text-muted`}
          />
          {!isCollapsed && <span>Pending Tasks</span>}
          {pendingData && pendingData.totalCount > 0 && (
            <span
              className={`absolute ${isCollapsed ? "top-1 right-1" : "right-4"} bg-error text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.2rem] flex items-center justify-center`}
            >
              {pendingData.totalCount > 9 ? "9+" : pendingData.totalCount}
            </span>
          )}
        </button>
        <Link
          to="/dashboard/profile"
          className={`flex items-center text-sm text-text-secondary hover:bg-surface-raised rounded-md transition-colors ${isCollapsed ? "p-2" : "w-full px-4 py-2"}`}
          title={isCollapsed ? "My Profile" : ""}
        >
          <User
            className={`w-4 h-4 ${isCollapsed ? "" : "mr-3"} text-text-muted`}
          />
          {!isCollapsed && <span>My Profile</span>}
        </Link>
        <button
          onClick={logout}
          className={`flex items-center text-sm text-error hover:bg-error-muted rounded-md transition-colors ${isCollapsed ? "p-2" : "w-full px-4 py-2"}`}
          title={isCollapsed ? "Logout" : ""}
        >
          <LogOut className={`w-4 h-4 ${isCollapsed ? "" : "mr-3"}`} />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>

      {/* Notification Slide-out Panel */}
      {showNotifications && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div
            className="fixed inset-0 bg-surface-overlay backdrop-blur-sm"
            onClick={() => setShowNotifications(false)}
          />
          <div className="relative w-full max-w-sm bg-surface-card h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b flex items-center justify-between bg-primary text-white">
              <div>
                <h2 className="text-xl font-bold">Pending Tasks</h2>
                <p className="text-xs text-on-primary/80">
                  Action required for these items
                </p>
              </div>
              <button
                onClick={() => setShowNotifications(false)}
                className="p-2 hover:bg-primary-dark rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface-base">
              {!pendingData || pendingData.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-text-disabled bg-surface-card rounded-xl border border-dashed border-border-default">
                  <CheckCircle
                    size={32}
                    className="mb-2 opacity-50 text-success"
                  />
                  <p className="text-sm">You are all caught up!</p>
                </div>
              ) : (
                pendingData.items.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    onClick={() => {
                      setShowNotifications(false);
                      if (item.type.startsWith("RFI")) {
                        navigate(
                          `/dashboard/projects/${activeProjectId}/quality`,
                        );
                      } else {
                        navigate(
                          `/dashboard/projects/${activeProjectId}/quality`,
                        );
                      }
                    }}
                    className="bg-surface-card p-4 rounded-xl shadow-sm border border-border-subtle flex gap-4 hover:border-primary/40 transition-all cursor-pointer group"
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        item.type === "RFI_APPROVAL"
                          ? "bg-secondary-muted text-secondary"
                          : item.type === "RFI_RAISED"
                            ? "bg-primary-muted text-primary"
                            : item.type === "OBS_CLOSE"
                              ? "bg-success-muted text-success"
                              : "bg-warning-muted text-warning"
                      }`}
                    >
                      {item.type.startsWith("RFI") ? (
                        <FileText size={20} />
                      ) : (
                        <AlertCircle size={20} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-text-primary truncate group-hover:text-primary">
                        {item.title}
                      </h4>
                      <p className="text-xs text-text-muted truncate mt-1">
                        {item.subtitle}
                      </p>
                      <div className="flex items-center mt-2 text-[10px] text-text-disabled">
                        <Clock size={10} className="mr-1" />
                        {new Date(item.date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-6 border-t bg-surface-base text-center">
              <p className="text-xs text-text-muted uppercase tracking-widest font-bold mb-1">
                {pendingData?.totalCount || 0} Total Actions
              </p>
              <p className="text-[10px] text-text-disabled italic">
                Latest updates from your project workspace
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

// Helper icon
const ShieldIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
    />
  </svg>
);

export default Sidebar;
