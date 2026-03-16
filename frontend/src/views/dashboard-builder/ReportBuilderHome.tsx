import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  FileText,
  Download,
  Edit,
  Trash2,
  Calendar,
  FileType,
} from "lucide-react";

interface CustomReport {
  id: number;
  name: string;
  description?: string;
  dataSourceKey: string;
  columns: any[];
  filters: any[];
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ReportBuilderHome() {
  const [reports, setReports] = useState<CustomReport[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch reports if backend supports it - reusing API endpoint/pattern
    const load = async () => {
      setLoading(true);
      try {
        // Assuming we'll have /dashboard-builder/reports endpoint
        // const res = await dashboardBuilderApi.getReports();
        // setReports(res.data);
        setReports([]); // Placeholder
      } catch (err) {
        console.error("Failed to load reports", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this report?")) return;
    console.log("Deleting report:", id);
  };

  return (
    <div style={{ padding: "24px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "32px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: 800,
              color: "#0f172a",
              margin: 0,
              letterSpacing: "-0.5px",
            }}
          >
            Custom Reports
          </h1>
          <p
            style={{
              color: "#64748b",
              margin: "4px 0 0",
              fontSize: "14px",
              fontWeight: 500,
            }}
          >
            Design and generate tabular reports with advanced filtering and
            scheduling
          </p>
        </div>
        <button
          onClick={() => navigate("/dashboard/admin/reports/new")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 24px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
            fontWeight: 700,
            fontSize: "14px",
            boxShadow: "0 4px 6px -1px rgba(37, 99, 235, 0.2)",
          }}
        >
          <Plus size={18} /> Design New Report
        </button>
      </div>

      {loading ? (
        <div
          style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}
        >
          Loading Reports...
        </div>
      ) : reports.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "100px 40px",
            background: "#fff",
            borderRadius: 24,
            border: "2px dashed #e2e8f0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "#f8fafc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 24,
            }}
          >
            <FileText size={40} color="#94a3b8" />
          </div>
          <h3
            style={{
              color: "#1e293b",
              margin: "0 0 8px",
              fontSize: 18,
              fontWeight: 800,
            }}
          >
            No Reports Found
          </h3>
          <p
            style={{
              color: "#64748b",
              margin: 0,
              maxWidth: 360,
              lineHeight: 1.6,
            }}
          >
            You haven't designed any custom reports yet. Use the report builder
            to create complex data exports.
          </p>
          <button
            onClick={() => navigate("/dashboard/admin/reports/new")}
            style={{
              marginTop: 24,
              padding: "10px 20px",
              borderRadius: 8,
              background: "#f1f5f9",
              color: "#475569",
              border: "none",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Build Your First Report
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: 24,
          }}
        >
          {reports.map((report: CustomReport) => (
            <div
              key={report.id}
              style={{
                background: "#fff",
                borderRadius: 16,
                border: "1px solid #e2e8f0",
                padding: 24,
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                display: "flex",
                flexDirection: "column",
                gap: 16,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.boxShadow =
                  "0 10px 15px -3px rgba(0,0,0,0.05)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)")
              }
              onClick={() => navigate(`/dashboard/admin/reports/${report.id}`)}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: "#eff6ff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <FileType size={24} color="#2563eb" />
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/dashboard/admin/reports/${report.id}/edit`);
                    }}
                    style={{
                      padding: 8,
                      borderRadius: 8,
                      border: "none",
                      background: "#f8fafc",
                      color: "#64748b",
                      cursor: "pointer",
                    }}
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(report.id);
                    }}
                    style={{
                      padding: 8,
                      borderRadius: 8,
                      border: "none",
                      background: "#fef2f2",
                      color: "#ef4444",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 16,
                    fontWeight: 800,
                    color: "#1e293b",
                    marginBottom: 6,
                  }}
                >
                  {report.name}
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "#64748b",
                    lineHeight: 1.5,
                    minHeight: 40,
                  }}
                >
                  {report.description || "No description provided."}
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  marginTop: "auto",
                  paddingTop: 16,
                  borderTop: "1px solid #f1f5f9",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    color: "#94a3b8",
                  }}
                >
                  <Calendar size={14} />
                  Last Run:{" "}
                  {report.lastRunAt
                    ? new Date(report.lastRunAt).toLocaleDateString()
                    : "Never"}
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); /* Logic to Run/Download */
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      borderRadius: 8,
                      background: "#10b981",
                      color: "#fff",
                      border: "none",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    <Download size={14} /> Export
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
