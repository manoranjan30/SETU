import { useState, useEffect, useMemo } from "react";
import api from "../../api/axios";
import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import { Trash2, Edit, Save, X } from "lucide-react";

interface ExecutionLogTableProps {
  projectId: number;
}

const ExecutionLogTable = ({ projectId }: ExecutionLogTableProps) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [editingLogId, setEditingLogId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<number>(0);

  const fetchLogs = async () => {
    try {
      const res = await api.get(`/execution/${projectId}/logs`);
      console.log(
        `[ExecutionLogTable] Fetched ${res.data?.length} logs:`,
        res.data,
      );
      setLogs(res.data);
    } catch (err) {
      console.error("Failed to fetch logs", err);
    }
  };

  useEffect(() => {
    if (projectId) fetchLogs();
  }, [projectId]);

  const handleEdit = (log: any) => {
    setEditingLogId(log.id);
    setEditValue(log.executedQty);
  };

  const handleSaveEdit = async (logId: number) => {
    try {
      await api.patch(`/execution/logs/${logId}`, { newQty: editValue });
      setEditingLogId(null);
      fetchLogs();
      alert("Progress updated successfully");
    } catch (err) {
      console.error(err);
      alert("Failed to update progress");
    }
  };

  const handleDelete = async (logId: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this progress entry? This will reverse the quantities in the Master Schedule.",
      )
    )
      return;
    try {
      await api.delete(`/execution/logs/${logId}`);
      fetchLogs();
      alert("Progress deleted successfully");
    } catch (err) {
      console.error(err);
      alert("Failed to delete progress");
    }
  };

  const colDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: "Date",
        field: "date",
        width: 120,
        valueFormatter: (p) => new Date(p.value).toLocaleDateString(),
      },
      {
        headerName: "Activity",
        field: "measurementElement.activity.activityName",
        flex: 1,
        valueGetter: (p) =>
          `${p.data.measurementElement?.activity?.activityCode || ""} ${p.data.measurementElement?.activity?.activityName || ""}`,
      },
      {
        headerName: "Resource / Item",
        field: "measurementElement.boqItem.description",
        flex: 1,
      },
      {
        headerName: "Qty",
        field: "executedQty",
        width: 120,
        cellRenderer: (params: any) => {
          if (editingLogId === params.data.id) {
            return (
              <div className="flex items-center gap-1 h-full">
                <input
                  type="number"
                  className="w-20 border rounded px-1 py-0.5 text-right text-xs"
                  value={editValue}
                  onChange={(e) => setEditValue(Number(e.target.value))}
                  autoFocus
                />
                <button
                  onClick={() => handleSaveEdit(params.data.id)}
                  className="text-success hover:text-green-800"
                >
                  <Save className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditingLogId(null)}
                  className="text-text-disabled hover:text-text-secondary"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          }
          return (
            <div className="text-right font-bold">
              {Number(params.value).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </div>
          );
        },
      },
      {
        headerName: "User",
        field: "updatedBy",
        width: 100,
        valueGetter: (p) => p.data.updatedBy || "System",
      },
      {
        headerName: "Actions",
        width: 100,
        pinned: "right",
        cellRenderer: (params: any) => (
          <div className="flex items-center gap-3 h-full">
            <button
              onClick={() => handleEdit(params.data)}
              className="text-primary hover:text-blue-800 transition-colors"
              title="Edit Entry"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(params.data.id)}
              className="text-error hover:text-red-800 transition-colors"
              title="Delete Entry"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ],
    [editingLogId, editValue],
  );

  return (
    <div className="flex flex-col h-full bg-surface-card">
      <div className="p-4 border-b border-border-default flex justify-between items-center bg-surface-base">
        <div>
          <h3 className="font-bold text-gray-800">Execution History Log</h3>
          <p className="text-xs text-text-muted">
            View and manage all previous progress entries for this project.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-surface-raised px-2 py-1 rounded text-text-secondary">
            {logs.length} Entries
          </span>
          <button
            onClick={fetchLogs}
            className="text-xs bg-surface-card border border-border-strong px-3 py-1.5 rounded hover:bg-surface-base transition-colors shadow-sm"
          >
            Refresh Log
          </button>
        </div>
      </div>
      <div className="flex-1 ag-theme-quartz ag-theme-setu w-full p-2">
        <AgGridReact
          rowData={logs}
          columnDefs={colDefs}
          defaultColDef={{ resizable: true, sortable: true, filter: true }}
          rowHeight={40}
        />
      </div>
    </div>
  );
};

export default ExecutionLogTable;
