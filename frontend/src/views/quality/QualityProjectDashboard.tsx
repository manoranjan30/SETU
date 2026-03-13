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
} from "lucide-react";
import api from "../../api/axios";
import QualityOverview from "./subviews/QualityOverview";
import QualityInspection from "./subviews/QualityInspection";
import QualityMaterialTest from "./subviews/QualityMaterialTest";
import SiteObservationPanel from "./subviews/SiteObservationPanel";
import QualityChecklist from "./subviews/QualityChecklist";
import QualitySnagList from "./subviews/QualitySnagList";
import QualityAudit from "./subviews/QualityAudit";
import QualityDocuments from "./subviews/QualityDocuments";
import QualityStructureManager from "./subviews/QualityStructureManager";
import QualityRatingConfigTab from "./subviews/QualityRatingConfigTab";
import QualityRatingDisplayTab from "./subviews/QualityRatingDisplayTab";
import InspectionRequestPage from "./InspectionRequestPage";
import QualityApprovalsPage from "./QualityApprovalsPage";
import ActivityListsPage from "./ActivityListsPage";

const QualityProjectDashboard = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    const fetchProject = async () => {
      if (!projectId) return;
      try {
        const response = await api.get(`/eps/${projectId}`);
        setProject(response.data);
      } catch (error) {
        console.error(error);
      }
    };
    fetchProject();
  }, [projectId]);

  if (!project) return null;

  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "requests", label: "Quality Requests", icon: FileText },
    { id: "approvals", label: "QA/QC Approvals", icon: ShieldCheck },
    { id: "activities", label: "Activity Lists", icon: ClipboardCheck },
    { id: "inspections", label: "Inspections", icon: ClipboardCheck },
    { id: "materials", label: "Materials", icon: FlaskConical },
    { id: "observation-ncr", label: "Site Observations", icon: Eye },
    { id: "rating-config", label: "Rating Config", icon: ShieldCheck },
    { id: "project-rating", label: "Project Rating", icon: LayoutDashboard },
    { id: "checklists", label: "Checklists", icon: CheckSquare },
    { id: "snags", label: "Snag List", icon: Hammer },
    { id: "structure", label: "Structure", icon: LayoutDashboard },
    { id: "audits", label: "Audits", icon: ShieldCheck },
    { id: "documents", label: "Documents", icon: FileText },
  ];

  const renderActiveTab = () => {
    const numericProjectId = Number(projectId);
    switch (activeTab) {
      case "overview":
        return <QualityOverview projectId={numericProjectId} />;
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
      case "checklists":
        return <QualityChecklist projectId={numericProjectId} />;
      case "snags":
        return <QualitySnagList projectId={numericProjectId} />;
      case "structure":
        return <QualityStructureManager projectId={numericProjectId} />;
      case "audits":
        return <QualityAudit projectId={numericProjectId} />;
      case "documents":
        return <QualityDocuments projectId={numericProjectId} />;
      default:
        return <QualityOverview projectId={numericProjectId} />;
    }
  };

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
          {tabs.map((tab) => (
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
      <div className="ui-stagger flex-1 overflow-y-auto p-4">{renderActiveTab()}</div>
    </div>
  );
};

export default QualityProjectDashboard;
