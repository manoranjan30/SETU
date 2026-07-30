import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  FileScan,
  Globe2,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { qualityService } from "../../../services/quality.service";
import {
  BatchSlipFieldKey,
  type QualityBatchSlipFieldSynonym,
  type QualityBatchSlipResolvedConfig,
} from "../../../types/quality";

type Props = {
  projectId: number;
};

const FIELD_OPTIONS: Array<{ key: BatchSlipFieldKey; label: string }> = [
  { key: BatchSlipFieldKey.TRUCK_NO, label: "Truck No" },
  { key: BatchSlipFieldKey.DELIVERY_CHALLAN_NO, label: "Delivery Challan No" },
  { key: BatchSlipFieldKey.MIX_GRADE, label: "Mix Grade" },
  { key: BatchSlipFieldKey.QUANTITY_M3, label: "Quantity m3" },
  { key: BatchSlipFieldKey.SLUMP_MM, label: "Slump mm" },
  { key: BatchSlipFieldKey.BATCH_START_TIME, label: "Batch Start Time" },
  { key: BatchSlipFieldKey.SUPPLIER_NAME, label: "Supplier Name" },
];

export default function BatchSlipScanConfigPage({ projectId }: Props) {
  const [synonyms, setSynonyms] = useState<QualityBatchSlipFieldSynonym[]>([]);
  const [resolved, setResolved] = useState<QualityBatchSlipResolvedConfig>({});
  const [fieldKey, setFieldKey] = useState<BatchSlipFieldKey>(
    BatchSlipFieldKey.TRUCK_NO,
  );
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<"PROJECT" | "GLOBAL">("PROJECT");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, resolvedConfig] = await Promise.all([
        qualityService.listBatchSlipSynonyms(projectId),
        qualityService.getBatchSlipConfig(projectId),
      ]);
      setSynonyms(rows);
      setResolved(resolvedConfig);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to load batch slip scan configuration.",
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const grouped = useMemo(() => {
    return FIELD_OPTIONS.map((field) => ({
      ...field,
      rows: synonyms.filter((item) => item.fieldKey === field.key),
      resolvedLabels: resolved[field.key] ?? [],
    }));
  }, [resolved, synonyms]);

  const addSynonym = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await qualityService.createBatchSlipSynonym({
        projectId: scope === "PROJECT" ? projectId : null,
        fieldKey,
        label,
      });
      setLabel("");
      await loadConfig();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to save batch slip label.",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: QualityBatchSlipFieldSynonym) => {
    setError(null);
    const updated = await qualityService.updateBatchSlipSynonym(item.id, {
      isActive: !item.isActive,
    });
    setSynonyms((current) =>
      current.map((row) => (row.id === updated.id ? updated : row)),
    );
    setResolved(await qualityService.getBatchSlipConfig(projectId));
  };

  const deleteSynonym = async (id: number) => {
    setError(null);
    await qualityService.deleteBatchSlipSynonym(id);
    await loadConfig();
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileScan className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-base font-semibold text-text-primary">
              Batch Slip Scan Config
            </h3>
            <p className="text-xs text-text-muted">
              Literal labels used by mobile OCR field matching.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadConfig()}
          className="inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={(event) => void addSynonym(event)}
        className="grid gap-3 rounded-lg border border-border-default bg-surface-card p-4 md:grid-cols-[1.1fr_1fr_1.4fr_auto]"
      >
        <label className="space-y-1 text-xs font-medium text-text-muted">
          Field
          <select
            value={fieldKey}
            onChange={(event) => setFieldKey(event.target.value as BatchSlipFieldKey)}
            className="h-10 w-full rounded-lg border border-border-default bg-surface-base px-3 text-sm text-text-primary"
          >
            {FIELD_OPTIONS.map((field) => (
              <option key={field.key} value={field.key}>
                {field.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-xs font-medium text-text-muted">
          Scope
          <select
            value={scope}
            onChange={(event) =>
              setScope(event.target.value as "PROJECT" | "GLOBAL")
            }
            className="h-10 w-full rounded-lg border border-border-default bg-surface-base px-3 text-sm text-text-primary"
          >
            <option value="PROJECT">This project</option>
            <option value="GLOBAL">Global default</option>
          </select>
        </label>

        <label className="space-y-1 text-xs font-medium text-text-muted">
          Label
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            minLength={2}
            maxLength={60}
            required
            placeholder="e.g. Vehicle No"
            className="h-10 w-full rounded-lg border border-border-default bg-surface-base px-3 text-sm text-text-primary"
          />
        </label>

        <button
          type="submit"
          disabled={saving || label.trim().length < 2}
          className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </button>
      </form>

      {loading ? (
        <div className="flex items-center gap-2 rounded-lg border border-border-default bg-surface-card p-4 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading batch slip labels...
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {grouped.map((field) => (
            <section
              key={field.key}
              className="rounded-lg border border-border-default bg-surface-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-text-primary">
                    {field.label}
                  </h4>
                  <div className="mt-1 text-xs text-text-muted">{field.key}</div>
                </div>
                <div className="rounded-full bg-surface-raised px-2 py-1 text-xs font-semibold text-text-muted">
                  {field.resolvedLabels.length} active
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {field.rows.length === 0 ? (
                  <span className="text-sm text-text-muted">No labels added.</span>
                ) : (
                  field.rows.map((item) => (
                    <div
                      key={item.id}
                      className={`flex max-w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-sm ${
                        item.isActive
                          ? "border-border-default bg-surface-base text-text-primary"
                          : "border-border-default bg-surface-raised text-text-muted"
                      }`}
                    >
                      {item.projectId === null ? (
                        <Globe2 className="h-4 w-4 shrink-0 text-text-muted" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                      )}
                      <span className="min-w-0 break-words">{item.label}</span>
                      <button
                        type="button"
                        onClick={() => void toggleActive(item)}
                        className="shrink-0 rounded border border-border-default px-2 py-0.5 text-xs font-medium hover:bg-surface-raised"
                      >
                        {item.isActive ? "Active" : "Inactive"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteSynonym(item.id)}
                        className="shrink-0 rounded p-1 text-red-600 hover:bg-red-50"
                        title="Delete label"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {field.resolvedLabels.length > 0 && (
                <div className="mt-3 border-t border-border-default pt-3 text-xs text-text-muted">
                  {field.resolvedLabels.join(", ")}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
