import { useEffect, useState } from "react";
import { CheckSquare, Plus, Search, Settings2, Trash2, Upload, X, GripVertical } from "lucide-react";
import { toast } from "react-hot-toast";
import { qualityService } from "../../../services/quality.service";
import ChecklistImportModal from "../../../components/quality/ChecklistImportModal";
import type { QualityChecklistTemplatePayload, SignatureSlotConfig } from "../../../types/quality";

interface Props {
  projectId: number;
}

const seedSlot = (i: number): SignatureSlotConfig => ({
  slotId: `slot_${i}`,
  label: "Site In Charge",
  party: "Contractor",
  role: "SITE_ENGINEER",
  required: true,
  sequence: 1,
});

const seedStage = (i = 0) => ({
  name: `Stage ${i + 1}`,
  sequence: i,
  isHoldPoint: false,
  isWitnessPoint: false,
  responsibleParty: "Contractor",
  signatureSlots: [seedSlot(i)],
  items: [{ itemText: "", type: "YES_OR_NA" as const, isMandatory: false, photoRequired: false, sequence: 0 }],
});

const baseForm = (): QualityChecklistTemplatePayload => ({
  name: "",
  description: "",
  checklistNo: "",
  revNo: "01",
  activityTitle: "",
  activityType: "CONCRETING",
  discipline: "Civil",
  applicableTrade: "RCC",
  isGlobal: false,
  stages: [seedStage()],
});

