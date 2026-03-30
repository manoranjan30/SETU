import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import {
  FileText,
  Download,
  RefreshCw,
  ArrowLeft,
  Printer,
  LayoutGrid,
  Calendar,
} from "lucide-react";
import { dashboardBuilderApi } from "../../services/dashboard-builder.service";
import { exportUtils } from "../../utils/export.utils";
import { resolveRegisteredExportFileName } from "../../utils/export.registry";

// Types
interface ReportConfig {
  id: number;
  name: string;
  description?: string;
  dataSourceKey: string;
  columns: {
    key: string;
    label: string;
    format?: string;
    aggregate?: string;
  }[];
  filters: any[];
  groupBy?: string[];
  createdAt: string;
}

export default function ReportViewer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const gridRef = useRef<AgGridReact>(null);

  const [report, setReport] = useState<ReportConfig | null>(null);
  const [rowData, setRowData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const loadReportData = async () => {
    if (!id) return;
    setLoading(true);
    setRefreshError(null);
    try {
      // 1. Fetch report config
      // const res = await dashboardBuilderApi.getReport(Number(id));
      // if (res.data) setReport(res.data);

      // For now, placeholder report config
      const dummyReport: ReportConfig = {
        id: Number(id),
        name: "Sample Site Progress Audit",
        description: "Weekly audit of all activities that are behind baseline.",
        dataSourceKey: "activity.list",
        columns: [
          { key: "activityCode", label: "Code" },
          { key: "activityName", label: "Activity Description" },
          { key: "status", label: "Status" },
          { key: "percentComplete", label: "Progress (%)" },
          { key: "startDatePlanned", label: "Planned Start" },
          { key: "finishDatePlanned", label: "Planned Finish" },
        ],
        filters: [],
        createdAt: new Date().toISOString(),
      };
      setReport(dummyReport);

      // 2. Fetch actual data from data source
      const dataRes = await dashboardBuilderApi.queryData(
        dummyReport.dataSourceKey,
        {
          columns: dummyReport.columns.map((c) => c.key),
          filters: dummyReport.filters,
        },
      );
      setRowData(dataRes.data);
    } catch (err: any) {
      console.error("Failed to run report", err);
      setRefreshError(err.message || "Data source execution failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [id]);

  // AG Grid Column Definitions
  const columnDefs = useMemo(() => {
    if (!report) return [];
    return report.columns.map((c) => ({
      field: c.key,
      headerName: c.label,
      sortable: true,
      filter: true,
      resizable: true,
      flex: 1,
      valueFormatter: (params: any) => {
        const val = params.value;
        if (!val) return "-";
        // Basic formatting
        if (c.key.toLowerCase().includes("date"))
          return new Date(val).toLocaleDateString();
        if (c.key.toLowerCase().includes("percent")) return `${val}%`;
        return val;
      },
    }));
  }, [report]);

  const defaultColDef = useMemo(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
    }),
    [],
  );

  const handleExport = (type: "EXCEL" | "CSV") => {
    if (!report || rowData.length === 0) return;
    const filename = resolveRegisteredExportFileName("dashboard.report", {
      reportName: report.name,
      reportId: report.id,
    });
    const columns = report.columns.map((column) => ({
      key: column.key,
      label: column.label,
    }));

    if (type === "EXCEL") {
      exportUtils.toExcel(rowData, filename, {
        sheetName: report.name,
        columns,
      });
      return;
    }

    exportUtils.toCsv(rowData, filename, { columns });
  };

  if (loading && !report) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        Initializing Report Builder...
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#f8fafc",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px 32px",
          background: "#fff",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <button
            onClick={() => navigate("/dashboard/admin/reports")}
            style={{
              padding: 8,
              borderRadius: 10,
              border: "none",
              background: "#f1f5f9",
              cursor: "pointer",
              color: "#64748b",
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 800,
                color: "#0f172a",
                letterSpacing: "-0.5px",
              }}
            >
              {report?.name}
            </h1>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginTop: 4,
              }}
            >
              <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>
                ID: REP-{id}
              </span>
              <div
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "#e2e8f0",
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <LayoutGrid size={12} /> {report?.dataSourceKey}
              </span>
              <div
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "#e2e8f0",
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Calendar size={12} /> Generated:{" "}
                {new Date().toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => loadReportData()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              background: "#fff",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              color: "#475569",
            }}
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />{" "}
            Run Again
          </button>
          <div
            style={{
              width: 1,
              height: 32,
              background: "#e2e8f0",
              margin: "0 4px",
            }}
          />
          <button
            onClick={() => handleExport("EXCEL")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background: "#10b981",
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <Download size={16} /> Excel
          </button>
          <button
            onClick={() => exportUtils.toPdf()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background: "#0f172a",
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      {/* Error States */}
      {refreshError && (
        <div
          style={{
            margin: 24,
            padding: 16,
            background: "#fef2f2",
            border: "1px solid #fee2e2",
            borderRadius: 12,
            color: "#dc2626",
            fontSize: 14,
          }}
        >
          <b>Report Execution Failed:</b> {refreshError}
        </div>
      )}

      {/* Main Content (AG Grid) */}
      <div
        style={{
          flex: 1,
          padding: 24,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            flex: 1,
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
            overflow: "hidden",
          }}
          className="ag-theme-alpine ag-theme-setu"
        >
          <AgGridReact
            ref={gridRef}
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            pagination={true}
            paginationPageSize={100}
            domLayout="autoHeight"
            suppressCellFocus={true}
          />

          {rowData.length === 0 && !loading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.8)",
              }}
            >
              <FileText
                size={48}
                color="#e2e8f0"
                style={{ marginBottom: 16 }}
              />
              <p style={{ color: "#94a3b8", margin: 0 }}>
                No matching records found for this report configuration.
              </p>
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#64748b",
            fontSize: 13,
          }}
        >
          <div>
            Total Records: <b>{rowData.length}</b>
          </div>
          <div>
            Source: <b>SETU Micro-Analysis Engine</b>
          </div>
        </div>
      </div>
    </div>
  );
}
