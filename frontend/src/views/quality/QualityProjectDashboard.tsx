import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardCheck,
  FlaskConical,
  Eye,
  CheckSquare,
  Hammer,
  ShieldCheck,
  FileText,
  ArrowLeft,
  AlertCircle,
  Building2,
  FileScan,
  Settings,
} from "lucide-react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { PermissionCode } from "../../config/permissions";
import QualityOverview from "./subviews/QualityOverview";
import QualityInspection from "./subviews/QualityInspection";
import QualityMaterialTest from "./subviews/QualityMaterialTest";
import SiteObservationPanel from "./subviews/SiteObservationPanel";
import QualityChecklist from "./subviews/QualityChecklist";
import SnagManagementPage from "./SnagManagementPage";
import QualityAudit from "./subviews/QualityAudit";
import QualityDocuments from "./subviews/QualityDocuments";
import QualityStructureManager from "./subviews/QualityStructureManager";
import SnagDesnagConfigPage from "./subviews/SnagDesnagConfigPage";
import BatchSlipScanConfigPage from "./subviews/BatchSlipScanConfigPage";
import QualityRatingConfigTab from "./subviews/QualityRatingConfigTab";
import QualityRatingDisplayTab from "./subviews/QualityRatingDisplayTab";
import QualityApprovalDashboard from "./subviews/QualityApprovalDashboard";
import InspectionRequestPage from "./InspectionRequestPage";
import QualityApprovalsPage from "./QualityApprovalsPage";
import ActivityListsPage from "./ActivityListsPage";
import QualityObservationNcr from "./subviews/QualityObservationNcr";