const QualityChecklist: React.FC<Props> = ({ projectId }) => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [formData, setFormData] = useState<QualityChecklistTemplatePayload>(baseForm());

  const load = async () => {
    try {
      setTemplates(await qualityService.getChecklistTemplates(projectId));
    } catch {
      toast.error("Failed to load checklist templates");
    }
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const filtered = templates.filter((t) =>
    `${t.name} ${t.activityTitle || ""} ${t.checklistNo || ""}`.toLowerCase().includes(search.toLowerCase()),
  );

  const updateStage = (index: number, patch: Record<string, unknown>) => {
    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((stage, current) =>
        current === index ? { ...stage, ...patch } : stage,
      ),
    }));
  };

  const updateSlot = (stageIndex: number, slotIndex: number, patch: Partial<SignatureSlotConfig>) => {
    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((stage, i) =>
        i === stageIndex
          ? {
              ...stage,
              signatureSlots: (stage.signatureSlots || []).map((slot, j) =>
                j === slotIndex ? { ...slot, ...patch } : slot,
              ),
            }
          : stage,
      ),
    }));
  };

  const closeBuilder = () => {
    setBuilderOpen(false);
    setEditingTemplateId(null);
    setFormData(baseForm());
  };

  const openCreateBuilder = () => {
    setEditingTemplateId(null);
    setFormData(baseForm());
    setBuilderOpen(true);
  };

  const openEditBuilder = (template: any) => {
    setEditingTemplateId(template.id);
    setFormData({
      name: template.name || "",
      description: template.description || "",
      checklistNo: template.checklistNo || "",
      revNo: template.revNo || "01",
      activityTitle: template.activityTitle || "",
      activityType: template.activityType || "",
      discipline: template.discipline || "",
      applicableTrade: template.applicableTrade || "",
      isGlobal: Boolean(template.isGlobal),
      stages: (template.stages || []).map((stage: any, stageIndex: number) => ({
        name: stage.name || `Stage ${stageIndex + 1}`,
        sequence: stage.sequence ?? stageIndex,
        isHoldPoint: Boolean(stage.isHoldPoint),
        isWitnessPoint: Boolean(stage.isWitnessPoint),
        responsibleParty: stage.responsibleParty || "Contractor",
        signatureSlots:
          stage.signatureSlots?.map((slot: any, slotIndex: number) => ({
            slotId: slot.slotId || `slot_${stageIndex}_${slotIndex}`,
            label: slot.label || "Approver",
            party: slot.party || "Contractor",
            role: slot.role || "APPROVER",
            required: slot.required ?? true,
            sequence: slot.sequence ?? slotIndex + 1,
          })) || [],
        items:
          stage.items?.map((item: any, itemIndex: number) => ({
            itemText: item.itemText || "",
            type: item.type || "YES_OR_NA",
            isMandatory: Boolean(item.isMandatory),
            photoRequired: Boolean(item.photoRequired),
            sequence: item.sequence ?? itemIndex,
          })) || [],
      })),
    });
    setBuilderOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (editingTemplateId) {
        await qualityService.updateChecklistTemplate(editingTemplateId, formData);
        toast.success("Checklist template updated");
      } else {
        await qualityService.createChecklistTemplate(projectId, formData);
        toast.success("Checklist template saved");
      }
      closeBuilder();
      load();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to save template");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border-subtle bg-surface-card p-4">
        <div className="flex w-full items-center gap-3 rounded-xl border border-border-subtle bg-surface-base px-4 py-3 lg:w-96">
          <Search className="h-4 w-4 text-text-disabled" />
          <input
            className="w-full border-none bg-transparent p-0 text-sm focus:ring-0"
            placeholder="Search checklist templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={async () => {
              try {
                await qualityService.migrateChecklistTemplates(projectId);
                toast.success("Legacy checklist migration completed");
                load();
              } catch (error: any) {
                toast.error(error.response?.data?.message || "Migration failed");
              }
            }}
            className="flex items-center gap-2 rounded-xl bg-surface-raised px-4 py-2.5 text-sm font-medium text-text-secondary"
          >
            <Settings2 className="h-4 w-4" />
            Migrate Legacy
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white"
          >
            <Upload className="h-4 w-4" />
            Smart Import
          </button>
          <button
            onClick={openCreateBuilder}
            className="flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            New Template
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {filtered.map((template) => (
          <div key={template.id} className="rounded-2xl border border-border-subtle bg-surface-card p-6 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h4 className="text-lg font-bold text-text-primary">
                  {template.activityTitle || template.name}
                </h4>
                <p className="text-sm text-text-muted">
                  {template.checklistNo || "No checklist number"} - Rev {template.revNo || "01"}
                </p>
                <p className="text-sm text-text-secondary">
                  {template.activityType || "No activity type"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditBuilder(template)}
                  className="rounded-xl border border-border-default px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-base"
                >
                  Edit
                </button>
                <button
                  onClick={async () => {
                    try {
                      await qualityService.deleteChecklistTemplate(template.id);
                      toast.success("Checklist template deleted");
                      load();
                    } catch (error: any) {
                      toast.error(error.response?.data?.message || "Failed to delete template");
                    }
                  }}
                  className="rounded-xl p-2 text-error hover:bg-error-muted"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {(template.stages || []).map((stage: any) => (
                <div key={stage.id} className="rounded-xl border border-border-subtle bg-surface-base p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-semibold text-text-primary">{stage.name}</span>
                    <span className="text-text-muted">{stage.items?.length || 0} items</span>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    {stage.signatureSlots?.length || 0} signatories
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-text-muted">
          <CheckSquare className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          <h3 className="text-lg font-medium text-text-primary">No Templates Found</h3>
          <p>Create a new template or import your checklist library.</p>
        </div>
      )}

      <ChecklistImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        projectId={projectId}
        onSuccess={load}
      />

      {builderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-surface-card shadow-2xl">
            <div className="flex items-center justify-between border-b bg-surface-base/50 p-6">
              <div>
                <h2 className="text-2xl font-bold text-text-primary">
                  {editingTemplateId ? "Edit Checklist Template" : "Checklist Template Builder"}
                </h2>
                <p className="mt-1 text-sm text-text-muted">
                  Configure header fields, signatories, and stage items.
                </p>
              </div>
              <button
                onClick={closeBuilder}
                className="rounded-full border border-border-default bg-surface-card p-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-surface-base/50 p-6">
              <form id="templateForm" onSubmit={save} className="space-y-6">
                <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border-default bg-surface-card p-5 md:grid-cols-2">
                  <input
                    required
                    className="rounded-xl border border-border-default bg-surface-base px-4 py-3 text-sm"
                    placeholder="Template name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                  <input
                    className="rounded-xl border border-border-default bg-surface-base px-4 py-3 text-sm"
                    placeholder="Description / scope"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                  <input
                    className="rounded-xl border border-border-default bg-surface-base px-4 py-3 text-sm"
                    placeholder="Checklist No"
                    value={formData.checklistNo}
                    onChange={(e) => setFormData({ ...formData, checklistNo: e.target.value })}
                  />
                  <input
                    className="rounded-xl border border-border-default bg-surface-base px-4 py-3 text-sm"
                    placeholder="Rev No"
                    value={formData.revNo}
                    onChange={(e) => setFormData({ ...formData, revNo: e.target.value })}
                  />
                  <input
                    className="rounded-xl border border-border-default bg-surface-base px-4 py-3 text-sm md:col-span-2"
                    placeholder="Activity Title"
                    value={formData.activityTitle}
                    onChange={(e) => setFormData({ ...formData, activityTitle: e.target.value })}
                  />
                  <select
                    className="rounded-xl border border-border-default bg-surface-base px-4 py-3 text-sm"
                    value={formData.activityType}
                    onChange={(e) => setFormData({ ...formData, activityType: e.target.value })}
                  >
                    {["CONCRETING", "SHUTTERING", "REINFORCEMENT", "WATERPROOFING", "TILING", "PLASTERING", "PAINTING", "PLUMBING", "ELECTRICAL", "HVAC", "FACADE"].map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                  <select
                    className="rounded-xl border border-border-default bg-surface-base px-4 py-3 text-sm"
                    value={formData.discipline}
                    onChange={(e) => setFormData({ ...formData, discipline: e.target.value })}
                  >
                    {["Civil", "MEP", "Finishing", "Structural", "External Works"].map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                  <input
                    className="rounded-xl border border-border-default bg-surface-base px-4 py-3 text-sm"
                    placeholder="Applicable Trade"
                    value={formData.applicableTrade}
                    onChange={(e) =>
                      setFormData({ ...formData, applicableTrade: e.target.value })
                    }
                  />
                  <label className="flex items-center gap-2 rounded-xl border border-border-default bg-surface-base px-4 py-3 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={formData.isGlobal}
                      onChange={(e) => setFormData({ ...formData, isGlobal: e.target.checked })}
                    />
                    Global library template
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-text-primary">Stages & Items</h3>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, stages: [...prev.stages, seedStage(prev.stages.length)] }))
                    }
                    className="rounded-lg bg-orange-50 px-4 py-2 text-sm font-bold text-orange-600"
                  >
                    Add Stage
                  </button>
                </div>

                <div className="space-y-5">
                  {formData.stages.map((stage, stageIndex) => (
                    <div key={stageIndex} className="rounded-2xl border border-border-default bg-surface-card shadow-sm">
                      <div className="flex flex-wrap items-center gap-3 border-b border-border-default bg-surface-raised/80 px-4 py-3">
                        <GripVertical className="h-5 w-5 text-text-disabled" />
                        <input
                          className="rounded-lg border border-border-strong bg-surface-card px-3 py-2 text-sm font-bold"
                          value={stage.name}
                          onChange={(e) => updateStage(stageIndex, { name: e.target.value })}
                        />
                        <label className="text-sm text-text-secondary">
                          <input
                            type="checkbox"
                            checked={stage.isHoldPoint}
                            onChange={(e) =>
                              updateStage(stageIndex, { isHoldPoint: e.target.checked })
                            }
                          />{" "}
                          Hold Point
                        </label>
                        <label className="text-sm text-text-secondary">
                          <input
                            type="checkbox"
                            checked={stage.isWitnessPoint}
                            onChange={(e) =>
                              updateStage(stageIndex, { isWitnessPoint: e.target.checked })
                            }
                          />{" "}
                          Witness Point
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              stages: prev.stages.filter((_, i) => i !== stageIndex),
                            }))
                          }
                          className="ml-auto rounded-lg p-1.5 text-text-disabled hover:bg-gray-200 hover:text-error"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="space-y-4 p-4">
                        <div className="rounded-xl border border-border-default bg-surface-base p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <p className="font-semibold text-text-primary">Signature Slots</p>
                            <button
                              type="button"
                              onClick={() =>
                                updateStage(stageIndex, {
                                  signatureSlots: [
                                    ...(stage.signatureSlots || []),
                                    {
                                      slotId: `slot_${Date.now()}`,
                                      label: "Approver",
                                      party: "Contractor",
                                      role: "APPROVER",
                                      required: true,
                                      sequence: (stage.signatureSlots || []).length + 1,
                                    },
                                  ],
                                })
                              }
                              className="rounded-lg bg-surface-card px-3 py-2 text-xs font-bold text-secondary"
                            >
                              Add Signatory
                            </button>
                          </div>
                          <div className="space-y-2">
                            {(stage.signatureSlots || []).map((slot, slotIndex) => (
                              <div key={slot.slotId} className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                <input
                                  className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                  value={slot.label}
                                  onChange={(e) =>
                                    updateSlot(stageIndex, slotIndex, { label: e.target.value })
                                  }
                                />
                                <input
                                  className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                  value={slot.role}
                                  onChange={(e) =>
                                    updateSlot(stageIndex, slotIndex, { role: e.target.value })
                                  }
                                />
                                <label className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm text-text-secondary">
                                  <input
                                    type="checkbox"
                                    checked={slot.required}
                                    onChange={(e) =>
                                      updateSlot(stageIndex, slotIndex, { required: e.target.checked })
                                    }
                                  />{" "}
                                  Required
                                </label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateStage(stageIndex, {
                                      signatureSlots: (stage.signatureSlots || []).filter(
                                        (_, i) => i !== slotIndex,
                                      ),
                                    })
                                  }
                                  className="rounded-lg bg-error-muted px-3 py-2 text-sm font-medium text-error"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3">
                          {stage.items.map((item, itemIndex) => (
                            <div key={itemIndex} className="group flex items-start gap-4 rounded-xl border border-dotted border-border-strong bg-surface-base/50 p-3">
                              <div className="flex-1 space-y-3">
                                <div className="flex flex-wrap gap-3">
                                  <input
                                    className="min-w-[260px] flex-1 rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                    placeholder="Checklist Item Description..."
                                    value={item.itemText}
                                    onChange={(e) =>
                                      updateStage(stageIndex, {
                                        items: stage.items.map((current, i) =>
                                          i === itemIndex
                                            ? { ...current, itemText: e.target.value }
                                            : current,
                                        ),
                                      })
                                    }
                                  />
                                  <select
                                    className="rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm"
                                    value={item.type}
                                    onChange={(e) =>
                                      updateStage(stageIndex, {
                                        items: stage.items.map((current, i) =>
                                          i === itemIndex
                                            ? { ...current, type: e.target.value }
                                            : current,
                                        ),
                                      })
                                    }
                                  >
                                    <option value="YES_OR_NA">Yes / N.A.</option>
                                    <option value="YES_NO">Pass / Fail</option>
                                    <option value="TEXT">Text Input</option>
                                    <option value="NUMERIC">Numeric</option>
                                    <option value="PHOTO_ONLY">Photo Evidence</option>
                                  </select>
                                </div>
                                <div className="flex gap-6 text-xs font-semibold text-text-muted">
                                  <label>
                                    <input
                                      type="checkbox"
                                      checked={item.isMandatory}
                                      onChange={(e) =>
                                        updateStage(stageIndex, {
                                          items: stage.items.map((current, i) =>
                                            i === itemIndex
                                              ? { ...current, isMandatory: e.target.checked }
                                              : current,
                                          ),
                                        })
                                      }
                                    />{" "}
                                    Required
                                  </label>
                                  <label>
                                    <input
                                      type="checkbox"
                                      checked={item.photoRequired}
                                      onChange={(e) =>
                                        updateStage(stageIndex, {
                                          items: stage.items.map((current, i) =>
                                            i === itemIndex
                                              ? { ...current, photoRequired: e.target.checked }
                                              : current,
                                          ),
                                        })
                                      }
                                    />{" "}
                                    Photo proof
                                  </label>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  updateStage(stageIndex, {
                                    items: stage.items.filter((_, i) => i !== itemIndex),
                                  })
                                }
                                className="mt-2 rounded-lg p-1.5 text-text-disabled opacity-0 hover:bg-surface-card hover:text-error group-hover:opacity-100"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() =>
                              updateStage(stageIndex, {
                                items: [
                                  ...stage.items,
                                  {
                                    itemText: "",
                                    type: "YES_OR_NA",
                                    isMandatory: false,
                                    photoRequired: false,
                                    sequence: stage.items.length,
                                  },
                                ],
                              })
                            }
                            className="w-full rounded-xl border-2 border-dashed border-border-default py-2 text-sm font-medium text-text-muted"
                          >
                            <Plus className="mr-1 inline h-4 w-4" />
                            Add Item
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </form>
            </div>

            <div className="flex justify-end gap-3 border-t bg-surface-card p-5">
              <button
                type="button"
                onClick={closeBuilder}
                className="rounded-xl border border-border-default bg-surface-base px-6 py-2.5 font-bold text-text-muted"
              >
                Cancel
              </button>
              <button
                form="templateForm"
                type="submit"
                className="rounded-xl bg-orange-600 px-8 py-2.5 font-bold text-white"
              >
                {editingTemplateId ? "Update Template" : "Save Template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QualityChecklist;
