import React, { useState, useRef } from "react";
import api from "../../api/axios";
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ArrowRight,
  X,
} from "lucide-react";
import { downloadBlob, withFileExtension } from "../../utils/file-download.utils";
import type { ImportColumnMapping, ImportFieldDefinition, ImportPreviewResult } from "../../types/data-transfer";
import { autoMapHeaders, readSpreadsheetPreview, validateRequiredMappings } from "../../utils/import-staging.utils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  onSuccess: () => void;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  rowErrors?: Record<number, string[]>;
}

interface ImportSummary {
  totalRows: number;
  readyRows: number;
  skippedExistingRows: number;
  errorRows: number;
}

const WBS_IMPORT_FIELDS: ImportFieldDefinition[] = [
  { key: "wbscode", label: "WBS Code", required: true, aliases: ["wbs code", "code"] },
  { key: "wbsname", label: "WBS Name", required: true, aliases: ["wbs name", "name"] },
  { key: "parentwbscode", label: "Parent WBS Code", aliases: ["parent wbs code", "parent code"] },
  { key: "iscontrolaccount", label: "Control Account", aliases: ["is control account", "control account"] },
  { key: "activitycode", label: "Activity Code", aliases: ["activity code"] },
  { key: "activityname", label: "Activity Name", aliases: ["activity name"] },
  { key: "type", label: "Type" },
  { key: "duration", label: "Duration", aliases: ["duration planned"] },
  { key: "responsiblerole", label: "Responsible Role", aliases: ["responsible role"] },
  { key: "responsibleuser", label: "Responsible User", aliases: ["responsible user"] },
];

