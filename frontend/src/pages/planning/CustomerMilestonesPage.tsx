import { useEffect, useMemo, useState } from "react";
import { CopyPlus, RefreshCw } from "lucide-react";
import { useParams } from "react-router-dom";
import {
  customerMilestoneService,
  type CustomerMilestoneTemplateDto,
  type FlatSaleInfoDto,
  type MilestoneScopeTower,
  type ScheduleActivityOption,
} from "../../services/customerMilestone.service";

type MilestoneTab = "templates" | "sales" | "tracker";

const blankTemplate = (): CustomerMilestoneTemplateDto => ({
  name: "",
  sequence: 1,
  collectionPct: "0",
  triggerType: "MANUAL",
  applicableTo: "tower",
  applicableEpsIds: [],
  linkedActivityIds: [],
  allowManualCompletion: true,
  isActive: true,
});

const blankSale = (): FlatSaleInfoDto => ({
  unitLabel: "",
  totalSaleValue: "0",
});

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);

export default function CustomerMilestonesPage() {
  const { projectId } = useParams();
  const pId = Number(projectId);
  const [tab, setTab] = useState<MilestoneTab>("templates");
  const [templates, setTemplates] = useState<any[]>([]);
  const [flatSales, setFlatSales] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [scopeOptions, setScopeOptions] = useState<MilestoneScopeTower[]>([]);
  const [activityOptions, setActivityOptions] = useState<ScheduleActivityOption[]>([]);
  const [templateForm, setTemplateForm] = useState<CustomerMilestoneTemplateDto>(blankTemplate());
  const [saleForm, setSaleForm] = useState<FlatSaleInfoDto>(blankSale());
  const [loading, setLoading] = useState(false);
  const [cloneSourceTowerId, setCloneSourceTowerId] = useState<number | "">("");
  const [cloneTargetTowerIds, setCloneTargetTowerIds] = useState<number[]>([]);

  const loadAll = async () => {
    if (!pId) return;
    setLoading(true);
    try {
      const [templateData, saleData, unitData, scopeData, scheduleData] = await Promise.all([
        customerMilestoneService.listTemplates(pId),
        customerMilestoneService.listFlatSales(pId),
        customerMilestoneService.listUnitMilestones(pId),
        customerMilestoneService.listScopeOptions(pId),
        customerMilestoneService.listScheduleActivities(pId),
      ]);
      setTemplates(templateData);
      setFlatSales(saleData);
      setUnits(unitData);
      setScopeOptions(scopeData);
      setActivityOptions(scheduleData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, [pId]);

  const totalDue = useMemo(
    () =>
      units.reduce(
        (sum, unit) =>
          sum +
          (unit.milestones || []).reduce(
            (inner: number, milestone: any) => inner + Number(milestone.collectionAmount || 0),
            0,
          ),
        0,
      ),
    [units],
  );

  const totalCollected = useMemo(
    () => units.reduce((sum, unit) => sum + Number(unit.collectedAmount || 0), 0),
    [units],
  );

  const selectedScopeOptions = useMemo(() => {
    if (templateForm.applicableTo === "tower") {
      return scopeOptions.map((tower) => ({ id: tower.towerId, label: tower.towerName }));
    }
    if (templateForm.applicableTo === "floor") {
      return scopeOptions.flatMap((tower) =>
        tower.floors.map((floor) => ({
          id: floor.floorId,
          label: `${tower.towerName} / ${floor.floorName}`,
        })),
      );
    }
    if (templateForm.applicableTo === "unit") {
      return scopeOptions.flatMap((tower) =>
        tower.floors.flatMap((floor) =>
          floor.units.map((unit) => ({
            id: unit.unitId,
            label: `${tower.towerName} / ${floor.floorName} / ${unit.unitName}`,
          })),
        ),
      );
    }
    return [];
  }, [scopeOptions, templateForm.applicableTo]);

  const toggleScopeId = (id: number) => {
    setTemplateForm((prev) => {
      const current = new Set(prev.applicableEpsIds || []);
      if (current.has(id)) current.delete(id);
      else current.add(id);
      return { ...prev, applicableEpsIds: Array.from(current) };
    });
  };

  const toggleLinkedActivity = (id: number) => {
    setTemplateForm((prev) => {
      const current = new Set(prev.linkedActivityIds || []);
      if (current.has(id)) current.delete(id);
      else current.add(id);
      return {
        ...prev,
        linkedActivityIds: Array.from(current),
        triggerType: current.size > 0 ? "PROGRESS_PCT" : "MANUAL",
      };
    });
  };

  const saveTemplate = async () => {
    if (!templateForm.name.trim()) return alert("Template name is required");
    const payload: CustomerMilestoneTemplateDto = {
      ...templateForm,
      triggerType:
        (templateForm.linkedActivityIds || []).length > 0 ? "PROGRESS_PCT" : "MANUAL",
    };
    if (templateForm.id) {
      await customerMilestoneService.updateTemplate(pId, templateForm.id, payload);
    } else {
      await customerMilestoneService.createTemplate(pId, payload);
    }
    setTemplateForm(blankTemplate());
    await loadAll();
  };

  const saveFlatSale = async () => {
    if (!saleForm.unitLabel.trim()) return alert("Unit label is required");
    if (saleForm.id) {
      await customerMilestoneService.updateFlatSale(pId, saleForm.id, saleForm);
    } else {
      await customerMilestoneService.createFlatSale(pId, saleForm);
    }
    setSaleForm(blankSale());
    await loadAll();
  };

  const cloneTemplates = async () => {
    if (!cloneSourceTowerId || cloneTargetTowerIds.length === 0) {
      return alert("Choose one source tower and at least one target tower.");
    }
    await customerMilestoneService.cloneTowerTemplates(pId, {
      sourceTowerId: Number(cloneSourceTowerId),
      targetTowerIds: cloneTargetTowerIds,
    });
    setCloneSourceTowerId("");
    setCloneTargetTowerIds([]);
    await loadAll();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Customer Milestones</h1>
          <p className="text-sm text-text-muted">
            Define collection milestones by tower, floor, or unit and tie them to the latest
            working schedule with manual fallback where needed.
          </p>
        </div>
        <button
          onClick={() => void loadAll()}
          className="flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-sm"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border-default bg-surface-base p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted">Templates</div>
          <div className="mt-2 text-2xl font-bold text-text-primary">{templates.length}</div>
        </div>
        <div className="rounded-2xl border border-border-default bg-surface-base p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted">Total Due</div>
          <div className="mt-2 text-2xl font-bold text-text-primary">{formatCurrency(totalDue)}</div>
        </div>
        <div className="rounded-2xl border border-border-default bg-surface-base p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted">Collected</div>
          <div className="mt-2 text-2xl font-bold text-text-primary">
            {formatCurrency(totalCollected)}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {(["templates", "sales", "tracker"] as MilestoneTab[]).map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === item ? "bg-primary text-white" : "border border-border-default bg-surface-card"
            }`}
          >
            {item === "templates"
              ? "Milestone Templates"
              : item === "sales"
                ? "Flat Sale Info"
                : "Unit Tracker"}
          </button>
        ))}
      </div>

      {tab === "templates" && (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[430px,1fr]">
            <div className="rounded-2xl border border-border-default bg-surface-card p-4">
              <h2 className="mb-3 text-lg font-bold">Template Setup</h2>
              <div className="space-y-3">
                <input
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Milestone name"
                  className="w-full rounded-lg border border-border-default px-3 py-2"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    value={templateForm.sequence}
                    onChange={(e) =>
                      setTemplateForm((p) => ({ ...p, sequence: Number(e.target.value) || 1 }))
                    }
                    placeholder="Sequence"
                    className="rounded-lg border border-border-default px-3 py-2"
                  />
                  <input
                    value={templateForm.collectionPct}
                    onChange={(e) => setTemplateForm((p) => ({ ...p, collectionPct: e.target.value }))}
                    placeholder="Collection %"
                    className="rounded-lg border border-border-default px-3 py-2"
                  />
                </div>
                <select
                  value={templateForm.applicableTo}
                  onChange={(e) =>
                    setTemplateForm((p) => ({
                      ...p,
                      applicableTo: e.target.value as CustomerMilestoneTemplateDto["applicableTo"],
                      applicableEpsIds: [],
                    }))
                  }
                  className="w-full rounded-lg border border-border-default px-3 py-2"
                >
                  <option value="tower">Tower Level</option>
                  <option value="floor">Floor Level</option>
                  <option value="unit">Unit Level</option>
                  <option value="all_units">Project Wide</option>
                </select>

                {templateForm.applicableTo !== "all_units" && (
                  <div className="rounded-xl border border-border-default p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                      Applies To
                    </div>
                    <div className="mt-2 max-h-48 space-y-2 overflow-auto">
                      {selectedScopeOptions.map((option) => (
                        <label key={option.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={(templateForm.applicableEpsIds || []).includes(option.id)}
                            onChange={() => toggleScopeId(option.id)}
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-border-default p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Linked Schedule Activities
                  </div>
                  <div className="mt-2 max-h-56 space-y-2 overflow-auto">
                    {activityOptions.map((activity) => (
                      <label key={activity.id} className="flex items-start gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={(templateForm.linkedActivityIds || []).includes(activity.id)}
                          onChange={() => toggleLinkedActivity(activity.id)}
                          className="mt-1"
                        />
                        <span>
                          <span className="font-medium text-text-primary">
                            {activity.activityCode} - {activity.activityName}
                          </span>
                          <span className="block text-xs text-text-muted">
                            Planned: {activity.plannedFinish || "Not in active working schedule"} •
                            Actual: {activity.actualFinish || "Not completed"}
                          </span>
                        </span>
                      </label>
                    ))}
                    {!activityOptions.length && (
                      <div className="text-sm text-text-muted">
                        No working schedule activities found. You can still keep this milestone manual.
                      </div>
                    )}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={templateForm.allowManualCompletion !== false}
                    onChange={(e) =>
                      setTemplateForm((p) => ({
                        ...p,
                        allowManualCompletion: e.target.checked,
                      }))
                    }
                  />
                  Allow manual completion fallback
                </label>

                <textarea
                  value={templateForm.description || ""}
                  onChange={(e) => setTemplateForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Description"
                  rows={3}
                  className="w-full rounded-lg border border-border-default px-3 py-2"
                />
                <button
                  onClick={() => void saveTemplate()}
                  className="w-full rounded-lg bg-primary px-3 py-2 font-medium text-white"
                >
                  {templateForm.id ? "Update Template" : "Save Template"}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border-default bg-surface-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <CopyPlus className="h-4 w-4 text-primary" />
                  <h2 className="text-lg font-bold">Clone Tower Templates</h2>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <select
                    value={cloneSourceTowerId}
                    onChange={(e) => setCloneSourceTowerId(e.target.value ? Number(e.target.value) : "")}
                    className="rounded-lg border border-border-default px-3 py-2"
                  >
                    <option value="">Select source tower</option>
                    {scopeOptions.map((tower) => (
                      <option key={tower.towerId} value={tower.towerId}>
                        {tower.towerName}
                      </option>
                    ))}
                  </select>
                  <div className="rounded-xl border border-border-default p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                      Target Towers
                    </div>
                    <div className="mt-2 space-y-2">
                      {scopeOptions
                        .filter((tower) => tower.towerId !== cloneSourceTowerId)
                        .map((tower) => (
                          <label key={tower.towerId} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={cloneTargetTowerIds.includes(tower.towerId)}
                              onChange={() =>
                                setCloneTargetTowerIds((prev) =>
                                  prev.includes(tower.towerId)
                                    ? prev.filter((id) => id !== tower.towerId)
                                    : [...prev, tower.towerId],
                                )
                              }
                            />
                            {tower.towerName}
                          </label>
                        ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => void cloneTemplates()}
                  className="mt-3 rounded-lg border border-border-default px-3 py-2 text-sm font-medium"
                >
                  Clone Structure Without Activity Links
                </button>
              </div>

              <div className="rounded-2xl border border-border-default bg-surface-card p-4">
                <h2 className="mb-3 text-lg font-bold">Configured Milestones</h2>
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="rounded-xl border border-border-subtle p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-text-primary">
                            {template.sequence}. {template.name}
                          </div>
                          <div className="text-xs text-text-muted">
                            {template.applicableTo} • {template.collectionPct}% •{" "}
                            {template.linkedActivities?.length
                              ? `${template.linkedActivities.length} linked schedule activities`
                              : "manual only"}
                          </div>
                          {template.linkedActivities?.length ? (
                            <div className="mt-2 text-xs text-text-muted">
                              {template.linkedActivities
                                .map((item: any) => `${item.activityCode} ${item.activityName}`)
                                .join(", ")}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              setTemplateForm({
                                ...template,
                                linkedActivityIds: template.linkedActivityIds || [],
                              })
                            }
                            className="rounded-lg border border-border-default px-3 py-2 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm("Delete template?")) return;
                              await customerMilestoneService.deleteTemplate(pId, template.id);
                              await loadAll();
                            }}
                            className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!templates.length && !loading && (
                    <div className="rounded-xl border border-dashed border-border-default p-6 text-sm text-text-muted">
                      No milestone templates configured yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "sales" && (
        <div className="grid gap-4 xl:grid-cols-[360px,1fr]">
          <div className="rounded-2xl border border-border-default bg-surface-card p-4">
            <h2 className="mb-3 text-lg font-bold">Flat Sale Info</h2>
            <div className="space-y-3">
              <input value={saleForm.unitLabel} onChange={(e) => setSaleForm((p) => ({ ...p, unitLabel: e.target.value }))} placeholder="Unit label" className="w-full rounded-lg border border-border-default px-3 py-2" />
              <input type="number" value={saleForm.qualityUnitId || ""} onChange={(e) => setSaleForm((p) => ({ ...p, qualityUnitId: e.target.value ? Number(e.target.value) : null }))} placeholder="Quality unit id" className="w-full rounded-lg border border-border-default px-3 py-2" />
              <input value={saleForm.totalSaleValue} onChange={(e) => setSaleForm((p) => ({ ...p, totalSaleValue: e.target.value }))} placeholder="Sale value" className="w-full rounded-lg border border-border-default px-3 py-2" />
              <input value={saleForm.customerName || ""} onChange={(e) => setSaleForm((p) => ({ ...p, customerName: e.target.value }))} placeholder="Customer name" className="w-full rounded-lg border border-border-default px-3 py-2" />
              <input value={saleForm.agreementDate || ""} onChange={(e) => setSaleForm((p) => ({ ...p, agreementDate: e.target.value }))} type="date" className="w-full rounded-lg border border-border-default px-3 py-2" />
              <input value={saleForm.loanBank || ""} onChange={(e) => setSaleForm((p) => ({ ...p, loanBank: e.target.value }))} placeholder="Loan bank" className="w-full rounded-lg border border-border-default px-3 py-2" />
              <button onClick={() => void saveFlatSale()} className="w-full rounded-lg bg-primary px-3 py-2 font-medium text-white">
                {saleForm.id ? "Update Sale Info" : "Save Sale Info"}
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-border-default bg-surface-card p-4">
            <h2 className="mb-3 text-lg font-bold">Saved Sale Information</h2>
            <div className="space-y-2">
              {flatSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between rounded-xl border border-border-subtle p-3">
                  <div>
                    <div className="font-semibold">{sale.unitLabel}</div>
                    <div className="text-xs text-text-muted">{formatCurrency(Number(sale.totalSaleValue || 0))} • {sale.customerName || "No customer name"}</div>
                  </div>
                  <button onClick={() => setSaleForm(sale)} className="rounded-lg border border-border-default px-3 py-2 text-sm">Edit</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "tracker" && (
        <div className="rounded-2xl border border-border-default bg-surface-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Unit Milestone Tracker</h2>
            <button onClick={async () => { await customerMilestoneService.recompute(pId); await loadAll(); }} className="rounded-lg border border-border-default px-3 py-2 text-sm">
              Recompute Triggers
            </button>
          </div>
          <div className="space-y-4">
            {units.map((unit) => (
              <div key={`${unit.qualityUnitId}-${unit.unitLabel}`} className="rounded-xl border border-border-subtle p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-text-primary">{unit.unitLabel}</div>
                    <div className="text-xs text-text-muted">
                      Sale Value: {formatCurrency(Number(unit.saleValue || 0))} • Collected: {formatCurrency(Number(unit.collectedAmount || 0))}
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {(unit.milestones || []).map((milestone: any) => (
                    <div key={milestone.id} className="rounded-xl border border-border-default bg-surface-base p-3">
                      <div className="font-medium text-text-primary">{milestone.template?.name}</div>
                      <div className="mt-1 text-xs text-text-muted">
                        {milestone.status} • {Number(milestone.collectionPct || 0)}% • {formatCurrency(Number(milestone.collectionAmount || 0))}
                      </div>
                      <div className="mt-1 text-xs text-text-muted">
                        Planned: {milestone.plannedCompletionDate || "Not linked"} • Actual: {milestone.actualCompletionDate || "Pending"}
                      </div>
                      <div className="mt-1 text-xs text-text-muted">
                        Source: {milestone.completionSource || (milestone.template?.linkedActivities?.length ? "Schedule" : "Manual")}
                      </div>
                      {milestone.linkedActivities?.length ? (
                        <div className="mt-2 text-xs text-text-muted">
                          {milestone.linkedActivities.map((item: any) => item.activityCode).join(", ")}
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {milestone.status === "not_triggered" && milestone.template?.allowManualCompletion !== false && (
                          <button onClick={async () => {
                            const completionDate = prompt("Completion date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
                            if (!completionDate) return;
                            const remarks = prompt("Remarks", "Manual completion override") || undefined;
                            await customerMilestoneService.manualTrigger(pId, milestone.id, { completionDate, remarks });
                            await loadAll();
                          }} className="rounded-lg border border-border-default px-3 py-1.5 text-xs">Mark Complete</button>
                        )}
                        {(milestone.status === "triggered" || milestone.status === "partially_collected") && (
                          <button onClick={async () => { const invoiceNumber = prompt("Invoice number"); if (!invoiceNumber) return; const invoiceDate = prompt("Invoice date (YYYY-MM-DD)", new Date().toISOString().slice(0,10)); if (!invoiceDate) return; await customerMilestoneService.raiseInvoice(pId, milestone.id, { invoiceNumber, invoiceDate }); await loadAll(); }} className="rounded-lg border border-border-default px-3 py-1.5 text-xs">Raise Invoice</button>
                        )}
                        {(milestone.status === "invoice_raised" || milestone.status === "partially_collected") && (
                          <button onClick={async () => { const amount = prompt("Amount received"); if (!amount) return; const receivedDate = prompt("Received date (YYYY-MM-DD)", new Date().toISOString().slice(0,10)); if (!receivedDate) return; await customerMilestoneService.addTranche(pId, milestone.id, { amount, receivedDate, paymentMode: "neft", referenceNumber: `REF-${Date.now()}` }); await loadAll(); }} className="rounded-lg border border-border-default px-3 py-1.5 text-xs">Add Collection</button>
                        )}
                        {milestone.status !== "waived" && (
                          <button onClick={async () => { await customerMilestoneService.updateStatus(pId, milestone.id, { status: "waived" }); await loadAll(); }} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600">Waive</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!units.length && !loading && (
              <div className="rounded-xl border border-dashed border-border-default p-6 text-sm text-text-muted">
                No unit milestones available yet. Add sale info and milestone templates first.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
