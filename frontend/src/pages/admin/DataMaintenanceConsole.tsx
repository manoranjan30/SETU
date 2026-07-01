import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Database,
  History,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
} from "lucide-react";
import api from "../../api/axios";
import { PermissionCode } from "../../config/permissions";
import { useAuth } from "../../context/AuthContext";

type TableSummary = {
  tableName: string;
  estimatedRows: string | number;
  isEditable: boolean;
  reason?: string | null;
};

type ColumnMeta = {
  name: string;
  dataType: string;
  udtName: string;
  isNullable: boolean;
  isPrimary: boolean;
  isEditable: boolean;
};

type RowResponse = {
  tableName: string;
  primaryKeyColumn: string | null;
  columns: ColumnMeta[];
  rows: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
  isEditable: boolean;
};

type Correction = {
  id: number;
  tableName: string;
  primaryKeyColumn: string;
  primaryKeyValue: string;
  actionType: "UPDATE" | "REVERT";
  changedFields: Record<string, { before: unknown; after: unknown }>;
  reason: string;
  revertedFromCorrectionId?: number | null;
  createdByName?: string | null;
  ipAddress?: string | null;
  createdAt: string;
};

const stringifyCell = (value: unknown) => {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const editableValue = (value: unknown) => {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
};

export default function DataMaintenanceConsole() {
  const { hasPermission } = useAuth();
  const canUpdate = hasPermission(PermissionCode.ADMIN_DATA_EDITOR_UPDATE);
  const canRevert = hasPermission(PermissionCode.ADMIN_DATA_EDITOR_REVERT);
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [tableFilter, setTableFilter] = useState("");
  const [selectedTable, setSelectedTable] = useState("");
  const [rowsData, setRowsData] = useState<RowResponse | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(
    null,
  );
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [revertReasonById, setRevertReasonById] = useState<Record<number, string>>(
    {},
  );

  const loadTables = async () => {
    const res = await api.get<TableSummary[]>("/admin/data-maintenance/tables");
    setTables(res.data);
    if (!selectedTable && res.data.length) {
      const firstEditable =
        res.data.find((table) => table.tableName === "quality_inspections") ||
        res.data.find((table) => table.isEditable) ||
        res.data[0];
      setSelectedTable(firstEditable.tableName);
    }
  };

  const loadRows = async () => {
    if (!selectedTable) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<RowResponse>(
        `/admin/data-maintenance/tables/${selectedTable}/rows`,
        { params: { limit: 50, offset: 0, q: query || undefined } },
      );
      setRowsData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load table rows.");
    } finally {
      setLoading(false);
    }
  };

  const loadCorrections = async () => {
    const res = await api.get<Correction[]>("/admin/data-maintenance/corrections", {
      params: { tableName: selectedTable || undefined },
    });
    setCorrections(res.data);
  };

  useEffect(() => {
    loadTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      loadRows();
      loadCorrections();
      setSelectedRow(null);
    }
  }, [selectedTable]);

  const filteredTables = useMemo(
    () =>
      tables.filter((table) =>
        table.tableName.toLowerCase().includes(tableFilter.toLowerCase()),
      ),
    [tables, tableFilter],
  );

  const primaryKeyColumn = rowsData?.primaryKeyColumn || "id";
  const visibleColumns = useMemo(() => {
    const columns = rowsData?.columns || [];
    const important = columns.filter((column) =>
      [primaryKeyColumn, "id", "name", "status", "projectId", "activityId"].includes(
        column.name,
      ),
    );
    return [...important, ...columns.filter((column) => !important.includes(column))]
      .slice(0, 8);
  }, [rowsData, primaryKeyColumn]);

  const openEditor = (row: Record<string, unknown>) => {
    setSelectedRow(row);
    const nextDraft: Record<string, string> = {};
    (rowsData?.columns || [])
      .filter((column) => column.isEditable)
      .forEach((column) => {
        nextDraft[column.name] = editableValue(row[column.name]);
      });
    setDraft(nextDraft);
    setReason("");
  };

  const saveRow = async () => {
    if (!selectedRow || !rowsData?.primaryKeyColumn) return;
    const changes: Record<string, unknown> = {};
    for (const column of rowsData.columns.filter((col) => col.isEditable)) {
      const original = editableValue(selectedRow[column.name]);
      const next = draft[column.name] ?? "";
      if (next !== original) {
        changes[column.name] = next;
      }
    }
    if (!Object.keys(changes).length) {
      setError("No changed fields found.");
      return;
    }
    setError(null);
    try {
      await api.patch(
        `/admin/data-maintenance/tables/${selectedTable}/rows/${selectedRow[rowsData.primaryKeyColumn]}`,
        { changes, reason },
      );
      setSelectedRow(null);
      await loadRows();
      await loadCorrections();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to save correction.");
    }
  };

  const revertCorrection = async (correction: Correction) => {
    const reasonText = revertReasonById[correction.id] || "";
    setError(null);
    try {
      await api.post(
        `/admin/data-maintenance/corrections/${correction.id}/revert`,
        { reason: reasonText },
      );
      await loadRows();
      await loadCorrections();
      setRevertReasonById((prev) => ({ ...prev, [correction.id]: "" }));
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to revert correction.");
    }
  };

  return (
    <div className="min-h-screen bg-surface-base p-6 text-text-primary">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Data Maintenance Console</h1>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-text-muted">
            Controlled production data correction with immutable before/after
            history and revert-by-new-correction.
          </p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
          Reason is mandatory. Primary keys and protected fields are locked.
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-[320px_1fr] gap-5">
        <aside className="rounded-lg border border-border-default bg-surface-card p-4">
          <label className="mb-2 block text-xs font-semibold uppercase text-text-muted">
            Tables
          </label>
          <div className="mb-3 flex items-center gap-2 rounded border border-border-default px-2">
            <Search className="h-4 w-4 text-text-muted" />
            <input
              value={tableFilter}
              onChange={(event) => setTableFilter(event.target.value)}
              className="w-full bg-transparent py-2 text-sm outline-none"
              placeholder="Search table"
            />
          </div>
          <div className="max-h-[70vh] space-y-1 overflow-y-auto pr-1">
            {filteredTables.map((table) => (
              <button
                key={table.tableName}
                onClick={() => setSelectedTable(table.tableName)}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                  selectedTable === table.tableName
                    ? "border-primary bg-primary-muted text-primary"
                    : "border-transparent hover:bg-surface-base"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">{table.tableName}</span>
                  {table.isEditable ? (
                    <ShieldCheck className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  )}
                </div>
                <div className="mt-1 text-xs text-text-muted">
                  Rows: {table.estimatedRows || 0}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="space-y-5">
          <section className="rounded-lg border border-border-default bg-surface-card p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">{selectedTable}</h2>
                <p className="text-xs text-text-muted">
                  {rowsData?.isEditable
                    ? "Editable through audited correction only."
                    : "Protected table. Read-only."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && loadRows()}
                  className="rounded border border-border-default px-3 py-2 text-sm"
                  placeholder="Search row JSON"
                />
                <button
                  onClick={loadRows}
                  className="rounded bg-primary px-4 py-2 text-sm font-semibold text-white"
                >
                  Search
                </button>
              </div>
            </div>

            <div className="overflow-auto rounded border border-border-subtle">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-base text-xs uppercase text-text-muted">
                  <tr>
                    {visibleColumns.map((column) => (
                      <th key={column.name} className="px-3 py-2 text-left">
                        {column.name}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-3 py-5 text-center" colSpan={9}>
                        Loading rows...
                      </td>
                    </tr>
                  ) : (
                    rowsData?.rows.map((row, index) => (
                      <tr key={index} className="border-t border-border-subtle">
                        {visibleColumns.map((column) => (
                          <td
                            key={column.name}
                            className="max-w-[220px] truncate px-3 py-2"
                            title={stringifyCell(row[column.name])}
                          >
                            {stringifyCell(row[column.name])}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => openEditor(row)}
                            disabled={!rowsData.isEditable || !canUpdate}
                            className="rounded border border-primary px-3 py-1 text-xs font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-2 text-xs text-text-muted">
              Showing {rowsData?.rows.length || 0} of {rowsData?.total || 0} rows.
            </div>
          </section>

          <section className="rounded-lg border border-border-default bg-surface-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Correction History</h2>
            </div>
            <div className="space-y-3">
              {corrections.map((correction) => (
                <div
                  key={correction.id}
                  className="rounded-lg border border-border-subtle bg-surface-base p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">
                        #{correction.id} {correction.actionType} on{" "}
                        {correction.tableName}.{correction.primaryKeyValue}
                      </div>
                      <div className="mt-1 text-xs text-text-muted">
                        {new Date(correction.createdAt).toLocaleString()} by{" "}
                        {correction.createdByName || "Unknown"}{" "}
                        {correction.ipAddress ? `from ${correction.ipAddress}` : ""}
                      </div>
                      <div className="mt-2 text-sm">{correction.reason}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {Object.keys(correction.changedFields || {}).map((field) => (
                          <span
                            key={field}
                            className="rounded bg-primary-muted px-2 py-0.5 text-xs text-primary"
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>
                    {canRevert && correction.actionType !== "REVERT" && (
                      <div className="w-80">
                        <input
                          value={revertReasonById[correction.id] || ""}
                          onChange={(event) =>
                            setRevertReasonById((prev) => ({
                              ...prev,
                              [correction.id]: event.target.value,
                            }))
                          }
                          className="mb-2 w-full rounded border border-border-default px-3 py-2 text-xs"
                          placeholder="Reason for revert"
                        />
                        <button
                          onClick={() => revertCorrection(correction)}
                          className="flex w-full items-center justify-center gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Revert by New Correction
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {corrections.length === 0 && (
                <div className="rounded border border-dashed border-border-default p-6 text-center text-sm text-text-muted">
                  No corrections recorded for this table yet.
                </div>
              )}
            </div>
          </section>
        </main>
      </div>

      {selectedRow && rowsData && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-6">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-lg bg-surface-card shadow-2xl">
            <div className="border-b border-border-default p-4">
              <h2 className="text-lg font-bold">
                Edit {selectedTable} #{stringifyCell(selectedRow[primaryKeyColumn])}
              </h2>
              <p className="text-xs text-text-muted">
                Only editable fields are shown. This action will create immutable
                correction history.
              </p>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-4 overflow-y-auto p-4">
              {rowsData.columns
                .filter((column) => column.isEditable)
                .map((column) => (
                  <label key={column.name} className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase text-text-muted">
                      {column.name}{" "}
                      <span className="font-normal normal-case">
                        ({column.dataType})
                      </span>
                    </span>
                    <textarea
                      value={draft[column.name] || ""}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          [column.name]: event.target.value,
                        }))
                      }
                      rows={column.dataType.includes("json") ? 6 : 2}
                      className="w-full rounded border border-border-default px-3 py-2 font-mono text-xs"
                    />
                  </label>
                ))}
            </div>
            <div className="border-t border-border-default p-4">
              <label className="mb-2 block text-xs font-semibold uppercase text-text-muted">
                Mandatory correction reason
              </label>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                className="mb-3 w-full rounded border border-border-default px-3 py-2 text-sm"
                placeholder="Explain why this correction is required."
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setSelectedRow(null)}
                  className="rounded border border-border-default px-4 py-2 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={saveRow}
                  className="flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-semibold text-white"
                >
                  <Save className="h-4 w-4" />
                  Save Correction
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