const QualityProjectDashboard = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const [projectLoadError, setProjectLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [activeConfigTab, setActiveConfigTab] = useState("floor-unit-structure");
  const canViewStructure =
    hasPermission(PermissionCode.QUALITY_STRUCTURE_READ) ||
    hasPermission(PermissionCode.QUALITY_STRUCTURE_MANAGE);
  const canViewSnagConfig =
    hasPermission(PermissionCode.QUALITY_SNAG_CONFIG_READ) ||
    hasPermission(PermissionCode.QUALITY_SNAG_CONFIG_MANAGE);
  const canViewBatchSlipConfig =
    hasPermission(PermissionCode.QUALITY_BATCH_SLIP_CONFIG_READ) ||
    hasPermission(PermissionCode.QUALITY_BATCH_SLIP_CONFIG_MANAGE);

  useEffect(() => {
    if (activeConfigTab === "floor-unit-structure" && canViewStructure) return;
    if (activeConfigTab === "snag-desnag" && canViewSnagConfig) return;
    if (activeConfigTab === "batch-slip-scan" && canViewBatchSlipConfig) return;
    if (canViewStructure) {
      setActiveConfigTab("floor-unit-structure");
    } else if (canViewSnagConfig) {
      setActiveConfigTab("snag-desnag");
    } else if (canViewBatchSlipConfig) {
      setActiveConfigTab("batch-slip-scan");
    }
  }, [
    activeConfigTab,
    canViewBatchSlipConfig,
    canViewSnagConfig,
    canViewStructure,
  ]);

  useEffect(() => {
    const fetchProject = async () => {
      if (!projectId) {
        setIsLoadingProject(false);
        setProjectLoadError("Project id is missing.");
        return;
      }
      try {
        setIsLoadingProject(true);
        setProjectLoadError(null);
        const response = await api.get(`/eps/${projectId}`);
        setProject(response.data);
      } catch (error) {
        console.error(error);
        setProject(null);
        setProjectLoadError("Unable to load project details for Quality Control.");
      } finally {
        setIsLoadingProject(false);
      }
    };
    fetchProject();
  }, [projectId]);

  const tabs = [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      visible: hasPermission(PermissionCode.QUALITY_DASHBOARD_READ),
    },
    {
      id: "approval-board",
      label: "Approval Board",
      icon: ShieldCheck,
      visible: hasPermission(PermissionCode.QUALITY_INSPECTION_READ),
    },
    {
      id: "requests",
      label: "Quality Requests",
      icon: FileText,
      visible: hasPermission(PermissionCode.QUALITY_INSPECTION_RAISE),
    },
    {
      id: "approvals",
      label: "QA/QC Approvals",
      icon: ShieldCheck,
      visible: hasPermission(PermissionCode.QUALITY_INSPECTION_READ),
    },
    {
      id: "activities",
      label: "Activity Lists",
      icon: ClipboardCheck,
      visible: hasPermission(PermissionCode.QUALITY_ACTIVITYLIST_READ),
    },
    {
      id: "inspections",
      label: "Inspections",
      icon: ClipboardCheck,
      visible: hasPermission(PermissionCode.QUALITY_INSPECTION_READ),
    },
    {
      id: "materials",
      label: "Materials",
      icon: FlaskConical,
      visible:
        hasPermission(PermissionCode.QUALITY_MATERIAL_ITP_READ) ||
        hasPermission(PermissionCode.QUALITY_CUBE_TEST_READ) ||
        hasPermission(PermissionCode.QUALITY_MATERIAL_TEST_READ) ||
        hasPermission(PermissionCode.QUALITY_TEST_READ),
    },
    {
      id: "observation-ncr",
      label: "Site Observations",
      icon: Eye,
      visible: hasPermission(PermissionCode.QUALITY_SITE_OBS_READ),
    },
    {
      id: "nc-register",
      label: "NC Register",
      icon: AlertCircle,
      visible: hasPermission(PermissionCode.QUALITY_NCR_READ),
    },
    {
      id: "rating-config",
      label: "Rating Config",
      icon: ShieldCheck,
      visible: hasPermission(PermissionCode.QUALITY_RATING_CONFIGURE),
    },
    {
      id: "project-rating",
      label: "Project Rating",
      icon: LayoutDashboard,
      visible: hasPermission(PermissionCode.QUALITY_RATING_READ),
    },
    {
      id: "checklists",
      label: "Checklists",
      icon: CheckSquare,
      visible: hasPermission(PermissionCode.QUALITY_CHECKLIST_READ),
    },
    {
      id: "snags",
      label: "Snag List",
      icon: Hammer,
      visible: hasPermission(PermissionCode.QUALITY_SNAG_READ),
    },
    {
      id: "configuration",
      label: "Configuration",
      icon: Settings,
      visible: canViewStructure || canViewSnagConfig || canViewBatchSlipConfig,
    },
    {
      id: "audits",
      label: "Audits",
      icon: ShieldCheck,
      visible: hasPermission(PermissionCode.QUALITY_AUDIT_READ),
    },
    {
      id: "documents",
      label: "Documents",
      icon: FileText,
      visible: hasPermission(PermissionCode.QUALITY_DOCUMENT_READ),
    },
  ];
  const visibleTabs = tabs.filter((tab) => tab.visible);

  useEffect(() => {
    if (visibleTabs.length === 0) return;
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [activeTab, visibleTabs]);

  const renderActiveTab = () => {
    const numericProjectId = Number(projectId);
    switch (activeTab) {
      case "overview":
        return <QualityOverview projectId={numericProjectId} />;
      case "approval-board":
        return <QualityApprovalDashboard projectId={numericProjectId} />;
      case "requests":
        return <InspectionRequestPage />;
      case "approvals":
        return <QualityApprovalsPage />;
      case "activities":
        return <ActivityListsPage />;
      case "rating-config":
        return <QualityRatingConfigTab projectId={numericProjectId} />;
      case "project-rating":
        return <QualityRatingDisplayTab projectId={numericProjectId} />;
      case "inspections":
        return <QualityInspection projectId={numericProjectId} />;
      case "materials":
        return <QualityMaterialTest projectId={numericProjectId} />;
      case "observation-ncr":
        return <SiteObservationPanel projectId={numericProjectId} />;
      case "nc-register":
        return <QualityObservationNcr projectId={numericProjectId} ncrOnly />;
      case "checklists":
        return <QualityChecklist projectId={numericProjectId} />;
      case "snags":
        return <SnagManagementPage />;
      case "configuration":
        return (
          <div className="flex h-full flex-col bg-surface-base">
            <div className="border-b border-border-default bg-surface-card px-4 py-3">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-text-muted" />
                <div>
                  <h2 className="text-base font-semibold text-text-primary">
                    Quality Configuration
                  </h2>
                  <p className="text-xs text-text-muted">
                    Configure quality master data and project-specific setup.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveConfigTab("floor-unit-structure")}
                  disabled={!canViewStructure}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    activeConfigTab === "floor-unit-structure"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border-default bg-surface-base text-text-secondary hover:bg-surface-raised"
                  }`}
                >
                  <Building2 className="h-4 w-4" />
                  Floor and Unit Structure
                </button>
                {canViewSnagConfig && (
                  <button
                    type="button"
                    onClick={() => setActiveConfigTab("snag-desnag")}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      activeConfigTab === "snag-desnag"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border-default bg-surface-base text-text-secondary hover:bg-surface-raised"
                    }`}
                  >
                    <Hammer className="h-4 w-4" />
                    Snag / Desnag Process
                  </button>
                )}
                {canViewBatchSlipConfig && (
                  <button
                    type="button"
                    onClick={() => setActiveConfigTab("batch-slip-scan")}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      activeConfigTab === "batch-slip-scan"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border-default bg-surface-base text-text-secondary hover:bg-surface-raised"
                    }`}
                  >
                    <FileScan className="h-4 w-4" />
                    Batch Slip Scan Config
                  </button>
                )}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {activeConfigTab === "floor-unit-structure" ? (
                canViewStructure ? (
                  <QualityStructureManager projectId={numericProjectId} />
                ) : (
                  <BatchSlipScanConfigPage projectId={numericProjectId} />
                )
              ) : activeConfigTab === "snag-desnag" ? (
                <SnagDesnagConfigPage projectId={numericProjectId} />
              ) : activeConfigTab === "batch-slip-scan" ? (
                <BatchSlipScanConfigPage projectId={numericProjectId} />
              ) : null}
            </div>
          </div>
        );
      case "audits":
        return <QualityAudit projectId={numericProjectId} />;
      case "documents":
        return <QualityDocuments projectId={numericProjectId} />;
      default:
        return <QualityOverview projectId={numericProjectId} />;
    }
  };

  const fullScreenTabs = new Set([
    "overview",
    "approval-board",
    "requests",
    "approvals",
    "activities",
    "inspections",
    "materials",
    "observation-ncr",
    "nc-register",
    "project-rating",
    "checklists",
    "snags",
    "configuration",
    "audits",
    "documents",
  ]);

  if (isLoadingProject) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-base text-sm font-medium text-text-muted">
        Loading Quality Control...
      </div>
    );
  }

  if (projectLoadError) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-base p-6">
        <div className="max-w-md rounded-2xl border border-border-default bg-surface-card p-6 text-center shadow-sm">
          <div className="text-lg font-semibold text-text-primary">
            Quality Control is unavailable
          </div>
          <div className="mt-2 text-sm text-text-muted">{projectLoadError}</div>
          <button
            onClick={() => navigate("/dashboard/eps")}
            className="mt-4 rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-base text-sm font-medium text-text-muted">
        Project details are not available.
      </div>
    );
  }

  if (visibleTabs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-base p-6">
        <div className="max-w-md rounded-2xl border border-border-default bg-surface-card p-6 text-center shadow-sm">
          <div className="text-lg font-semibold text-text-primary">
            No Quality tabs available
          </div>
          <div className="mt-2 text-sm text-text-muted">
            This user can open the Quality module route, but no Quality sections are currently visible for the assigned permissions.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-shell flex flex-col h-full ui-animate-page">
      {/* Header */}
      <div className="ui-page-header px-4 py-3">
        <div className="mb-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard/eps")}
            className="rounded-lg border border-transparent p-2 text-text-muted transition-colors hover:border-border-default hover:bg-surface-raised"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="ui-title text-2xl">{project.name}</h1>
            <p className="ui-subtitle">Quality Management System</p>
          </div>
        </div>

        <div className="ui-tab-rail overflow-x-auto no-scrollbar py-0.5">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`ui-tab whitespace-nowrap transition-all ${
                activeTab === tab.id ? "ui-tab-active" : ""
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div
        className={`ui-stagger flex-1 overflow-y-auto ${
          fullScreenTabs.has(activeTab) ? "p-0" : "p-4"
        }`}
      >
        {renderActiveTab()}
      </div>
    </div>
  );
};

export default QualityProjectDashboard;
