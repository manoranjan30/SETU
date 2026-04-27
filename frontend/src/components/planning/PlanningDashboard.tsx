import { useEffect } from "react";
import {
  Calendar,
  Table,
  CheckSquare,
  ShieldCheck,
  Layers,
  Split,
  FileText,
  ListChecks,
  Users,
  Map,
  MessageSquareMore,
  Landmark,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { clsx } from "clsx";
import { useAuth } from "../../context/AuthContext";
import { PermissionCode } from "../../config/permissions";

interface PlanningDashboardProps {
  children: React.ReactNode;
  currentView: string;
  onViewChange: (view: string) => void;
}

const PlanningDashboard: React.FC<PlanningDashboardProps> = ({
  children,
  currentView,
  onViewChange,
}) => {
  const { hasPermission } = useAuth();
  const menuItems = [
    {
      key: "schedule",
      icon: <Calendar size={18} />,
      label: "Master Schedule",
      permission: PermissionCode.SCHEDULE_READ,
    },
    {
      key: "micro_schedule",
      icon: <ListChecks size={18} />,
      label: "Micro Schedule",
      permission: PermissionCode.MICRO_SCHEDULE_READ,
    },
    {
      key: "matrix",
      icon: <Layers size={18} />,
      label: "Schedule Mapper",
      permission: PermissionCode.PLANNING_MATRIX_READ,
    },
    {
      key: "mapper",
      icon: <Split size={18} />,
      label: "WO Qty Mapper",
      permission: PermissionCode.WORKORDER_MAPPING_READ,
    },
    {
      key: "contracts",
      icon: <FileText size={18} />,
      label: "Contracts (WO)",
      permission: PermissionCode.WORKORDER_ORDER_READ,
    },
    {
      key: "schedules", // New Item
      icon: <Layers size={18} />,
      label: "Working Schedules",
      permission: PermissionCode.SCHEDULE_VERSION_READ,
    },

    {
      key: "lookahead",
      icon: <Table size={18} />,
      label: "Lookahead Plan",
      permission: PermissionCode.PLANNING_LOOKAHEAD_CREATE,
    },
    {
      key: "recovery",
      icon: <CheckSquare size={18} />,
      label: "Recovery Plans",
      permission: PermissionCode.PLANNING_RECOVERY_MANAGE,
    },
    {
      key: "temp_users",
      icon: <Users size={18} />,
      label: "Vendor Users",
      permission: PermissionCode.TEMP_USER_VIEW,
    },
    {
      key: "release_strategy",
      icon: <ShieldCheck size={18} />,
      label: "Release Strategy",
      permission: PermissionCode.RELEASE_STRATEGY_READ,
    },
    {
      key: "building_lines",
      icon: <Map size={18} />,
      label: "Building Lines",
      permission: PermissionCode.PLANNING_MATRIX_READ,
    },
    {
      key: "issue_tracker",
      icon: <MessageSquareMore size={18} />,
      label: "Issue Tracker",
      permission: PermissionCode.PLANNING_MATRIX_READ,
    },
    {
      key: "customer_milestones",
      icon: <Landmark size={18} />,
      label: "Customer Milestones",
      permission: PermissionCode.MILESTONE_READ,
    },
    {
      key: "cost",
      icon: <TrendingUp size={18} />,
      label: "Cost & Cashflow",
      permission: PermissionCode.BOQ_READ,
    },
    {
      key: "budget",
      icon: <Wallet size={18} />,
      label: "Budget",
      permission: PermissionCode.PLANNING_BUDGET_READ,
    },
  ];

  const visibleMenuItems = menuItems.filter(
    (item: any) => !item.permission || hasPermission(item.permission),
  );

  useEffect(() => {
    if (!visibleMenuItems.some((item) => item.key === currentView) && visibleMenuItems[0]) {
      onViewChange(visibleMenuItems[0].key);
    }
  }, [currentView, onViewChange, visibleMenuItems]);

  return (
    <div className="ui-shell flex h-screen overflow-hidden ui-animate-page">
      {/* Sidebar */}
      <div className="w-64 bg-surface-card border-r border-border-default flex flex-col h-full shadow-lg z-10 ui-animate-card">
        <div className="p-4 border-b border-border-subtle flex-shrink-0">
          <h2 className="text-lg font-semibold text-text-primary">
            Planning Domain
          </h2>
          <p className="text-xs text-text-muted">Make schedules intelligent</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          <ul className="space-y-1">
            {visibleMenuItems.map((item) => (
              <li key={item.key}>
                <button
                  onClick={() => onViewChange(item.key)}
                  className={clsx(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl transition-colors border",
                    currentView === item.key
                      ? "bg-primary-muted text-primary border-primary/30"
                      : "text-text-secondary border-transparent hover:bg-surface-raised hover:text-text-primary hover:border-border-default",
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {[
          "schedule",
          "micro_schedule",
          "mapper",
          "matrix",
          "schedules",
          "gantt_version",
          "lookahead",
          "release_strategy",
          "cost",
          "budget",
        ].includes(currentView) ? (
          children
        ) : (
          <div className="flex-1 overflow-auto p-6 ui-stagger">
            <div className="ui-card min-h-[400px] p-6">{children}</div>
          </div>
        )}
      </main>
    </div>
  );
};

export default PlanningDashboard;
