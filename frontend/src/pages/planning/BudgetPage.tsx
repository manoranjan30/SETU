import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Wallet, RefreshCw, Plus, Upload, FileSpreadsheet } from "lucide-react";
import {
  budgetService,
  type Budget,
  type BudgetLineSummary,
  type BudgetSummary,
} from "../../services/budget.service";
import {
  planningService,
  type PlanningActivity,
} from "../../services/planning.service";
import { formatIndianNumber } from "../../utils/format";
import { downloadBlob, withFileExtension } from "../../utils/file-download.utils";

export default function BudgetPage() {
  const { projectId } = useParams();
  const pId = Number(projectId || 0);

  const [activeBudget, setActiveBudget] = useState<Budget | null>(null);
  const [lines, setLines] = useState<BudgetLineSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateBudget, setShowCreateBudget] = useState(false);
  const [showAddLine, setShowAddLine] = useState(false);
  const [editingLine, setEditingLine] = useState<BudgetLineSummary | null>(null);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [importing, setImporting] = useState(false);
  const [activeView, setActiveView] = useState<"lines" | "mapping">("lines");
  const [activities, setActivities] = useState<PlanningActivity[]>([]);
  const [wbsNodes, setWbsNodes] = useState<any[]>([]);
  const [mappingLine, setMappingLine] = useState<BudgetLineSummary | null>(null);
  const [mappingSelection, setMappingSelection] = useState<number[]>([]);
  const [mappingSaving, setMappingSaving] = useState(false);
  const [activitySearch, setActivitySearch] = useState("");
  const [createBudgetForm, setCreateBudgetForm] = useState({
    name: "",
    status: "DRAFT" as "DRAFT" | "ACTIVE",
  });
  const [lineForm, setLineForm] = useState({
    code: "",
    name: "",
    category: "",
    uom: "",
    qty: 0,
    rate: 0,
    amount: 0,
    notes: "",
    wbsNodeId: "",
    epsNodeId: "",
  });

  const load = async () => {
    if (!pId) return;
    setLoading(true);
    try {
      const data = await budgetService.listBudgets(pId);
      const active =
        data.find((b) => b.status === "ACTIVE") || data[0] || null;
      setActiveBudget(active);
      if (active) {
        const summaryData = await budgetService.getBudgetSummary(
          pId,
          active.id,
        );
        setSummary(summaryData);
        setLines(summaryData.lines || []);
      } else {
        setLines([]);
        setSummary(null);
      }
    } catch (e) {
      console.error("Failed to load budget", e);
      setLines([]);
      setActiveBudget(null);
    } finally {
      setLoading(false);
    }
  };

  const loadActivities = async () => {
    if (!pId) return;
    try {
      const [activityData, wbsData] = await Promise.all([
        planningService.getProjectActivities(pId),
        planningService.getWbsNodes(pId),
      ]);
      setActivities(activityData);
      setWbsNodes(wbsData);
    } catch (err) {
      console.error("Failed to load activities", err);
      setActivities([]);
      setWbsNodes([]);
    }
  };

  useEffect(() => {
    load();
  }, [pId]);

  useEffect(() => {
    if (activeBudget) {
      loadActivities();
    }
  }, [activeBudget?.id, pId]);

  const totalAmount = useMemo(
    () => lines.reduce((s, l) => s + Number(l.budgetAmount || 0), 0),
    [lines],
  );

  const wbsLabelMap = useMemo(() => {
    const map = new Map<number, string>();
    wbsNodes.forEach((node) => {
      const label = `${node.wbsCode || ""} ${node.wbsName || ""}`.trim();
      map.set(node.id, label || `WBS ${node.id}`);
    });
    return map;
  }, [wbsNodes]);

  const filteredActivities = useMemo(() => {
    const term = activitySearch.trim().toLowerCase();
    if (!term) return activities;
    return activities.filter((activity) => {
      const wbsLabel = wbsLabelMap.get(activity.wbsNodeId || 0) || "";
      return (
        activity.activityCode?.toLowerCase().includes(term) ||
        activity.activityName?.toLowerCase().includes(term) ||
        wbsLabel.toLowerCase().includes(term)
      );
    });
  }, [activities, activitySearch, wbsLabelMap]);

  const handleCreateBudget = async () => {
    if (!pId || !createBudgetForm.name.trim()) return;
    await budgetService.createBudget(pId, {
      name: createBudgetForm.name.trim(),
      status: createBudgetForm.status,
    });
    setShowCreateBudget(false);
    setCreateBudgetForm({ name: "", status: "DRAFT" });
    load();
  };

  const handleAddLine = async () => {
    if (!activeBudget) return;
    if (!lineForm.code.trim() || !lineForm.name.trim()) return;
    const qty = Number(lineForm.qty || 0);
    const rate = Number(lineForm.rate || 0);
    const amount =
      lineForm.amount && Number(lineForm.amount) > 0
        ? Number(lineForm.amount)
        : qty * rate;
    await budgetService.createBudgetLine(pId, activeBudget.id, {
      code: lineForm.code.trim(),
      name: lineForm.name.trim(),
      category: lineForm.category || null,
      uom: lineForm.uom || null,
      qty,
      rate,
      amount,
      notes: lineForm.notes || null,
      wbsNodeId: lineForm.wbsNodeId ? Number(lineForm.wbsNodeId) : null,
      epsNodeId: lineForm.epsNodeId ? Number(lineForm.epsNodeId) : null,
    });
    setShowAddLine(false);
    setLineForm({
      code: "",
      name: "",
      category: "",
      uom: "",
      qty: 0,
      rate: 0,
      amount: 0,
      notes: "",
      wbsNodeId: "",
      epsNodeId: "",
    });
    load();
  };

  const handleUpdateLine = async () => {
    if (!activeBudget || !editingLine) return;
    const qty = Number(lineForm.qty || 0);
    const rate = Number(lineForm.rate || 0);
    const amount =
      lineForm.amount && Number(lineForm.amount) > 0
        ? Number(lineForm.amount)
        : qty * rate;
    await budgetService.updateBudgetLine(pId, activeBudget.id, editingLine.id, {
      code: lineForm.code.trim(),
      name: lineForm.name.trim(),
      category: lineForm.category || null,
      uom: lineForm.uom || null,
      qty,
      rate,
      amount,
      notes: lineForm.notes || null,
      wbsNodeId: lineForm.wbsNodeId ? Number(lineForm.wbsNodeId) : null,
      epsNodeId: lineForm.epsNodeId ? Number(lineForm.epsNodeId) : null,
    });
    setEditingLine(null);
    setShowAddLine(false);
    load();
  };

  const handleDeleteLine = async (line: BudgetLineSummary) => {
    if (!activeBudget) return;
    const ok = window.confirm(
      "Delete this budget line? This cannot be undone.",
    );
    if (!ok) return;
    await budgetService.deleteBudgetLine(pId, activeBudget.id, line.id);
    load();
  };

  const handleUpdateBudgetTitle = async () => {
    if (!activeBudget || !createBudgetForm.name.trim()) return;
    await budgetService.updateBudget(pId, activeBudget.id, {
      name: createBudgetForm.name.trim(),
    });
    setShowCreateBudget(false);
    setCreateBudgetForm({ name: "", status: "DRAFT" });
    load();
  };

  const handleDeleteBudget = async () => {
    if (!activeBudget) return;
    const ok = window.confirm(
      "Delete this budget? If it has mapped BOQ items, deletion will be blocked.",
    );
    if (!ok) return;
    try {
      await budgetService.deleteBudget(pId, activeBudget.id);
      load();
    } catch (err: any) {
      alert(
        err?.response?.data?.message ||
          "Budget has mapped BOQ items. Clear mappings before deleting.",
      );
    }
  };

  const handleImport = async (file: File) => {
    if (!activeBudget) return;
    setImporting(true);
    try {
      const result = await budgetService.importBudgetLines(
        pId,
        activeBudget.id,
        file,
      );
      if (result.errors?.length) {
        alert(`Import completed with errors:\n${result.errors.join("\n")}`);
      }
      load();
    } finally {
      setImporting(false);
    }
  };

  const openMapping = (line: BudgetLineSummary) => {
    setMappingLine(line);
    setMappingSelection(line.activityIds || []);
    setActivitySearch("");
  };

  const handleSaveMapping = async () => {
    if (!activeBudget || !mappingLine) return;
    setMappingSaving(true);
    try {
      const existing = new Set(mappingLine.activityIds || []);
      const selected = new Set(mappingSelection);
      const toAdd = Array.from(selected).filter((id) => !existing.has(id));
      const toRemove = Array.from(existing).filter((id) => !selected.has(id));

      if (toAdd.length > 0) {
        await budgetService.addBudgetLineActivities(
          pId,
          activeBudget.id,
          mappingLine.id,
          toAdd,
        );
      }
      if (toRemove.length > 0) {
        await Promise.all(
          toRemove.map((activityId) =>
            budgetService.removeBudgetLineActivity(
              pId,
              activeBudget.id,
              mappingLine.id,
              activityId,
            ),
          ),
        );
      }
      setMappingLine(null);
      load();
    } finally {
      setMappingSaving(false);
    }
  };

  const toggleActivitySelection = (activityId: number) => {
    setMappingSelection((prev) =>
      prev.includes(activityId)
        ? prev.filter((id) => id !== activityId)
        : [...prev, activityId],
    );
  };

  const downloadTemplate = () => {
    const headers = [
      "code",
      "name",
      "category",
      "uom",
      "qty",
      "rate",
      "amount",
      "notes",
      "wbsNodeId",
      "epsNodeId",
    ];
    const csv = `${headers.join(",")}\n`;
    downloadBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      withFileExtension("budget_lines_template", ".csv"),
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-surface-base">
      <div className="bg-surface-card border-b border-border-default px-5 py-3 flex items-center gap-4 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <Wallet size={18} className="text-primary" />
          <h1 className="font-black text-lg text-text-primary tracking-tight">
            Budget
          </h1>
        </div>
        <div className="text-xs text-text-muted">
          {activeBudget
            ? `${activeBudget.name} - ${activeBudget.status}`
            : "No budget found"}
        </div>
        <button
          onClick={load}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border-default rounded-lg hover:bg-slate-100 text-text-secondary"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
        <button
          onClick={() => {
            setCreateBudgetForm({ name: "", status: "DRAFT" });
            setShowCreateBudget(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border-default rounded-lg hover:bg-slate-100 text-text-secondary"
        >
          <Plus size={13} />
          New Budget
        </button>
        {activeBudget && (
          <button
            onClick={() => {
              setCreateBudgetForm({
                name: activeBudget.name,
                status: "DRAFT",
              });
              setShowCreateBudget(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border-default rounded-lg hover:bg-slate-100 text-text-secondary"
          >
            Edit Title
          </button>
        )}
        {activeBudget && (
          <>
            <button
              onClick={() => {
                setEditingLine(null);
                setLineForm({
                  code: "",
                  name: "",
                  category: "",
                  uom: "",
                  qty: 0,
                  rate: 0,
                  amount: 0,
                  notes: "",
                  wbsNodeId: "",
                  epsNodeId: "",
                });
                setShowAddLine(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border-default rounded-lg hover:bg-slate-100 text-text-secondary"
            >
              <Plus size={13} />
              Add Line
            </button>
            <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border-default rounded-lg hover:bg-slate-100 text-text-secondary cursor-pointer">
              <Upload size={13} />
              {importing ? "Importing..." : "Import CSV"}
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImport(file);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border-default rounded-lg hover:bg-slate-100 text-text-secondary"
            >
              <FileSpreadsheet size={13} />
              Template
            </button>
            <button
              onClick={handleDeleteBudget}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border-default rounded-lg hover:bg-red-50 text-red-600"
            >
              Delete Budget
            </button>
          </>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
        {loading && (
          <div className="text-sm text-text-muted">Loading budget...</div>
        )}

        {!loading && !activeBudget && (
          <div className="text-sm text-text-muted">
            Create a budget to begin tracking budget lines.
          </div>
        )}

        {!loading && activeBudget && (
          <>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveView("lines")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${
                  activeView === "lines"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "border-border-default text-text-secondary hover:bg-slate-100"
                }`}
              >
                Budget Lines
              </button>
              <button
                onClick={() => setActiveView("mapping")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${
                  activeView === "mapping"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "border-border-default text-text-secondary hover:bg-slate-100"
                }`}
              >
                Schedule Mapping
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-surface-card border border-border-default rounded-2xl p-4">
                <div className="text-[10px] uppercase font-black text-text-disabled tracking-wider">
                  Budget Lines
                </div>
                <div className="text-2xl font-black text-text-primary">
                  {lines.length}
                </div>
              </div>
              <div className="bg-surface-card border border-border-default rounded-2xl p-4">
                <div className="text-[10px] uppercase font-black text-text-disabled tracking-wider">
                  Total Budget
                </div>
                <div className="text-2xl font-black text-text-primary">
                  INR {formatIndianNumber(summary?.totals?.budget || totalAmount)}
                </div>
              </div>
              <div className="bg-surface-card border border-border-default rounded-2xl p-4">
                <div className="text-[10px] uppercase font-black text-text-disabled tracking-wider">
                  BOQ Consumed
                </div>
                <div className="text-2xl font-black text-text-primary">
                  INR {formatIndianNumber(summary?.totals?.boq || 0)}
                </div>
              </div>
            </div>

            {activeView === "lines" && (
              <div className="bg-surface-card border border-border-default rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-border-default">
                  <h3 className="text-xs font-black uppercase tracking-wider text-text-disabled">
                    Budget Line Items
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-text-disabled">
                        <th className="px-4 py-2 text-left">Code</th>
                        <th className="px-4 py-2 text-left">Name</th>
                        <th className="px-4 py-2 text-right">Qty</th>
                        <th className="px-4 py-2 text-right">Rate</th>
                        <th className="px-4 py-2 text-right">Budget</th>
                        <th className="px-4 py-2 text-right">BOQ Consumed</th>
                        <th className="px-4 py-2 text-right">Available</th>
                        <th className="px-4 py-2 text-right">WBS</th>
                        <th className="px-4 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, idx) => (
                        (() => {
                          const consumed = Number(line.boqAmount || 0);
                          const available =
                            Number(line.budgetAmount || 0) - consumed;
                          const mapped = consumed > 0;
                          return (
                        <tr
                          key={line.id}
                          className={
                            idx % 2 === 0
                              ? "border-t border-border-default bg-surface-card"
                              : "border-t border-border-default bg-slate-50/50"
                          }
                        >
                          <td className="px-4 py-3 font-semibold text-text-primary">
                            {line.code}
                          </td>
                          <td className="px-4 py-3 text-text-secondary">
                            {line.name}
                          </td>
                          <td className="px-4 py-3 text-right text-text-secondary">
                            {formatIndianNumber(line.qty || 0)}
                          </td>
                          <td className="px-4 py-3 text-right text-text-secondary">
                            {formatIndianNumber(line.rate || 0)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-text-primary">
                            {formatIndianNumber(line.budgetAmount || 0)}
                          </td>
                          <td className="px-4 py-3 text-right text-text-secondary">
                            {formatIndianNumber(consumed)}
                          </td>
                          <td className="px-4 py-3 text-right text-text-secondary">
                            {formatIndianNumber(available)}
                          </td>
                          <td className="px-4 py-3 text-right text-text-muted">
                            {line.wbsNodeId ?? "-"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingLine(line);
                                  setShowAddLine(true);
                                  setLineForm({
                                    code: line.code,
                                    name: line.name,
                                    category: line.category || "",
                                    uom: line.uom || "",
                                    qty: line.qty || 0,
                                    rate: line.rate || 0,
                                    amount: line.budgetAmount || 0,
                                    notes: line.notes || "",
                                    wbsNodeId: line.wbsNodeId?.toString() || "",
                                    epsNodeId: line.epsNodeId?.toString() || "",
                                  });
                                }}
                                disabled={mapped}
                                className="text-xs px-2 py-1 rounded border border-border-default text-text-secondary disabled:opacity-40"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteLine(line)}
                                disabled={mapped}
                                className="text-xs px-2 py-1 rounded border border-border-default text-red-600 disabled:opacity-40"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                          );
                        })()
                      ))}
                      {lines.length === 0 && (
                        <tr>
                          <td
                            colSpan={9}
                            className="px-4 py-8 text-center text-text-muted"
                          >
                            No budget lines available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeView === "mapping" && (
              <div className="bg-surface-card border border-border-default rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-border-default">
                  <h3 className="text-xs font-black uppercase tracking-wider text-text-disabled">
                    Schedule Mapping
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-text-disabled">
                        <th className="px-4 py-2 text-left">Code</th>
                        <th className="px-4 py-2 text-left">Name</th>
                        <th className="px-4 py-2 text-right">Activities</th>
                        <th className="px-4 py-2 text-left">Timeline</th>
                        <th className="px-4 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, idx) => {
                        const activityCount = line.activityIds?.length || 0;
                        const start = line.timelineStart
                          ? new Date(line.timelineStart).toLocaleDateString("en-IN")
                          : "-";
                        const end = line.timelineEnd
                          ? new Date(line.timelineEnd).toLocaleDateString("en-IN")
                          : "-";
                        return (
                          <tr
                            key={line.id}
                            className={
                              idx % 2 === 0
                                ? "border-t border-border-default bg-surface-card"
                                : "border-t border-border-default bg-slate-50/50"
                            }
                          >
                            <td className="px-4 py-3 font-semibold text-text-primary">
                              {line.code}
                            </td>
                            <td className="px-4 py-3 text-text-secondary">
                              {line.name}
                            </td>
                            <td className="px-4 py-3 text-right text-text-secondary">
                              {activityCount}
                            </td>
                            <td className="px-4 py-3 text-text-muted">
                              {start} {start !== "-" || end !== "-" ? "->" : ""}{" "}
                              {end}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => openMapping(line)}
                                className="text-xs px-2 py-1 rounded border border-border-default text-text-secondary"
                              >
                                Map Activities
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {lines.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-8 text-center text-text-muted"
                          >
                            No budget lines available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showCreateBudget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-black text-text-primary">
              {activeBudget ? "Edit Budget Title" : "Create Budget"}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-muted">Name</label>
                <input
                  value={createBudgetForm.name}
                  onChange={(e) =>
                    setCreateBudgetForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  className="w-full border border-border-default rounded-lg px-3 py-2 text-sm"
                  placeholder="Budget name"
                />
              </div>
              {!activeBudget && (
                <div>
                  <label className="text-xs text-text-muted">Status</label>
                  <select
                    value={createBudgetForm.status}
                    onChange={(e) =>
                      setCreateBudgetForm((prev) => ({
                        ...prev,
                        status: e.target.value as "DRAFT" | "ACTIVE",
                      }))
                    }
                    className="w-full border border-border-default rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="DRAFT">DRAFT</option>
                    <option value="ACTIVE">ACTIVE</option>
                  </select>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowCreateBudget(false)}
                className="px-4 py-2 text-sm border border-border-default rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={activeBudget ? handleUpdateBudgetTitle : handleCreateBudget}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg"
              >
                {activeBudget ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddLine && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 space-y-4">
            <h3 className="text-lg font-black text-text-primary">
              {editingLine ? "Edit Budget Line" : "Add Budget Line"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text-muted">Code</label>
                <input
                  value={lineForm.code}
                  onChange={(e) =>
                    setLineForm((prev) => ({ ...prev, code: e.target.value }))
                  }
                  className="w-full border border-border-default rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted">Name</label>
                <input
                  value={lineForm.name}
                  onChange={(e) =>
                    setLineForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full border border-border-default rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted">Category</label>
                <input
                  value={lineForm.category}
                  onChange={(e) =>
                    setLineForm((prev) => ({
                      ...prev,
                      category: e.target.value,
                    }))
                  }
                  className="w-full border border-border-default rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted">UOM</label>
                <input
                  value={lineForm.uom}
                  onChange={(e) =>
                    setLineForm((prev) => ({ ...prev, uom: e.target.value }))
                  }
                  className="w-full border border-border-default rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted">Qty</label>
                <input
                  type="number"
                  value={lineForm.qty}
                  onChange={(e) =>
                    setLineForm((prev) => ({
                      ...prev,
                      qty: Number.isNaN(e.target.valueAsNumber)
                        ? 0
                        : e.target.valueAsNumber,
                    }))
                  }
                  className="w-full border border-border-default rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted">Rate</label>
                <input
                  type="number"
                  value={lineForm.rate}
                  onChange={(e) =>
                    setLineForm((prev) => ({
                      ...prev,
                      rate: Number.isNaN(e.target.valueAsNumber)
                        ? 0
                        : e.target.valueAsNumber,
                    }))
                  }
                  className="w-full border border-border-default rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted">Amount</label>
                <input
                  type="number"
                  value={lineForm.amount}
                  onChange={(e) =>
                    setLineForm((prev) => ({
                      ...prev,
                      amount: Number.isNaN(e.target.valueAsNumber)
                        ? 0
                        : e.target.valueAsNumber,
                    }))
                  }
                  className="w-full border border-border-default rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted">Notes</label>
                <input
                  value={lineForm.notes}
                  onChange={(e) =>
                    setLineForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  className="w-full border border-border-default rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted">WBS Node ID</label>
                <input
                  value={lineForm.wbsNodeId}
                  onChange={(e) =>
                    setLineForm((prev) => ({
                      ...prev,
                      wbsNodeId: e.target.value,
                    }))
                  }
                  className="w-full border border-border-default rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted">EPS Node ID</label>
                <input
                  value={lineForm.epsNodeId}
                  onChange={(e) =>
                    setLineForm((prev) => ({
                      ...prev,
                      epsNodeId: e.target.value,
                    }))
                  }
                  className="w-full border border-border-default rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowAddLine(false);
                  setEditingLine(null);
                }}
                className="px-4 py-2 text-sm border border-border-default rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={editingLine ? handleUpdateLine : handleAddLine}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg"
              >
                {editingLine ? "Save Changes" : "Save Line"}
              </button>
            </div>
          </div>
        </div>
      )}

      {mappingLine && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6 space-y-4">
            <div>
              <h3 className="text-lg font-black text-text-primary">
                Map Activities — {mappingLine.code}
              </h3>
              <p className="text-xs text-text-muted">
                Select schedule activities linked to this budget line.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                className="w-full border border-border-default rounded-lg px-3 py-2 text-sm"
                placeholder="Search by activity code, name, or WBS..."
              />
              <button
                onClick={() => setMappingSelection([])}
                className="px-3 py-2 text-xs border border-border-default rounded-lg text-text-secondary"
              >
                Clear
              </button>
            </div>
            <div className="border border-border-default rounded-xl max-h-[360px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wider text-text-disabled">
                  <tr>
                    <th className="px-4 py-2 text-left">Select</th>
                    <th className="px-4 py-2 text-left">Activity</th>
                    <th className="px-4 py-2 text-left">WBS</th>
                    <th className="px-4 py-2 text-left">Start</th>
                    <th className="px-4 py-2 text-left">Finish</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActivities.map((activity, idx) => {
                    const checked = mappingSelection.includes(activity.id);
                    const wbsLabel =
                      wbsLabelMap.get(activity.wbsNodeId || 0) || "-";
                    const start = activity.startDatePlanned
                      ? new Date(activity.startDatePlanned).toLocaleDateString(
                          "en-IN",
                        )
                      : "-";
                    const end = activity.finishDatePlanned
                      ? new Date(activity.finishDatePlanned).toLocaleDateString(
                          "en-IN",
                        )
                      : "-";
                    return (
                      <tr
                        key={activity.id}
                        className={
                          idx % 2 === 0
                            ? "border-t border-border-default bg-white"
                            : "border-t border-border-default bg-slate-50/50"
                        }
                      >
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleActivitySelection(activity.id)}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <div className="font-semibold text-text-primary">
                            {activity.activityCode}
                          </div>
                          <div className="text-[11px] text-text-muted">
                            {activity.activityName}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-text-secondary text-xs">
                          {wbsLabel}
                        </td>
                        <td className="px-4 py-2 text-text-secondary text-xs">
                          {start}
                        </td>
                        <td className="px-4 py-2 text-text-secondary text-xs">
                          {end}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredActivities.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-6 text-center text-text-muted"
                      >
                        No activities match this search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setMappingLine(null)}
                className="px-4 py-2 text-sm border border-border-default rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMapping}
                disabled={mappingSaving}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg disabled:opacity-60"
              >
                {mappingSaving ? "Saving..." : "Save Mapping"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
