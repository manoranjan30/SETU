import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  GitBranch,
  PlayCircle,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  type ApprovalContextDto,
  type ApproverMode,
  type ConditionOperator,
  type ReleaseStrategyConditionDto,
  type ReleaseStrategyDto,
  type ReleaseStrategyStepDto,
  releaseStrategyService,
} from "../../services/releaseStrategy.service";
import { PermissionCode } from "../../config/permissions";

const MODULE_OPTIONS = ["QUALITY", "PLANNING", "BOQ", "WORKORDER", "MICRO", "EXECUTION", "EHS", "DESIGN"];
const PROCESS_OPTIONS = ["RFI_APPROVAL", "INSPECTION_APPROVAL", "QA_QC_APPROVAL", "OBSERVATION_RECTIFICATION_APPROVAL", "MICRO_SCHEDULE_APPROVAL", "WORK_ORDER_RELEASE", "BOQ_CHANGE_APPROVAL", "LOOKAHEAD_RELEASE", "DOCUMENT_RELEASE"];
const DOCUMENT_TYPES = ["FLOOR_RFI", "UNIT_RFI", "ROOM_RFI", "INSPECTION", "QA_QC_CHECKLIST", "OBSERVATION_RECTIFICATION", "MICRO_SCHEDULE", "WORK_ORDER", "BOQ_CHANGE", "LOOKAHEAD", "DRAWING"];
const OPERATOR_OPTIONS: ConditionOperator[] = ["EQ", "NE", "IN", "NOT_IN", "GT", "GTE", "LT", "LTE", "BETWEEN", "EXISTS", "NOT_EXISTS"];
const APPROVER_MODES: ApproverMode[] = ["USER", "PROJECT_ROLE"];

const blankStrategy = (): ReleaseStrategyDto => ({
  name: "",
  moduleCode: "QUALITY",
  processCode: "RFI_APPROVAL",
  documentType: "FLOOR_RFI",
  priority: 100,
  status: "DRAFT",
  version: 1,
  isDefault: false,
  restartPolicy: "RESTART_FROM_LEVEL_1",
  description: "",
  conditions: [],
  steps: [
    {
      levelNo: 1,
      stepName: "Level 1 Approval",
      approverMode: "PROJECT_ROLE",
      roleId: null,
      userId: null,
      userIds: [],
      minApprovalsRequired: 1,
      canDelegate: false,
      escalationDays: null,
      sequence: 1,
    },
  ],
});

const statusBadge: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  ACTIVE: "bg-success-muted text-emerald-700",
  INACTIVE: "bg-warning-muted text-amber-700",
  ARCHIVED: "bg-surface-raised text-text-muted",
};

