import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  LayoutDashboard,
  TrendingUp,
  Clock,
  ClipboardCheck,
  BookOpen,
  Scale,
  AlertOctagon,
  Hammer,
  Activity,
  Truck,
  UserCheck,
} from "lucide-react";
import api from "../../api/axios";

// Sub-views
import EhsOverview from "./subviews/EhsOverview";
import EhsPerformance from "./subviews/EhsPerformance";
import EhsManhours from "./subviews/EhsManhours";
import EhsInspection from "./subviews/EhsInspection";
import EhsTraining from "./subviews/EhsTraining";
import EhsLegalRegister from "./subviews/EhsLegalRegister";
import EhsMachinery from "./subviews/EhsMachinery";
import EhsIncident from "./subviews/EhsIncident";
import EhsVehicle from "./subviews/EhsVehicle";
import EhsCompetency from "./subviews/EhsCompetency";

const EhsProjectDashboard = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [expiredComplianceCount, setExpiredComplianceCount] = useState(0);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const response = await api.get(`/eps/${projectId}`);
        setProject(response.data);
      } catch (error) {
        console.error(error);
      }
    };
    fetchProject();
  }, [projectId]);

  // Check for expired legal compliances
  useEffect(() => {
    const checkCompliance = async () => {
      if (!projectId) return;
      try {
        const response = await api.get(`/ehs/${projectId}/legal`);
        const today = new Date();
        const expired = response.data.filter((item: any) => {
          if (!item.expiryDate) return false;
          return new Date(item.expiryDate) < today;
        }).length;
        setExpiredComplianceCount(expired);
      } catch (error) {
        console.error("Failed to fetch legal stats for alert", error);
      }
    };
    checkCompliance();
  }, [projectId, activeTab]); // Re-check when tab changes in case user updated something in Legal tab

  if (!project) return null;

  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "performance", label: "Performance", icon: TrendingUp },
    { id: "manhours", label: "Manhours", icon: Clock },
    { id: "inspection", label: "Inspection", icon: ClipboardCheck },
    { id: "training", label: "Training", icon: BookOpen },
    {
      id: "legal",
      label: "Legal",
      icon: Scale,
      alert: expiredComplianceCount > 0,
    },
    { id: "machinery", label: "Machinery", icon: Hammer },
    { id: "incidents", label: "Incidents", icon: Activity },
    { id: "vehicle", label: "Vehicle", icon: Truck },
    { id: "competency", label: "Competency", icon: UserCheck },
  ];

  return (
    <div className="ui-shell flex flex-col h-full">
      {/* Header */}
      <div className="ui-page-header px-6 py-4">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate("/dashboard/eps")}
            className="p-2 hover:bg-surface-raised rounded-lg text-text-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="ui-title text-3xl">{project.name}</h1>
            <p className="ui-subtitle">Site Safety Management System</p>
          </div>
        </div>

        <div className="ui-tab-rail overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`ui-tab whitespace-nowrap ${
                activeTab === tab.id ? "ui-tab-active" : ""
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.alert && <AlertOctagon className="w-4 h-4 text-red-400" />}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-[1600px] mx-auto">
          {/* Global Alert for Expired Compliance */}
          {expiredComplianceCount > 0 && (
            <div className="bg-error-muted border-l-4 border-error p-4 rounded-r-lg shadow-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2 mb-6">
              <AlertOctagon className="w-5 h-5 text-error mt-0.5" />
              <div>
                <h3 className="text-error font-bold">
                  Action Required: Expired Legal Compliances
                </h3>
                <p className="text-error text-sm mt-1">
                  There are{" "}
                  <span className="font-bold">{expiredComplianceCount}</span>{" "}
                  expired legal compliance items requiring immediate attention.
                  Please review the{" "}
                  <button
                    onClick={() => setActiveTab("legal")}
                    className="underline font-bold hover:opacity-85"
                  >
                    Legal Tab
                  </button>
                  .
                </p>
              </div>
            </div>
          )}

          {activeTab === "overview" && (
            <EhsOverview projectId={Number(projectId)} />
          )}
          {activeTab === "performance" && (
            <EhsPerformance projectId={Number(projectId)} />
          )}
          {activeTab === "manhours" && (
            <EhsManhours projectId={Number(projectId)} />
          )}
          {activeTab === "inspection" && (
            <EhsInspection projectId={Number(projectId)} />
          )}
          {activeTab === "training" && (
            <EhsTraining projectId={Number(projectId)} />
          )}
          {activeTab === "legal" && (
            <EhsLegalRegister projectId={Number(projectId)} />
          )}
          {activeTab === "machinery" && (
            <EhsMachinery projectId={Number(projectId)} />
          )}
          {activeTab === "incidents" && (
            <EhsIncident projectId={Number(projectId)} />
          )}
          {activeTab === "vehicle" && (
            <EhsVehicle projectId={Number(projectId)} />
          )}
          {activeTab === "competency" && (
            <EhsCompetency projectId={Number(projectId)} />
          )}
        </div>
      </div>
    </div>
  );
};

export default EhsProjectDashboard;
