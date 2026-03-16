import React, { useState, useEffect, useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
} from "ag-grid-community";
import api from "../../../api/axios";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";

// Register all community modules to avoid missing feature errors
ModuleRegistry.registerModules([AllCommunityModule]);

const ScheduleComparisonGrid: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();

  const v1Id = searchParams.get("v1");
  const v2Id = searchParams.get("v2");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (v1Id && v2Id) {
      fetchComparison();
    }
  }, [v1Id, v2Id]);

  const fetchComparison = async () => {
    setLoading(true);
    try {
      const res = await api.get("/planning/versions/compare", {
        params: { v1: v1Id, v2: v2Id, projectId },
      });
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const columnDefs = useMemo(
    () => [
      {
        headerName: "Activity Name",
        field: "activityName",
        width: 250,
        pinned: "left" as const,
      },
      {
        headerName: "Baseline Start",
        field: "baseStart",
        width: 120,
        valueFormatter: (params: any) =>
          params.value ? new Date(params.value).toLocaleDateString() : "-",
      },
      {
        headerName: "Revised Start",
        field: "compareStart",
        width: 120,
        valueFormatter: (params: any) =>
          params.value ? new Date(params.value).toLocaleDateString() : "-",
      },
      {
        headerName: "Start Variance",
        field: "startVariance",
        width: 120,
        cellStyle: (params: any) => {
          if (params.value > 0) return { color: "red", fontWeight: "bold" };
          if (params.value < 0) return { color: "green", fontWeight: "bold" };
          return null;
        },
        valueFormatter: (params: any) =>
          `${params.value > 0 ? "+" : ""}${params.value} d`,
      },
      {
        headerName: "Baseline Finish",
        field: "baseFinish",
        width: 120,
        valueFormatter: (params: any) =>
          params.value ? new Date(params.value).toLocaleDateString() : "-",
      },
      {
        headerName: "Revised Finish",
        field: "compareFinish",
        width: 120,
        valueFormatter: (params: any) =>
          params.value ? new Date(params.value).toLocaleDateString() : "-",
      },
      {
        headerName: "Finish Variance",
        field: "finishVariance",
        width: 120,
        cellStyle: (params: any) => {
          if (params.value > 0) return { color: "red", fontWeight: "bold" };
          if (params.value < 0) return { color: "green", fontWeight: "bold" };
          return null;
        },
        valueFormatter: (params: any) =>
          `${params.value > 0 ? "+" : ""}${params.value} d`,
      },
    ],
    [],
  );

  if (loading) {
    return (
      <div className="p-8 text-center text-text-muted">
        Loading comparison analysis...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-surface-raised rounded-full transition-colors"
        >
          <ArrowLeft size={20} className="text-text-secondary" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Schedule Variance Analysis
          </h1>
          <p className="text-text-muted text-sm">
            Comparing Version {v1Id} vs {v2Id}
          </p>
        </div>
      </div>

      <div className="flex-1 bg-surface-card rounded-xl shadow border border-border-default overflow-hidden">
        <AgGridReact
          theme={themeQuartz}
          columnDefs={columnDefs}
          rowData={data}
          defaultColDef={{ resizable: true, sortable: true, filter: true }}
          animateRows={true}
          rowHeight={40}
          headerHeight={48}
        />
      </div>
    </div>
  );
};

export default ScheduleComparisonGrid;