export default function ReleaseStrategyPage() {
  const { projectId } = useParams();
  const pId = Number(projectId);
  const { hasPermission } = useAuth();
  const canWrite = hasPermission(PermissionCode.RELEASE_STRATEGY_WRITE);
  const canActivate = hasPermission(PermissionCode.RELEASE_STRATEGY_ACTIVATE);
  const canSimulate = hasPermission(PermissionCode.RELEASE_STRATEGY_SIMULATE);

  const [strategies, setStrategies] = useState<ReleaseStrategyDto[]>([]);
  const [actors, setActors] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<ReleaseStrategyDto>(blankStrategy());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [simulation, setSimulation] = useState<ApprovalContextDto>({
    projectId: pId,
    moduleCode: "QUALITY",
    processCode: "RFI_APPROVAL",
    documentType: "FLOOR_RFI",
    documentId: null,
    initiatorUserId: null,
    amount: null,
    epsNodeId: null,
    vendorId: null,
    workOrderId: null,
    initiatorRoleId: null,
    extraAttributes: {},
  });
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadAll = async () => {
    if (!pId) return;
    setLoading(true);
    try {
      const [strategyList, actorList, conflictList] = await Promise.all([
        releaseStrategyService.list(pId),
        releaseStrategyService.getActors(pId),
        releaseStrategyService.getConflicts(pId),
      ]);
      setStrategies(strategyList);
      setActors(actorList);
      setConflicts(conflictList);
      if (strategyList.length > 0 && !selectedId) {
        void selectStrategy(strategyList[0]);
      }
    } catch (error) {
      console.error("Failed to load release strategy data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, [pId]);

  const selectStrategy = async (strategy: ReleaseStrategyDto) => {
    if (!strategy.id) return;
    const detail = await releaseStrategyService.get(pId, strategy.id);
    setSelectedId(detail.id || null);
    setForm({
      ...detail,
      conditions: (detail.conditions || []).map((condition, index) => ({
        ...condition,
        sequence: condition.sequence ?? index + 1,
      })),
      steps: (detail.steps || []).map((step, index) => ({
        ...step,
        userIds: step.userIds || (step.userId ? [step.userId] : []),
        levelNo: step.levelNo ?? index + 1,
        sequence: step.sequence ?? index + 1,
      })),
    });
    setSimulation((prev) => ({
      ...prev,
      projectId: pId,
      moduleCode: detail.moduleCode,
      processCode: detail.processCode,
      documentType: detail.documentType || "",
    }));
  };

  const filteredStrategies = useMemo(
    () =>
      strategies.filter((strategy) => {
        if (statusFilter && strategy.status !== statusFilter) return false;
        if (!search.trim()) return true;
        const needle = search.toLowerCase();
        return [strategy.name, strategy.moduleCode, strategy.processCode, strategy.documentType]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      }),
    [search, statusFilter, strategies],
  );

  const roleOptions = useMemo(() => {
    const roleMap = new Map<number, string>();
    actors.forEach((actor) =>
      actor.projectRoleIds.forEach((id: number, index: number) => {
        roleMap.set(
          id,
          actor.projectRoleNames?.[index] || actor.primaryRoleLabel || `Role ${id}`,
        );
      }),
    );
    return Array.from(roleMap.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name }));
  }, [actors]);

  const readiness = useMemo(() => {
    return [
      { label: "Strategy name entered", ok: !!form.name.trim() },
      { label: "At least one approval level", ok: !!form.steps?.length },
      {
        label: "All steps have assignee definitions",
        ok: (form.steps || []).every((step) =>
          step.approverMode === "USER"
            ? !!(step.userIds || []).length || !!step.userId
            : !!step.roleId,
        ),
      },
      {
        label: "Every step resolves at least one active actor",
        ok: (form.steps || []).every((step) =>
          step.approverMode === "USER"
            ? actors.some((actor) =>
                (step.userIds || (step.userId ? [step.userId] : [])).includes(
                  actor.userId,
                ),
              )
            : actors.some((actor) =>
                actor.projectRoleIds.includes(step.roleId ?? -1),
              ),
        ),
      },
      {
        label: "No active conflict blocks this strategy",
        ok:
          !form.id ||
          !conflicts.some((conflict) => conflict.strategyIds.includes(form.id)),
      },
    ];
  }, [actors, conflicts, form]);

  const updateCondition = (index: number, patch: Partial<ReleaseStrategyConditionDto>) => {
    setForm((prev) => ({
      ...prev,
      conditions: (prev.conditions || []).map((condition, currentIndex) =>
        currentIndex === index ? { ...condition, ...patch } : condition,
      ),
    }));
  };

  const updateStep = (index: number, patch: Partial<ReleaseStrategyStepDto>) => {
    setForm((prev) => ({
      ...prev,
      steps: (prev.steps || []).map((step, currentIndex) =>
        currentIndex === index ? { ...step, ...patch } : step,
      ),
    }));
  };

  const saveStrategy = async () => {
    try {
      const payload: ReleaseStrategyDto = {
        ...form,
        priority: Number(form.priority || 0),
        conditions: (form.conditions || []).map((condition, index) => ({
          ...condition,
          sequence: index + 1,
        })),
        steps: (form.steps || []).map((step, index) => ({
          ...step,
          userIds:
            step.approverMode === "USER"
              ? Array.from(
                  new Set(
                    (step.userIds || [])
                      .map((userId) => Number(userId))
                      .filter((userId) => Number.isFinite(userId) && userId > 0),
                  ),
                )
              : [],
          userId:
            step.approverMode === "USER"
              ? (
                  step.userIds?.length
                    ? step.userIds
                    : step.userId
                      ? [step.userId]
                      : []
                ).find(Boolean) || null
              : null,
          roleId: step.approverMode === "PROJECT_ROLE" ? step.roleId : null,
          levelNo: index + 1,
          sequence: index + 1,
        })),
      };
      const saved = form.id
        ? await releaseStrategyService.update(pId, form.id, payload)
        : await releaseStrategyService.create(pId, payload);
      await loadAll();
      if (saved.id) {
        await selectStrategy(saved);
      }
      alert("Release strategy saved.");
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to save release strategy.");
    }
  };

  const runSimulation = async () => {
    if (!form.id) return;
    try {
      const result = await releaseStrategyService.simulate(pId, form.id, simulation);
      setSimulationResult(result);
    } catch (error: any) {
      alert(error.response?.data?.message || "Simulation failed.");
    }
  };

  const activeConflict = conflicts.find(
    (conflict) => form.id && conflict.strategyIds.includes(form.id),
  );

  return (
    <div className="grid h-full grid-cols-12 gap-4">
      <section className="col-span-12 rounded-2xl border border-border-default bg-surface-card p-4 shadow-sm xl:col-span-3">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Release Strategies</h2>
            <p className="text-sm text-text-muted">Project-scoped approval strategy master</p>
          </div>
          {canWrite && (
            <button
              onClick={() => {
                setSelectedId(null);
                setForm(blankStrategy());
                setSimulationResult(null);
              }}
              className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" /> New
            </button>
          )}
        </div>

        <div className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-text-disabled" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search strategy"
              className="w-full rounded-lg border border-border-default bg-surface-base py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
          {filteredStrategies.map((strategy) => (
            <button
              key={strategy.id}
              onClick={() => void selectStrategy(strategy)}
              className={`w-full rounded-xl border p-3 text-left transition-colors ${
                selectedId === strategy.id
                  ? "border-secondary bg-secondary-muted"
                  : "border-border-default bg-surface-base hover:border-secondary"
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="font-semibold text-text-primary">{strategy.name}</div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusBadge[strategy.status || "DRAFT"]}`}>
                  {strategy.status}
                </span>
              </div>
              <div className="text-xs text-text-muted">
                {strategy.moduleCode} / {strategy.processCode}
              </div>
              <div className="mt-1 text-xs text-text-disabled">
                Priority {strategy.priority} • V{strategy.version || 1}
              </div>
            </button>
          ))}
          {!loading && filteredStrategies.length === 0 && (
            <div className="rounded-xl border border-dashed border-border-default p-4 text-sm text-text-muted">
              No strategies found for this project.
            </div>
          )}
        </div>
      </section>

      <section className="col-span-12 space-y-4 xl:col-span-6">
        <div className="rounded-2xl border border-border-default bg-surface-card p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-text-primary">Strategy Builder</h2>
              <p className="text-sm text-text-muted">
                Sequential release strategy with condition matching
              </p>
            </div>
            {canWrite && (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => void saveStrategy()} className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-white">
                  <Save className="h-4 w-4" /> Save
                </button>
                {form.id && (
                  <>
                    <button
                      onClick={async () => {
                        await releaseStrategyService.clone(pId, form.id!);
                        await loadAll();
                      }}
                      className="flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-sm"
                    >
                      <Copy className="h-4 w-4" /> Clone
                    </button>
                    {canActivate && (
                      <button
                        onClick={async () => {
                          try {
                            if (form.status === "ACTIVE") {
                              await releaseStrategyService.deactivate(pId, form.id!);
                            } else {
                              await releaseStrategyService.activate(pId, form.id!);
                            }
                            await loadAll();
                            await selectStrategy({ ...form, id: form.id });
                          } catch (error: any) {
                            alert(error.response?.data?.message || "Activation update failed.");
                          }
                        }}
                        className="flex items-center gap-2 rounded-lg border border-primary px-3 py-2 text-sm text-primary"
                      >
                        <PlayCircle className="h-4 w-4" />
                        {form.status === "ACTIVE" ? "Deactivate" : "Activate"}
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        if (!confirm("Delete this release strategy?")) return;
                        await releaseStrategyService.remove(pId, form.id!);
                        setSelectedId(null);
                        setForm(blankStrategy());
                        await loadAll();
                      }}
                      className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-error"
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-text-secondary">Name</span>
              <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-text-secondary">Priority</span>
              <input type="number" value={form.priority ?? 100} onChange={(e) => setForm((prev) => ({ ...prev, priority: Number(e.target.value) }))} className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-text-secondary">Module</span>
              <select value={form.moduleCode} onChange={(e) => setForm((prev) => ({ ...prev, moduleCode: e.target.value }))} className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2">
                {MODULE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-text-secondary">Process</span>
              <select value={form.processCode} onChange={(e) => setForm((prev) => ({ ...prev, processCode: e.target.value }))} className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2">
                {PROCESS_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-text-secondary">Document Type</span>
              <select value={form.documentType || ""} onChange={(e) => setForm((prev) => ({ ...prev, documentType: e.target.value }))} className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2">
                <option value="">Any</option>
                {DOCUMENT_TYPES.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-text-secondary">Restart Policy</span>
              <select value={form.restartPolicy} onChange={(e) => setForm((prev) => ({ ...prev, restartPolicy: e.target.value as ReleaseStrategyDto["restartPolicy"] }))} className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2">
                <option value="RESTART_FROM_LEVEL_1">Restart From Level 1</option>
                <option value="NO_RESTART">No Restart</option>
              </select>
            </label>
          </div>

          <label className="mt-3 block text-sm">
            <span className="mb-1 block font-medium text-text-secondary">Description</span>
            <textarea value={form.description || ""} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} rows={3} className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2" />
          </label>

          <div className="mt-4 flex items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.isDefault || false} onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))} />
              Default strategy for unmatched documents
            </label>
            {activeConflict && (
              <span className="rounded-lg bg-error-muted px-3 py-1 text-xs text-error">
                Conflict: {activeConflict.reason}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border-default bg-surface-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-bold text-text-primary">Condition Rules</h3>
            {canWrite && (
              <button
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    conditions: [
                      ...(prev.conditions || []),
                      {
                        fieldKey: "amount",
                        operator: "BETWEEN",
                        valueFrom: "",
                        valueTo: "",
                        sequence: (prev.conditions?.length || 0) + 1,
                      },
                    ],
                  }))
                }
                className="rounded-lg border border-border-default px-3 py-2 text-sm"
              >
                + Add Condition
              </button>
            )}
          </div>
          <div className="space-y-3">
            {(form.conditions || []).map((condition, index) => (
              <div
                key={`${condition.fieldKey}-${index}`}
                className="grid gap-2 rounded-xl border border-border-subtle bg-surface-base p-3 md:grid-cols-5"
              >
                <input
                  value={condition.fieldKey}
                  onChange={(e) => updateCondition(index, { fieldKey: e.target.value })}
                  placeholder="fieldKey"
                  className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                />
                <select
                  value={condition.operator}
                  onChange={(e) =>
                    updateCondition(index, { operator: e.target.value as ConditionOperator })
                  }
                  className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                >
                  {OPERATOR_OPTIONS.map((operator) => (
                    <option key={operator} value={operator}>
                      {operator}
                    </option>
                  ))}
                </select>
                <input
                  value={condition.valueFrom || ""}
                  onChange={(e) => updateCondition(index, { valueFrom: e.target.value })}
                  placeholder="valueFrom"
                  className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                />
                <input
                  value={condition.valueTo || ""}
                  onChange={(e) => updateCondition(index, { valueTo: e.target.value })}
                  placeholder="valueTo"
                  className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                />
                <button
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      conditions: (prev.conditions || []).filter(
                        (_, currentIndex) => currentIndex !== index,
                      ),
                    }))
                  }
                  className="rounded-lg border border-red-200 px-3 py-2 text-sm text-error"
                >
                  Remove
                </button>
              </div>
            ))}
            {(form.conditions || []).length === 0 && (
              <div className="rounded-xl border border-dashed border-border-default p-3 text-sm text-text-muted">
                No condition rules. This strategy will match by scope only.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border-default bg-surface-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-bold text-text-primary">Approval Levels</h3>
            {canWrite && (
              <button
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    steps: [
                      ...(prev.steps || []),
                      {
                        levelNo: (prev.steps?.length || 0) + 1,
                        stepName: `Level ${(prev.steps?.length || 0) + 1} Approval`,
                        approverMode: "PROJECT_ROLE",
                        roleId: null,
                        userId: null,
                        userIds: [],
                        minApprovalsRequired: 1,
                        canDelegate: false,
                        escalationDays: null,
                        sequence: (prev.steps?.length || 0) + 1,
                      },
                    ],
                  }))
                }
                className="rounded-lg border border-border-default px-3 py-2 text-sm"
              >
                + Add Level
              </button>
            )}
          </div>
          <div className="space-y-3">
            {(form.steps || []).map((step, index) => {
              const selectedUserIds = step.userIds || (step.userId ? [step.userId] : []);
              const stepApprovers =
                step.approverMode === "USER"
                  ? actors.filter((actor) => selectedUserIds.includes(actor.userId))
                  : actors.filter((actor) =>
                      actor.projectRoleIds.includes(step.roleId ?? -1),
                    );

              return (
                <div
                  key={`${step.stepName}-${index}`}
                  className="rounded-xl border border-border-subtle bg-surface-base p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="font-semibold text-text-primary">
                      Level {index + 1}
                    </div>
                    <button
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          steps: (prev.steps || []).filter(
                            (_, currentIndex) => currentIndex !== index,
                          ),
                        }))
                      }
                      className="text-sm text-error"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    <input
                      value={step.stepName}
                      onChange={(e) => updateStep(index, { stepName: e.target.value })}
                      placeholder="Step name"
                      className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                    />
                    <select
                      value={step.approverMode}
                      onChange={(e) =>
                        updateStep(index, {
                          approverMode: e.target.value as ApproverMode,
                          userId: null,
                          userIds: [],
                          roleId: null,
                        })
                      }
                      className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                    >
                      {APPROVER_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {mode}
                        </option>
                      ))}
                    </select>
                    {step.approverMode === "USER" ? (
                      <select
                        multiple
                        value={selectedUserIds.map(String)}
                        onChange={(e) => {
                          const userIds = Array.from(e.target.selectedOptions)
                            .map((option) => Number(option.value))
                            .filter((userId) => Number.isFinite(userId) && userId > 0);
                          updateStep(index, {
                            userIds,
                            userId: userIds[0] || null,
                            minApprovalsRequired: Math.min(
                              step.minApprovalsRequired || 1,
                              Math.max(userIds.length, 1),
                            ),
                          });
                        }}
                        className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                        size={Math.min(Math.max(actors.length, 3), 6)}
                      >
                        {actors.map((actor) => (
                          <option key={actor.userId} value={actor.userId}>
                            {actor.displayName} - {actor.companyLabel} - {actor.primaryRoleLabel || actor.sourceType}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={step.roleId || ""}
                        onChange={(e) =>
                          updateStep(index, { roleId: Number(e.target.value) || null })
                        }
                        className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                      >
                        <option value="">Select project role</option>
                        {roleOptions.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      type="number"
                      value={step.minApprovalsRequired || 1}
                      onChange={(e) =>
                        updateStep(index, {
                          minApprovalsRequired: Number(e.target.value) || 1,
                        })
                      }
                      placeholder="Min approvals"
                      className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      value={step.escalationDays || ""}
                      onChange={(e) =>
                        updateStep(index, {
                          escalationDays: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="Escalation days"
                      className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                    />
                    <label className="flex items-center gap-2 rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={step.canDelegate || false}
                        onChange={(e) => updateStep(index, { canDelegate: e.target.checked })}
                      />
                      Can delegate
                    </label>
                  </div>
                  <div className="mt-2 text-xs text-text-muted">
                    Resolved approvers:{" "}
                    {stepApprovers.length > 0
                      ? stepApprovers
                          .map(
                            (actor) =>
                              `${actor.displayName} (${actor.companyLabel}${actor.primaryRoleLabel ? ` - ${actor.primaryRoleLabel}` : ""})`,
                          )
                          .join(", ")
                      : "No eligible project actor resolved"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="col-span-12 space-y-4 xl:col-span-3">
        <div className="rounded-2xl border border-border-default bg-surface-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="text-base font-bold text-text-primary">Actor Directory</h3>
          </div>
          <div className="max-h-[240px] space-y-2 overflow-y-auto pr-1 text-sm">
            {actors.map((actor) => (
              <div
                key={`${actor.userId}-${actor.sourceType}`}
                className="rounded-xl border border-border-subtle bg-surface-base p-3"
              >
                <div className="font-medium text-text-primary">{actor.displayName}</div>
                <div className="text-xs text-text-muted">
                  {actor.sourceType} • Roles:{" "}
                  {(actor.projectRoleNames || []).join(", ") || actor.primaryRoleLabel || "None"}
                </div>
                {actor.vendorId && (
                  <div className="mt-1 text-xs text-text-disabled">
                    Vendor #{actor.vendorId} • WO #{actor.workOrderId}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border-default bg-surface-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-secondary" />
            <h3 className="text-base font-bold text-text-primary">Readiness</h3>
          </div>
          <div className="space-y-2 text-sm">
            {readiness.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                {item.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-warning" />
                )}
                <span className={item.ok ? "text-text-primary" : "text-text-muted"}>
                  {item.label}
                </span>
              </div>
            ))}
            {conflicts.length > 0 && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-warning-muted p-3 text-xs text-amber-900">
                {conflicts.length} active conflict set(s) detected for this project.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border-default bg-surface-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            <h3 className="text-base font-bold text-text-primary">Simulation</h3>
          </div>
          <div className="space-y-2 text-sm">
            <select
              value={simulation.moduleCode}
              onChange={(e) =>
                setSimulation((prev) => ({ ...prev, moduleCode: e.target.value }))
              }
              className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2"
            >
              {MODULE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              value={simulation.processCode}
              onChange={(e) =>
                setSimulation((prev) => ({ ...prev, processCode: e.target.value }))
              }
              className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2"
            >
              {PROCESS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={simulation.amount ?? ""}
              onChange={(e) =>
                setSimulation((prev) => ({
                  ...prev,
                  amount: e.target.value ? Number(e.target.value) : null,
                }))
              }
              placeholder="Amount"
              className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2"
            />
            <input
              type="number"
              value={simulation.vendorId ?? ""}
              onChange={(e) =>
                setSimulation((prev) => ({
                  ...prev,
                  vendorId: e.target.value ? Number(e.target.value) : null,
                }))
              }
              placeholder="Vendor Id"
              className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2"
            />
            <input
              type="number"
              value={simulation.workOrderId ?? ""}
              onChange={(e) =>
                setSimulation((prev) => ({
                  ...prev,
                  workOrderId: e.target.value ? Number(e.target.value) : null,
                }))
              }
              placeholder="Work Order Id"
              className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2"
            />
            <button
              onClick={() => void runSimulation()}
              disabled={!form.id || !canSimulate}
              className="w-full rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Run Simulation
            </button>
            {simulationResult && (
              <div className="rounded-xl border border-border-subtle bg-surface-base p-3 text-xs text-text-secondary">
                <div className="font-semibold text-text-primary">
                  {simulationResult.matched ? "Matched" : "Not matched"}
                </div>
                <div className="mt-1">
                  Steps resolved: {simulationResult.resolvedSteps?.length || 0}
                </div>
                {simulationResult.resolvedSteps?.map((step: any) => (
                  <div key={`${step.levelNo}-${step.stepName}`} className="mt-2">
                    Level {step.levelNo}: {step.stepName} —{" "}
                    {(step.approvers || [])
                      .map((actor: any) => actor.displayName)
                      .join(", ") || "No approver"}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
