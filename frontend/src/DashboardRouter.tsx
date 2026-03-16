import { useState, useEffect } from "react";
import { dashboardBuilderApi } from "./services/dashboard-builder.service";
import DashboardViewer from "./views/dashboard-builder/DashboardViewer";
import ManagementDashboard from "./views/dashboard/ManagementDashboard";
import { RefreshCw } from "lucide-react";

export default function DashboardRouter() {
  const [hasCustom, setHasCustom] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkCustom = async () => {
      try {
        const res = await dashboardBuilderApi.getDefaults();
        // If it returns a 200 with data, we use common DashboardViewer (which handles showing the default)
        // If 404/Empty, we fallback to static ManagementDashboard
        setHasCustom(!!res.data);
      } catch (err) {
        setHasCustom(false);
      } finally {
        setLoading(false);
      }
    };
    checkCustom();
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          gap: 16,
        }}
      >
        <RefreshCw className="animate-spin" size={32} color="#2563eb" />
        <span style={{ fontSize: 14, color: "#64748b", fontWeight: 600 }}>
          Personalizing your workspace...
        </span>
      </div>
    );
  }

  // If hasCustom exists, DashboardViewer will fetch and render it natively
  return hasCustom ? <DashboardViewer /> : <ManagementDashboard />;
}
