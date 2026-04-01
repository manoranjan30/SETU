import React, { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import api from "../../../api/axios";
import type {
  ImportColumnMapping,
  ImportFieldDefinition,
  ImportPreviewResult,
} from "../../../types/data-transfer";
import {
  autoMapHeaders,
  readSpreadsheetPreview,
} from "../../../utils/import-staging.utils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  onSuccess: () => void;
}

interface WoMapperImportRow {
  __rowIndex: number;
  __rowNumber: number;
  activitycode?: string;
  activityname?: string;
  wbspath?: string;
  currentlinkedwocodes?: string;
  currentlinkedwonames?: string;
  notes?: string;
  requestedwomarks?: string;
  resolvednewwocodes?: string;
  resolvednewwonames?: string;
  alreadylinkedwocodes?: string;
  invalidwocolumns?: string;
  importStatus?: "READY" | "PARTIAL" | "SKIP_EXISTING" | "IGNORED" | "ERROR";
  importMessage?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

interface ImportSummary {
  totalRows: number;
  readyRows: number;
  partialRows: number;
  skippedExistingRows: number;
  ignoredRows: number;
  errorRows: number;
}

const WO_IMPORT_FIELDS: ImportFieldDefinition[] = [
  {
    key: "activitycode",
    label: "Activity Code",
    required: true,
    aliases: ["activity code", "activitycode", "code"],
  },
  {
    key: "activityname",
    label: "Activity Name",
    aliases: ["activity name", "activityname", "name"],
  },
  {
    key: "wbspath",
    label: "WBS Path",
    aliases: ["wbs path", "wbspath"],
  },
  {
    key: "currentlinkedwocodes",
    label: "Current Linked WO Codes",
    aliases: [
      "current linked wo codes",
      "currentlinkedwocodes",
      "linked wo codes",
    ],
  },
  {
    key: "currentlinkedwonames",
    label: "Current Linked WO Names",
    aliases: [
      "current linked wo names",
      "currentlinkedwonames",
      "linked wo names",
    ],
  },
  {
    key: "notes",
    label: "Notes",
    aliases: ["notes", "remarks", "comments"],
  },
];

const WoBulkMappingImportWizard: React.FC<Props> = ({
  isOpen,
  onClose,
  projectId,
  onSuccess,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [localPreview, setLocalPreview] = useState<ImportPreviewResult | null>(
    null,
  );
  const [columnMapping, setColumnMapping] = useState<ImportColumnMapping>({});
  const [preflightErrors, setPreflightErrors] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<WoMapperImportRow[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasDynamicWoHeaders = (headers: string[] = []) =>
    headers.some((header) => /^wo\s+/i.test(header.trim()));

  const hasLinkedWoReferenceColumns = (mapping: ImportColumnMapping) =>
    Boolean(mapping.currentlinkedwonames || mapping.currentlinkedwocodes);

  const validateMappings = (
    mapping: ImportColumnMapping,
    headers: string[] = [],
  ) => {
    const errors: string[] = [];
    if (!mapping.activitycode) errors.push("Activity Code");
    if (!hasDynamicWoHeaders(headers) && !hasLinkedWoReferenceColumns(mapping)) {
      errors.push("WO Matrix Columns or Current Linked WO Names/Codes");
    }
    return errors;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setStep(1);
    setPreviewData([]);
    setSummary(null);
    setValidation(null);

    readSpreadsheetPreview(selectedFile, 10)
      .then((parsed) => {
        setLocalPreview(parsed);
        const autoMapping = autoMapHeaders(parsed.headers, WO_IMPORT_FIELDS);
        setColumnMapping(autoMapping);
        const missing = validateMappings(autoMapping, parsed.headers);
        setPreflightErrors(
          missing.length > 0
            ? [`Missing required columns: ${missing.join(", ")}`]
            : [],
        );
      })
      .catch(() => {
        setLocalPreview(null);
        setColumnMapping({});
        setPreflightErrors(["Failed to read the selected file."]);
      });
  };

  const handlePreview = async () => {
    if (!file) return;
    const missing = validateMappings(columnMapping, localPreview?.headers || []);
    if (missing.length > 0) {
      const message = `Missing required columns: ${missing.join(", ")}`;
      setPreflightErrors([message]);
      alert(message);
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mapping", JSON.stringify(columnMapping));

    try {
      const response = await api.post(
        `/planning/${projectId}/wo-mapper/import/preview`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      setPreviewData(response.data.data || []);
      setSummary(response.data.summary || null);
      setValidation(response.data.validation || null);
      setStep(2);
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to preview import");
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (
      !summary ||
      (!summary.readyRows && !summary.partialRows) ||
      !validation?.isValid
    ) {
      return;
    }
    setLoading(true);
    try {
      const actionableRows = previewData
        .filter(
          (row) =>
            row.importStatus === "READY" || row.importStatus === "PARTIAL",
        )
        .map((row) => ({
          __rowNumber: row.__rowNumber,
          activitycode: row.activitycode,
          resolvednewwoids: (row as any).resolvednewwoids,
          importStatus: row.importStatus,
        }));

      await api.post(`/planning/${projectId}/wo-mapper/import/commit`, {
        data: actionableRows,
      });
      setStep(3);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 800);
    } catch (error: any) {
      const responseData = error.response?.data;
      const detailLines = Array.isArray(responseData?.details)
        ? responseData.details.join("\n")
        : "";
      alert(
        detailLines
          ? `${responseData?.message || "Failed to import WO links"}\n\n${detailLines}`
          : responseData?.message || "Failed to import WO links",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const missingMappings = validateMappings(
    columnMapping,
    localPreview?.headers || [],
  );
  const canPreview = !!file && !loading && missingMappings.length === 0;
  const previewRowsToShow = previewData.slice(0, 12);
  const hasActionableRows = Boolean(summary?.readyRows || summary?.partialRows);
  const canCommit = Boolean(!loading && validation?.isValid && hasActionableRows);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70">
      <div className="flex h-[720px] w-[1080px] flex-col rounded-lg bg-surface-card shadow-xl">
        <div className="flex items-center justify-between border-b p-6">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <FileSpreadsheet className="h-5 w-5 text-success" />
              Import Filled Link Sheet
            </h3>
            <div className="mt-1 flex gap-2">
              {["1. Upload", "2. Preview & Validate", "3. Finish"].map(
                (label, index) => (
                  <span
                    key={label}
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      step === index + 1
                        ? "bg-info-muted font-bold text-blue-700"
                        : "bg-surface-raised text-text-muted"
                    }`}
                  >
                    {label}
                  </span>
                ),
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-disabled hover:text-text-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border border-blue-200 bg-info-muted p-4 text-sm text-blue-800">
                <div className="font-semibold">How to fill this file</div>
                <div className="mt-1">
                  Use the WO name columns like the frontend mapper and put <b>1</b>{" "}
                  under the WO items you want to link. Current linked WO names and
                  codes stay in the sheet for reference. Use the ordered{" "}
                  <b>WO Name List</b> / <b>WO Reference</b> sheets to pick the
                  correct WO names while filling the matrix.
                </div>
              </div>

              <div
                className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border-default transition-colors hover:bg-surface-base"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mb-4 h-12 w-12 text-text-disabled" />
                <div className="text-lg font-semibold text-text-secondary">
                  Click to upload filled WO link sheet
                </div>
                <div className="mt-2 text-sm text-text-disabled">
                  Supported formats: .xlsx, .xls, .csv
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {file && (
                  <div className="mt-4 rounded border border-blue-200 bg-primary-muted px-3 py-2 text-blue-700">
                    {file.name}
                  </div>
                )}
              </div>

              {localPreview && (
                <div className="rounded-lg border border-border-default bg-surface-card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-text-primary">
                        Client-side preflight
                      </div>
                      <div className="text-xs text-text-muted">
                        {localPreview.totalRows} rows detected •{" "}
                        {localPreview.headers.length} columns
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                        preflightErrors.length === 0
                          ? "bg-success-muted text-success"
                          : "bg-error-muted text-error"
                      }`}
                    >
                      {preflightErrors.length === 0 ? "Ready" : "Needs Fix"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {localPreview.headers.map((header) => (
                      <span
                        key={header}
                        className="rounded-full border border-border-default bg-surface-base px-2 py-1 text-[11px] text-text-secondary"
                      >
                        {header}
                      </span>
                    ))}
                  </div>
                  {preflightErrors.length > 0 && (
                    <div className="mt-3 rounded-md border border-red-200 bg-error-muted px-3 py-2 text-xs text-error">
                      {preflightErrors.map((error) => (
                        <div key={error}>{error}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {localPreview && (
                <div className="rounded-lg border border-border-default bg-surface-card p-4">
                  <div className="text-sm font-semibold text-text-primary">
                    Column Mapping
                  </div>
                  <div className="mt-1 text-xs text-text-muted">
                    The downloaded sheet should auto-map. Use this only if your
                    activity columns are different. The WO matrix columns are
                    detected automatically.
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {WO_IMPORT_FIELDS.map((field) => (
                      <label
                        key={field.key}
                        className="rounded-md border border-border-default bg-surface-base p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-text-secondary">
                            {field.label}
                          </span>
                          {field.key === "activitycode" && (
                            <span className="rounded-full bg-error-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-error">
                              Required
                            </span>
                          )}
                        </div>
                        <select
                          value={columnMapping[field.key] || ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            setColumnMapping((current) => {
                              const next = { ...current };
                              if (!value) delete next[field.key];
                              else next[field.key] = value;
                              const missing = validateMappings(
                                next,
                                localPreview?.headers || [],
                              );
                              setPreflightErrors(
                                missing.length > 0
                                  ? [
                                      `Missing required columns: ${missing.join(", ")}`,
                                    ]
                                  : [],
                              );
                              return next;
                            });
                          }}
                          className="mt-2 w-full rounded border border-border-default bg-white px-2 py-2 text-sm text-text-primary"
                        >
                          <option value="">Not mapped</option>
                          {localPreview.headers.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              {summary && (
                <div className="mb-4 grid grid-cols-6 gap-3">
                  {[
                    ["Total Rows", summary.totalRows, "border-border-default bg-surface-card text-text-primary"],
                    ["Ready", summary.readyRows, "border-green-200 bg-green-50 text-green-700"],
                    ["Partial", summary.partialRows, "border-blue-200 bg-blue-50 text-blue-700"],
                    ["Skip Existing", summary.skippedExistingRows, "border-amber-200 bg-amber-50 text-amber-700"],
                    ["Ignored", summary.ignoredRows, "border-slate-200 bg-slate-50 text-slate-700"],
                    ["Errors", summary.errorRows, "border-red-200 bg-red-50 text-red-700"],
                  ].map(([label, value, classes]) => (
                    <div key={String(label)} className={`rounded-lg border p-3 ${classes}`}>
                      <div className="text-[11px] font-bold uppercase tracking-wide">
                        {label}
                      </div>
                      <div className="mt-1 text-lg font-bold">{value}</div>
                    </div>
                  ))}
                </div>
              )}

              {validation?.isValid ? (
                <div className="mb-4 flex items-center gap-2 rounded border border-green-200 bg-success-muted p-3 text-green-700">
                  <CheckCircle className="h-5 w-5" />
                  Preview ready. Review the activity-level WO links below.
                </div>
              ) : (
                <div className="mb-4 rounded border border-red-200 bg-error-muted p-3 text-red-700">
                  <div className="mb-2 flex items-center gap-2 font-bold">
                    <AlertTriangle className="h-5 w-5" />
                    Validation Failed
                  </div>
                  <ul className="list-disc pl-5 text-sm">
                    {(validation?.errors || []).map((error, index) => (
                      <li key={`${error}-${index}`}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="max-h-[360px] overflow-auto rounded-lg border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-surface-raised text-text-secondary">
                    <tr>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Activity</th>
                      <th className="px-3 py-2">Current Links</th>
                      <th className="px-3 py-2">Marked With 1</th>
                      <th className="px-3 py-2">New WO Links</th>
                      <th className="px-3 py-2">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewRowsToShow.map((row) => (
                      <tr key={row.__rowNumber} className="hover:bg-surface-base">
                        <td className="px-3 py-2 align-top">
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                              row.importStatus === "READY"
                                ? "bg-success-muted text-success"
                                : row.importStatus === "PARTIAL"
                                  ? "bg-blue-100 text-blue-700"
                                  : row.importStatus === "SKIP_EXISTING"
                                    ? "bg-warning-muted text-warning"
                                    : row.importStatus === "IGNORED"
                                      ? "bg-slate-100 text-slate-700"
                                      : "bg-error-muted text-error"
                            }`}
                          >
                            {row.importStatus}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="font-mono text-xs">{row.activitycode}</div>
                          <div className="text-xs text-text-secondary">
                            {row.activityname}
                          </div>
                          <div className="mt-1 text-[11px] text-text-muted">
                            {row.wbspath}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="font-mono text-xs">
                            {row.currentlinkedwocodes || "-"}
                          </div>
                          <div className="mt-1 text-[11px] text-text-muted">
                            {row.currentlinkedwonames || ""}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="text-xs">{row.requestedwomarks || "-"}</div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="font-mono text-xs text-green-700">
                            {row.resolvednewwocodes || "-"}
                          </div>
                          <div className="mt-1 text-[11px] text-text-muted">
                            {row.resolvednewwonames || ""}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top text-xs text-text-secondary">
                          {row.importMessage}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <CheckCircle className="mb-4 h-16 w-16 text-success" />
              <div className="text-xl font-bold text-text-primary">
                WO links imported successfully
              </div>
              <div className="mt-2 text-sm text-text-muted">
                The WO Qty Mapper will refresh automatically.
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t bg-surface-card p-4">
          <div className="text-xs text-text-muted">
            {step === 2 && !canCommit
              ? validation?.isValid
                ? "No new WO links are ready to import from this file yet."
                : "Fix the preview validation issues to enable import."
              : "\u00A0"}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-4 py-2 text-text-secondary hover:bg-surface-base"
            >
              Cancel
            </button>
            {step === 1 && (
              <button
                type="button"
                onClick={handlePreview}
                disabled={!canPreview}
                className="flex items-center gap-2 rounded bg-primary px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:border disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Preview
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            )}
            {step === 2 && (
              <button
                type="button"
                onClick={handleCommit}
                disabled={!canCommit}
                className="rounded bg-success px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:border disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500"
              >
                {loading ? "Importing..." : "Import WO Links"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WoBulkMappingImportWizard;