const WbsImportWizard: React.FC<Props> = ({
  isOpen,
  onClose,
  projectId,
  onSuccess,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const [previewData, setPreviewData] = useState<any[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [localPreview, setLocalPreview] = useState<ImportPreviewResult | null>(null);
  const [preflightErrors, setPreflightErrors] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ImportColumnMapping>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setPreviewData([]);
    setValidation(null);
    setSummary(null);
    setStep(1);

    readSpreadsheetPreview(selectedFile, 8)
      .then((parsed) => {
        setLocalPreview(parsed);
        const autoMapping = autoMapHeaders(parsed.headers, WBS_IMPORT_FIELDS);
        setColumnMapping(autoMapping);
        const missingRequired = validateRequiredMappings(WBS_IMPORT_FIELDS, autoMapping);
        setPreflightErrors(
          missingRequired.length > 0
            ? [`Missing required columns: ${missingRequired.join(", ")}`]
            : [],
        );
      })
      .catch(() => {
        setLocalPreview(null);
        setColumnMapping({});
        setPreflightErrors(["Failed to read the selected file."]);
      });
  };

  const handleDownloadSample = () => {
    const headers = [
      "WBS Code,WBS Name,Parent WBS Code,Control Account,Activity Code,Activity Name,Type,Duration,Responsible Role,Responsible User",
    ];
    const rows = [
      "1,Substructure,,TRUE,,,,,,",
      "1.1,Excavation,1,FALSE,,,,,,",
      "1.1,,1,FALSE,A100,Excavate Pit,TASK,10,,",
      "1.2,Foundation,1,TRUE,,,,,,",
      "1.2,,1,TRUE,A200,Pour Concrete,TASK,5,,",
    ];
    const csvContent = headers.concat(rows).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, withFileExtension("wbs_import_sample_with_activities", ".csv"));
  };

  const handlePreview = async () => {
    if (!file) return;
    const missingRequired = validateRequiredMappings(WBS_IMPORT_FIELDS, columnMapping);
    if (missingRequired.length > 0) {
      const message = `Missing required columns: ${missingRequired.join(", ")}`;
      setPreflightErrors([message]);
      alert(message);
      return;
    }
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mapping", JSON.stringify(columnMapping));

    try {
      const res = await api.post(
        `/projects/${projectId}/wbs/import/preview`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      setPreviewData(res.data.data);
      setValidation(res.data.validation);
      setSummary(res.data.summary);
      setStep(2);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to upload preview");
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if ((validation && !validation.isValid) || !summary?.readyRows) return;
    setLoading(true);
    try {
      const res = await api.post(`/projects/${projectId}/wbs/import/commit`, {
        data: previewData,
      });
      const commitSummary = res.data;
      setStep(3); // Success
      setSummary({
        totalRows: previewData.length,
        readyRows: commitSummary.createdWbsCount + commitSummary.createdActivityCount,
        skippedExistingRows: commitSummary.skippedExistingWbsCount,
        errorRows: 0,
      });
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to commit import");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const mappingMissingRequired = validateRequiredMappings(WBS_IMPORT_FIELDS, columnMapping);
  const canPreview = !!file && !loading && mappingMissingRequired.length === 0;
  const previewRowsToShow = previewData.slice(0, 12);

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-surface-card rounded-lg shadow-xl w-[800px] h-[600px] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-success" />
              Import WBS
            </h3>
            <div className="flex gap-2 mt-1">
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${step === 1 ? "bg-info-muted text-blue-700 font-bold" : "bg-surface-raised text-text-muted"}`}
              >
                1. Upload
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${step === 2 ? "bg-info-muted text-blue-700 font-bold" : "bg-surface-raised text-text-muted"}`}
              >
                2. Preview & Validate
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${step === 3 ? "bg-info-muted text-blue-700 font-bold" : "bg-surface-raised text-text-muted"}`}
              >
                3. Finish
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-disabled hover:text-text-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {step === 1 && (
            <div className="flex flex-col h-full">
              <div
                className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border-default rounded-lg hover:bg-surface-base transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-12 h-12 text-text-disabled mb-4" />
                <p className="text-lg font-semibold text-text-secondary">
                  Click to upload spreadsheet
                </p>
                <p className="text-sm text-text-disabled mt-2">
                  Supported formats: .xlsx, .csv
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".xlsx,.csv"
                  onChange={handleFileChange}
                />
                {file && (
                  <div className="mt-4 flex items-center gap-2 p-2 bg-primary-muted text-blue-700 rounded border border-blue-200">
                    <FileSpreadsheet className="w-4 h-4" />
                    {file.name}
                  </div>
                )}
              </div>
              {localPreview && (
                <div className="mt-4 rounded-lg border border-border-default bg-surface-card p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-text-primary">
                        Client-side preflight
                      </div>
                      <div className="text-xs text-text-muted">
                        {localPreview.totalRows} rows detected • {localPreview.headers.length} columns
                      </div>
                    </div>
                    {preflightErrors.length === 0 ? (
                      <span className="rounded-full bg-success-muted px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-success">
                        Ready
                      </span>
                    ) : (
                      <span className="rounded-full bg-error-muted px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-error">
                        Needs Fix
                      </span>
                    )}
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
                <div className="mt-4 rounded-lg border border-border-default bg-surface-card p-4">
                  <div className="text-sm font-semibold text-text-primary">
                    Column Mapping
                  </div>
                  <div className="mt-1 text-xs text-text-muted">
                    Confirm how each uploaded column should be interpreted before preview.
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {WBS_IMPORT_FIELDS.map((field) => (
                      <label
                        key={field.key}
                        className="rounded-md border border-border-default bg-surface-base p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-text-secondary">
                            {field.label}
                          </span>
                          {field.required && (
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
                              const missing = validateRequiredMappings(WBS_IMPORT_FIELDS, next);
                              setPreflightErrors(
                                missing.length > 0
                                  ? [`Missing required columns: ${missing.join(", ")}`]
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
              <div className="mt-4 text-center">
                <button
                  onClick={handleDownloadSample}
                  className="text-primary text-sm hover:underline flex items-center justify-center gap-1 mx-auto"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Download Sample File
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              {summary && (
                <div className="mb-4 grid grid-cols-4 gap-3">
                  <div className="rounded-lg border border-border-default bg-surface-card p-3">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Total Rows</div>
                    <div className="mt-1 text-lg font-bold text-text-primary">{summary.totalRows}</div>
                  </div>
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-green-700">Ready</div>
                    <div className="mt-1 text-lg font-bold text-green-700">{summary.readyRows}</div>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Skip Existing</div>
                    <div className="mt-1 text-lg font-bold text-amber-700">{summary.skippedExistingRows}</div>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-red-700">Errors</div>
                    <div className="mt-1 text-lg font-bold text-red-700">{summary.errorRows}</div>
                  </div>
                </div>
              )}
              {/* Validation Status */}
              {validation?.isValid ? (
                <div className="mb-4 p-3 bg-success-muted text-green-700 rounded border border-green-200 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  <span>
                    Validation Successful! {summary?.readyRows || 0} rows are ready to import.
                  </span>
                </div>
              ) : (
                <div className="mb-4 p-3 bg-error-muted text-red-700 rounded border border-red-200">
                  <div className="flex items-center gap-2 font-bold mb-2">
                    <AlertTriangle className="w-5 h-5" />
                    Validation Failed
                  </div>
                  <ul className="list-disc list-inside text-sm">
                    {validation?.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-surface-raised text-text-secondary font-semibold border-b">
                    <tr>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">WBS Code</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Parent</th>
                      <th className="px-3 py-2">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewRowsToShow.map((row, i) => (
                      <tr key={i} className="hover:bg-surface-base">
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                              row.importStatus === "READY"
                                ? "bg-success-muted text-success"
                                : row.importStatus === "SKIP_EXISTING"
                                  ? "bg-warning-muted text-warning"
                                  : "bg-error-muted text-error"
                            }`}
                          >
                            {row.importStatus || "READY"}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {row.wbscode}
                        </td>
                        <td className="px-3 py-2">{row.wbsname}</td>
                        <td className="px-3 py-2 text-xs">{row.parentwbscode || "-"}</td>
                        <td className="px-3 py-2 text-xs text-text-secondary">
                          {row.importMessage || "Ready to import."}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewData.length > previewRowsToShow.length && (
                  <div className="p-2 text-center text-xs text-text-muted bg-surface-base border-t">
                    ...and {previewData.length - previewRowsToShow.length} more rows
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="h-full flex flex-col justify-center items-center text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
              <h4 className="text-xl font-bold text-gray-800">
                Import Successful!
              </h4>
              <p className="text-text-muted mt-2">
                Import completed with duplicate WBS codes skipped automatically.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step < 3 && (
          <div className="p-6 border-t bg-surface-base flex justify-end gap-3 rounded-b-lg">
            <button
              onClick={onClose}
              className="px-4 py-2 hover:bg-gray-200 rounded text-text-secondary"
            >
              Cancel
            </button>
            {step === 1 && (
              <button
                onClick={handlePreview}
                disabled={!canPreview}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Preview <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {step === 2 && (
              <button
                onClick={handleCommit}
                disabled={!validation?.isValid || loading || !summary?.readyRows}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Import Data
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WbsImportWizard;
