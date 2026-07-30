import { useEffect, useMemo, useState } from "react";
import { GripVertical, Plus, Trash2, X } from "lucide-react";
import api from "../../../api/axios";
import { PermissionCode } from "../../../config/permissions";
import { useAuth } from "../../../context/AuthContext";
import {
  snagService,
  type SnagProcessStepConfig,
} from "../../../services/snag.service";

type Props = {
  projectId: number;
};

type QualityActivityOption = {
  id: number;
  activityName?: string | null;
  name?: string | null;
  activityCode?: string | null;
};

const emptyStep = {
  name: "",
  description: "",
  workflowSerialNo: 1,
  isActive: true,
  raisePhotoRequired: false,
  rectificationPhotoRequired: false,
  desnagCompletionPhotoRequired: false,
};

type StepDialogState = {
  stepId?: number;
  form: typeof emptyStep;
};

type PointDialogState = {
  mappingId: number;
  pointId?: number;
  title: string;
  description: string;
  requiresEvidence: boolean;
};

export default function SnagDesnagConfigPage({ projectId }: Props) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PermissionCode.QUALITY_SNAG_CONFIG_MANAGE);
  const [steps, setSteps] = useState<SnagProcessStepConfig[]>([]);
  const [activities, setActivities] = useState<QualityActivityOption[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<number | null>(null);
  const [selectedMappingId, setSelectedMappingId] = useState<number | null>(null);
  const [stepDialog, setStepDialog] = useState<StepDialogState | null>(null);
  const [activityId, setActivityId] = useState("");
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [pointDialog, setPointDialog] = useState<PointDialogState | null>(null);
  const [draggedMappingId, setDraggedMappingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await snagService.listProcessSteps(projectId);
      setSteps(data);
      setSelectedStepId((current) => current ?? data.find((step) => step.id)?.id ?? null);
      const selectedStillExists = data.some((step) =>
        (step.activities || []).some((activity) => activity.id === selectedMappingId),
      );
      if (!selectedStillExists) setSelectedMappingId(null);
    } finally {
      setLoading(false);
    }
  };

  const loadActivities = async () => {
    const lists = await api.get("/quality/activity-lists", { params: { projectId } });
    const listRows = Array.isArray(lists.data) ? lists.data : [];
    const activityResponses = await Promise.all(
      listRows.map((list: any) =>
        api
          .get(`/quality/activity-lists/${list.id}/activities`)
          .then((res) => (Array.isArray(res.data) ? res.data : []))
          .catch(() => []),
      ),
    );
    const unique = new Map<number, QualityActivityOption>();
    activityResponses.flat().forEach((activity: any) => {
      if (activity?.id) unique.set(activity.id, activity);
    });
    setActivities([...unique.values()]);
  };

  useEffect(() => {
    void loadConfig();
    void loadActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const selectedStep = useMemo(
    () => steps.find((step) => step.id === selectedStepId) || steps[0],
    [selectedStepId, steps],
  );
  const selectedMapping = useMemo(
    () =>
      steps
        .flatMap((step) => step.activities || [])
        .find((mapping) => mapping.id === selectedMappingId) || null,
    [selectedMappingId, steps],
  );
  const mappedActivityIds = useMemo(
    () => new Set(steps.flatMap((step) => step.activities || []).map((item) => item.activityId)),
    [steps],
  );
  const availableActivities = activities.filter(
    (activity) => !mappedActivityIds.has(activity.id),
  );

  const openStepDialog = (step?: SnagProcessStepConfig) => {
    setStepDialog({
      stepId: step?.id,
      form: step
        ? {
            name: step.name,
            description: step.description || "",
            workflowSerialNo: step.workflowSerialNo,
            isActive: step.isActive,
            raisePhotoRequired: step.raisePhotoRequired ?? false,
            rectificationPhotoRequired:
              step.rectificationPhotoRequired ?? false,
            desnagCompletionPhotoRequired:
              step.desnagCompletionPhotoRequired ?? false,
          }
        : {
            ...emptyStep,
            workflowSerialNo: steps.length + 1,
          },
    });
  };

  const saveStep = async () => {
    if (!stepDialog?.form.name.trim()) return;
    setSaving(true);
    try {
      const data = await snagService.saveProcessStep(
        projectId,
        stepDialog.form,
        stepDialog.stepId,
      );
      setSteps(data);
      setStepDialog(null);
    } finally {
      setSaving(false);
    }
  };

  const addActivity = async () => {
    if (!selectedStep?.id || !activityId) return;
    setSaving(true);
    try {
      const data = await snagService.addProcessActivity(projectId, {
        processStepId: selectedStep.id,
        activityId: Number(activityId),
        sortOrder: selectedStep.activities?.length || 0,
      });
      setSteps(data);
      setActivityId("");
      setActivityDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const moveActivity = async (mappingId: number, processStepId: number) => {
    setSaving(true);
    try {
      const targetStep = steps.find((step) => step.id === processStepId);
      const data = await snagService.moveProcessActivity(projectId, mappingId, {
        processStepId,
        sortOrder: targetStep?.activities?.length || 0,
      });
      setSteps(data);
      setSelectedStepId(processStepId);
    } finally {
      setSaving(false);
      setDraggedMappingId(null);
    }
  };

  const savePoint = async () => {
    if (!pointDialog || !pointDialog.title.trim()) return;
    setSaving(true);
    try {
      const mapping = steps
        .flatMap((step) => step.activities || [])
        .find((item) => item.id === pointDialog.mappingId);
      const data = await snagService.saveCommonPoint(projectId, pointDialog.mappingId, {
        title: pointDialog.title.trim(),
        description: pointDialog.description.trim() || null,
        severity: "medium",
        requiresEvidence: pointDialog.requiresEvidence,
        sortOrder: mapping?.commonPoints?.length || 0,
      }, pointDialog.pointId);
      setSteps(data);
      setPointDialog(null);
    } finally {
      setSaving(false);
    }
  };

  const activityLabel = (activity?: QualityActivityOption | null) =>
    activity?.activityName || activity?.name || `Activity #${activity?.id || ""}`;

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-xl border border-border-default bg-surface-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Snag / Desnag Process
            </h3>
            <p className="mt-1 text-xs text-text-muted">
              Define the configured snag cycles, map activities, and maintain common snag points.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {loading && <span className="text-xs text-text-muted">Loading...</span>}
            {canManage && (
              <button
                type="button"
                onClick={() => openStepDialog()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" />
                Add Process Step
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.id || step.workflowSerialNo}
              onDragOver={(event) => {
                if (canManage) event.preventDefault();
              }}
              onDrop={() => {
                if (canManage && draggedMappingId && step.id) {
                  void moveActivity(draggedMappingId, step.id);
                }
              }}
              className={`rounded-xl border bg-surface-card p-3 ${
                selectedStep?.id === step.id
                  ? "border-primary"
                  : "border-border-default"
              }`}
            >
              <button
                type="button"
                onClick={() => setSelectedStepId(step.id || null)}
                className="mb-3 w-full text-left"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                  Step {step.workflowSerialNo}
                </div>
                <div className="mt-1 text-sm font-semibold text-text-primary">
                  {step.name}
                </div>
                <div className="mt-1 text-xs text-text-muted">
                  {(step.activities || []).length} activities,{" "}
                  {(step.activities || []).reduce(
                    (count, activity) => count + (activity.commonPoints || []).length,
                    0,
                  )}{" "}
                  common points
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {step.raisePhotoRequired && (
                    <span className="rounded-full border border-warning/20 px-2 py-0.5 text-[10px] text-warning">
                      Raise photo required
                    </span>
                  )}
                  {step.rectificationPhotoRequired && (
                    <span className="rounded-full border border-warning/20 px-2 py-0.5 text-[10px] text-warning">
                      Rectification photo required
                    </span>
                  )}
                  {step.desnagCompletionPhotoRequired && (
                    <span className="rounded-full border border-warning/20 px-2 py-0.5 text-[10px] text-warning">
                      De-snag photo required
                    </span>
                  )}
                </div>
              </button>
              {canManage && (
                <div className="mb-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openStepDialog(step)}
                    className="rounded-lg border border-border-default px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface-base"
                  >
                    Edit Step
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStepId(step.id || null);
                      setActivityDialogOpen(true);
                    }}
                    className="rounded-lg border border-border-default px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface-base"
                  >
                    Add Activity
                  </button>
                </div>
              )}

              <div className="space-y-2">
                {(step.activities || []).map((mapping) => (
                  <div
                    key={mapping.id}
                    draggable={canManage}
                    onDragStart={() => setDraggedMappingId(mapping.id)}
                    onClick={() => {
                      setSelectedMappingId(mapping.id);
                      setSelectedStepId(step.id || null);
                    }}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-2 text-xs ${
                      selectedMappingId === mapping.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border-default bg-surface-base text-text-secondary"
                    }`}
                  >
                    <GripVertical className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                      <span className="min-w-0 flex-1 truncate">
                        {activityLabel(mapping.activity)}
                      </span>
                    {canManage && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void snagService
                            .deleteProcessActivity(projectId, mapping.id)
                            .then(setSteps);
                        }}
                        className="text-error"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {(step.activities || []).length === 0 && (
                  <div className="rounded-lg border border-dashed border-border-default px-3 py-4 text-xs text-text-muted">
                    Drop activities here.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border-default bg-surface-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">
                  Common Snag Points
                </h3>
                <p className="mt-1 text-xs text-text-muted">
                  {selectedMapping
                    ? activityLabel(selectedMapping.activity)
                    : "Select a mapped activity to maintain its points."}
                </p>
              </div>
              {selectedMapping && canManage && (
                <button
                  type="button"
                  onClick={() =>
                    setPointDialog({
                      mappingId: selectedMapping.id,
                      title: "",
                      description: "",
                      requiresEvidence: false,
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white"
                >
                  <Plus className="h-4 w-4" />
                  Add Point
                </button>
              )}
            </div>

            <div className="mt-4 space-y-2">
              {(selectedMapping?.commonPoints || []).map((point) => (
                <div
                  key={point.id}
                  className="rounded-lg border border-border-default bg-surface-base px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-text-primary">
                        {point.title}
                      </div>
                      {point.description && (
                        <div className="mt-1 text-xs text-text-muted">
                          {point.description}
                        </div>
                      )}
                      {point.requiresEvidence && (
                        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-warning">
                          Evidence required
                        </div>
                      )}
                    </div>
                    {canManage && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setPointDialog({
                              mappingId: selectedMapping!.id,
                              pointId: point.id,
                              title: point.title,
                              description: point.description || "",
                              requiresEvidence: point.requiresEvidence,
                            })
                          }
                          className="text-text-secondary"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void snagService
                              .deleteCommonPoint(projectId, point.id)
                              .then(setSteps)
                          }
                          className="text-error"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {selectedMapping && (selectedMapping.commonPoints || []).length === 0 && (
                <div className="rounded-lg border border-dashed border-border-default px-3 py-4 text-xs text-text-muted">
                  No common points configured for this activity.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {stepDialog && (
        <div className="fixed inset-0 z-[1100] bg-surface-base/70 backdrop-blur-sm">
          <div className="flex h-full items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-2xl border border-border-default bg-surface-card shadow-2xl">
              <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
                <h3 className="text-base font-semibold text-text-primary">
                  {stepDialog.stepId ? "Edit Process Step" : "Add Process Step"}
                </h3>
                <button
                  type="button"
                  onClick={() => setStepDialog(null)}
                  className="rounded-lg border border-border-default p-2 text-text-secondary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3 p-5">
                <input
                  value={stepDialog.form.name}
                  onChange={(event) =>
                    setStepDialog((current) =>
                      current
                        ? { ...current, form: { ...current.form, name: event.target.value } }
                        : current,
                    )
                  }
                  placeholder="Process step name, e.g. Snag 1 / De-snag 1"
                  className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm"
                />
                <textarea
                  value={stepDialog.form.description}
                  onChange={(event) =>
                    setStepDialog((current) =>
                      current
                        ? {
                            ...current,
                            form: { ...current.form, description: event.target.value },
                          }
                        : current,
                    )
                  }
                  placeholder="Description"
                  className="min-h-[84px] w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-medium text-text-muted">
                    Workflow Serial Number
                    <input
                      type="number"
                      min={1}
                      value={stepDialog.form.workflowSerialNo}
                      onChange={(event) =>
                        setStepDialog((current) =>
                          current
                            ? {
                                ...current,
                                form: {
                                  ...current.form,
                                  workflowSerialNo: Number(event.target.value || 1),
                                },
                              }
                            : current,
                        )
                      }
                      className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="flex items-center gap-2 self-end rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={stepDialog.form.isActive}
                      onChange={(event) =>
                        setStepDialog((current) =>
                          current
                            ? {
                                ...current,
                                form: { ...current.form, isActive: event.target.checked },
                              }
                            : current,
                        )
                      }
                    />
                    Active process step
                  </label>
                </div>
                <div className="grid gap-2 rounded-lg border border-border-default bg-surface-base p-3">
                  <label className="flex items-center gap-2 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={stepDialog.form.raisePhotoRequired}
                      onChange={(event) =>
                        setStepDialog((current) =>
                          current
                            ? {
                                ...current,
                                form: {
                                  ...current.form,
                                  raisePhotoRequired: event.target.checked,
                                },
                              }
                            : current,
                        )
                      }
                    />
                    Photo mandatory while raising snag points
                  </label>
                  <label className="flex items-center gap-2 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={stepDialog.form.rectificationPhotoRequired}
                      onChange={(event) =>
                        setStepDialog((current) =>
                          current
                            ? {
                                ...current,
                                form: {
                                  ...current.form,
                                  rectificationPhotoRequired: event.target.checked,
                                },
                              }
                            : current,
                        )
                      }
                    />
                    Photo mandatory while marking rectified
                  </label>
                  <label className="flex items-center gap-2 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={stepDialog.form.desnagCompletionPhotoRequired}
                      onChange={(event) =>
                        setStepDialog((current) =>
                          current
                            ? {
                                ...current,
                                form: {
                                  ...current.form,
                                  desnagCompletionPhotoRequired:
                                    event.target.checked,
                                },
                              }
                            : current,
                        )
                      }
                    />
                    Photo mandatory while marking de-snag completed
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => void saveStep()}
                  disabled={saving || !stepDialog.form.name.trim()}
                  className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Save Process Step
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activityDialogOpen && (
        <div className="fixed inset-0 z-[1100] bg-surface-base/70 backdrop-blur-sm">
          <div className="flex h-full items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-2xl border border-border-default bg-surface-card shadow-2xl">
              <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
                <h3 className="text-base font-semibold text-text-primary">
                  Add Activity To {selectedStep?.name || "Process Step"}
                </h3>
                <button
                  type="button"
                  onClick={() => setActivityDialogOpen(false)}
                  className="rounded-lg border border-border-default p-2 text-text-secondary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3 p-5">
                <select
                  value={activityId}
                  onChange={(event) => setActivityId(event.target.value)}
                  disabled={!canManage || !selectedStep?.id}
                  className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm"
                >
                  <option value="">Select activity from Quality Activity List</option>
                  {availableActivities.map((activity) => (
                    <option key={activity.id} value={activity.id}>
                      {activityLabel(activity)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void addActivity()}
                  disabled={saving || !canManage || !activityId || !selectedStep?.id}
                  className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Add Activity
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pointDialog && (
        <div className="fixed inset-0 z-[1100] bg-surface-base/70 backdrop-blur-sm">
          <div className="flex h-full items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-2xl border border-border-default bg-surface-card shadow-2xl">
              <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
                <h3 className="text-base font-semibold text-text-primary">
                  {pointDialog.pointId ? "Edit Common Snag Point" : "Add Common Snag Point"}
                </h3>
                <button
                  type="button"
                  onClick={() => setPointDialog(null)}
                  className="rounded-lg border border-border-default p-2 text-text-secondary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3 p-5">
                <input
                  value={pointDialog.title}
                  onChange={(event) =>
                    setPointDialog((current) =>
                      current ? { ...current, title: event.target.value } : current,
                    )
                  }
                  placeholder="Common snag point"
                  className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm"
                />
                <textarea
                  value={pointDialog.description}
                  onChange={(event) =>
                    setPointDialog((current) =>
                      current
                        ? { ...current, description: event.target.value }
                        : current,
                    )
                  }
                  placeholder="Description"
                  className="min-h-[84px] w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm"
                />
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={pointDialog.requiresEvidence}
                    onChange={(event) =>
                      setPointDialog((current) =>
                        current
                          ? { ...current, requiresEvidence: event.target.checked }
                          : current,
                      )
                    }
                  />
                  Evidence required
                </label>
                <button
                  type="button"
                  onClick={() => void savePoint()}
                  disabled={saving || !pointDialog.title.trim()}
                  className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Save Common Point
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
