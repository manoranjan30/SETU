import { useState } from "react";
import {
  X,
  FileSpreadsheet,
  ArrowRight,
  CheckCircle2,
  Upload,
  Map,
  Download,
} from "lucide-react";
import { utils, writeFile } from "xlsx";
import api from "../../api/axios";
import type { ImportPreviewResult } from "../../types/data-transfer";
import { readSpreadsheetPreview } from "../../utils/import-staging.utils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSave: () => void;
  categories: any[];
}

const LaborImportModal = ({
  isOpen,
  onClose,
  projectId,
  onSave,
  categories,
}: Props) => {
  const [_file, _setFile] = useState<File | null>(null);
  const [excelData, setExcelData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [vendorHeader, setVendorHeader] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<ImportPreviewResult | null>(null);
  const [preflightErrors, setPreflightErrors] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, number>>({});
  const [step, setStep] = useState(1); // 1: Upload, 2: Map, 3: Verify
  const [loading, setLoading] = useState(false);
  const [importError, setImportError] = useState("");

  const normalizeHeader = (header: string) =>
    header.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  const isDateHeader = (header: string) =>
    ["date", "attendance date", "manpower date"].includes(
      normalizeHeader(header),
    );

  const isVendorHeader = (header: string) =>
    [
      "vendor",
      "vendor name",
      "contractor",
      "contractor name",
      "contractor agency",
      "agency",
      "agency name",
    ].includes(normalizeHeader(header));

  const getDateValue = (row: Record<string, unknown>) => {
    const dateHeader = Object.keys(row).find(isDateHeader);
    return dateHeader ? row[dateHeader] : "N/A";
  };

  const formatDateValue = (value: unknown) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "N/A";
    if (/^\d{5}(?:\.\d+)?$/.test(raw)) {
      const date = new Date(
        Date.UTC(1899, 11, 30) + Math.floor(Number(raw)) * 86400000,
      );
      return date.toLocaleDateString("en-GB", { timeZone: "UTC" });
    }
    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    return raw;
  };

  const downloadTemplate = () => {
    const row = Object.fromEntries([
      ["Date", new Date().toISOString().split("T")[0]],
      ["Vendor Name", "Enter vendor or contractor name"],
      ...categories.map((category) => [category.name, 0]),
    ]);
    const worksheet = utils.json_to_sheet([row]);
    worksheet["!cols"] = Object.keys(row).map((header) => ({
      wch: Math.max(14, header.length + 2),
    }));
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, "Manpower Import");
    writeFile(workbook, `manpower-import-template-${projectId}.xlsx`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    _setFile(file);
    setLocalPreview(null);
    setPreflightErrors([]);
    setExcelData([]);
    setHeaders([]);
    setVendorHeader(null);
    setMappings({});
    setImportError("");
    setStep(1);

    readSpreadsheetPreview(file, 5)
      .then((parsed) => {
        const hasDateColumn = parsed.headers.some(isDateHeader);
        const automaticMappings = Object.fromEntries(
          parsed.headers.flatMap((header) => {
            if (isDateHeader(header) || isVendorHeader(header)) return [];
            const category = categories.find(
              (item) => normalizeHeader(item.name) === normalizeHeader(header),
            );
            return category ? [[header, category.id]] : [];
          }),
        );

        setLocalPreview(parsed);
        setExcelData(parsed.rows);
        setVendorHeader(
          parsed.headers.find((header) => isVendorHeader(header)) || null,
        );
        setHeaders(
          parsed.headers.filter(
            (header) => !isDateHeader(header) && !isVendorHeader(header),
          ),
        );
        setMappings(automaticMappings);
        setPreflightErrors(
          hasDateColumn
            ? []
            : ["No date column was detected. Please include a Date column in the sheet."],
        );
        if (parsed.rows.length > 0 && hasDateColumn) {
          setStep(2);
        }
      })
      .catch(() => {
        setLocalPreview(null);
        setPreflightErrors(["Failed to read the selected spreadsheet."]);
      });
  };

  const handleMap = (header: string, categoryId: number) => {
    setMappings((prev) => {
      const next = { ...prev };
      if (categoryId) next[header] = categoryId;
      else delete next[header];
      return next;
    });
  };

  const handleImport = async () => {
    setLoading(true);
    setImportError("");
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = user?.id;

      if (!userId) {
        alert("User session not found. Please log in again.");
        return;
      }

      const response = await api.post(`/labor/import/${projectId}`, {
        data: excelData,
        userId,
        manualMappings: mappings,
      });

      const { importedEntries = 0, skippedRows = 0 } = response.data || {};
      alert(
        `Import completed: ${importedEntries} manpower entries added${skippedRows ? `, ${skippedRows} invalid rows skipped` : ""}.`,
      );
      onSave();
      onClose();
    } catch (err) {
      console.error("Import failed", err);
      const message =
        (err as any)?.response?.data?.message ||
        "Import failed. Check the file and mapped columns, then try again.";
      setImportError(Array.isArray(message) ? message.join(" ") : message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-card rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-surface-base/50 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-success rounded-lg">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800">
                Smart Excel Import
              </h3>
              <p className="text-xs text-text-disabled font-bold uppercase tracking-widest">
                Map columns to labor categories
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 rounded-lg border border-border-default bg-surface-card px-3 py-2 text-xs font-bold text-text-secondary hover:bg-surface-base"
            >
              <Download className="w-4 h-4" />
              Download Template
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-card rounded-xl text-text-disabled"
              aria-label="Close import"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Stepper */}
          <div className="px-8 py-4 bg-surface-base/50 border-b border-slate-100 flex items-center justify-center gap-12">
            <div
              className={`flex items-center gap-2 ${step >= 1 ? "text-success" : "text-slate-300"}`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 ${step >= 1 ? "border-emerald-600 bg-success-muted" : "border-border-default"}`}
              >
                1
              </div>
              <span className="text-xs font-bold uppercase tracking-wider">
                Upload
              </span>
            </div>
            <div className="w-12 h-px bg-slate-200"></div>
            <div
              className={`flex items-center gap-2 ${step >= 2 ? "text-success" : "text-slate-300"}`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 ${step >= 2 ? "border-emerald-600 bg-success-muted" : "border-border-default"}`}
              >
                2
              </div>
              <span className="text-xs font-bold uppercase tracking-wider">
                Map Columns
              </span>
            </div>
            <div className="w-12 h-px bg-slate-200"></div>
            <div
              className={`flex items-center gap-2 ${step >= 3 ? "text-success" : "text-slate-300"}`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 ${step >= 3 ? "border-emerald-600 bg-success-muted" : "border-border-default"}`}
              >
                3
              </div>
              <span className="text-xs font-bold uppercase tracking-wider">
                Verify
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-8">
            {step === 1 && (
              <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-border-default rounded-3xl bg-surface-base/30 p-12">
                <div className="p-4 bg-surface-card rounded-full shadow-lg mb-6 ring-8 ring-emerald-50 text-emerald-500">
                  <Upload className="w-8 h-8" />
                </div>
                <h4 className="text-xl font-black text-slate-800 mb-2">
                  Select Manpower Sheet
                </h4>
                <p className="text-text-disabled text-sm font-medium mb-8 text-center max-w-md">
                  The file should have a date column and columns representing
                  various labor categories.
                </p>
                <input
                  type="file"
                  id="labor-xlsx"
                  hidden
                  onChange={handleFileUpload}
                  accept=".xlsx, .xls, .csv"
                />
                <label
                  htmlFor="labor-xlsx"
                  className="bg-secondary hover:bg-secondary-dark text-white px-8 py-3 rounded-2xl font-bold cursor-pointer transition-all shadow-xl shadow-indigo-100 flex items-center gap-2"
                >
                  Browse Files
                </label>
                {localPreview && (
                  <div className="mt-6 w-full max-w-2xl rounded-2xl border border-border-default bg-surface-card p-4 text-left shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold text-text-primary">
                          Client-side preflight
                        </p>
                        <p className="text-xs text-text-muted">
                          {localPreview.totalRows} rows detected • {localPreview.headers.length} columns
                          {localPreview.sheetName ? ` • ${localPreview.sheetName}` : ""}
                        </p>
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
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="p-4 bg-warning-muted border border-amber-100 rounded-2xl flex items-start gap-4">
                  <div className="p-2 bg-surface-card rounded-lg text-amber-500 shadow-sm">
                    <Map className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-800">
                      Assign Categories
                    </p>
                    <p className="text-xs font-medium text-warning/80">
                      Match your Excel headers to the system labor categories.
                      Unmapped columns will be skipped.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {headers.map((header) => (
                    <div
                      key={header}
                      className="flex items-center justify-between p-4 bg-surface-base/50 border border-slate-100 rounded-2xl group hover:border-indigo-100 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-surface-card p-2 rounded-lg text-text-disabled shadow-sm border border-slate-100 group-hover:text-secondary group-hover:border-indigo-100 transition-all">
                          <FileSpreadsheet className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-black text-slate-600">
                          {header}
                        </span>
                      </div>
                      <div className="flex items-center gap-6">
                        <ArrowRight className="w-4 h-4 text-slate-300" />
                        <select
                          className="bg-surface-card border-border-default rounded-xl text-xs font-bold text-text-muted focus:ring-2 ring-indigo-50 min-w-[200px]"
                          onChange={(e) =>
                            handleMap(header, parseInt(e.target.value))
                          }
                          value={mappings[header] || ""}
                        >
                          <option value="">-- Ignore Column --</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="p-4 bg-success-muted border border-emerald-100 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-surface-card rounded-lg text-emerald-500 shadow-sm">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <p className="text-sm font-bold text-emerald-800">
                      Preview Data (First 5 Rows)
                    </p>
                  </div>
                  <span className="text-[10px] font-black text-success bg-surface-card px-2 py-1 rounded-md border border-emerald-100 tracking-widest uppercase">
                    {excelData.length} Total Rows Found
                  </span>
                </div>

                <div className="border border-slate-100 rounded-2xl overflow-hidden bg-surface-card shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-surface-base/50 border-b border-slate-100">
                        <th className="px-4 py-3 font-black text-text-disabled uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-4 py-3 font-black text-text-disabled uppercase tracking-wider">
                          Vendor / Contractor
                        </th>
                        {Object.entries(mappings).map(([header, catId]) => {
                          const cat = categories.find((c) => c.id === catId);
                          return cat ? (
                            <th
                              key={header}
                              className="px-4 py-3 font-black text-text-disabled uppercase tracking-wider"
                            >
                              {cat.name}
                            </th>
                          ) : null;
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {excelData.slice(0, 5).map((row, i) => (
                        <tr
                          key={i}
                          className="hover:bg-surface-base/30 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium text-text-muted">
                            {formatDateValue(getDateValue(row))}
                          </td>
                          <td className="px-4 py-3 font-medium text-text-muted">
                            {vendorHeader
                              ? String(row[vendorHeader] || "Not specified")
                              : "Not specified"}
                          </td>
                          {Object.entries(mappings).map(([header, catId]) => {
                            const cat = categories.find((c) => c.id === catId);
                            return cat ? (
                              <td
                                key={header}
                                className="px-4 py-3 font-bold text-text-secondary"
                              >
                                {row[header] || "0"}
                              </td>
                            ) : null;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-text-disabled text-center font-medium italic">
                  Showing only the first 5 records for verification. Final
                  import will process all {excelData.length} records.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-surface-base/50 rounded-b-3xl flex justify-between gap-3">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            className="px-6 py-2.5 rounded-xl font-bold text-sm text-text-disabled hover:text-slate-600 transition-all"
          >
            Back
          </button>
          <div className="flex gap-3">
            {importError && (
              <p className="max-w-sm self-center text-right text-xs font-semibold text-error">
                {importError}
              </p>
            )}
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-bold text-sm text-text-muted"
            >
              Cancel
            </button>
            {step === 2 && (
              <button
                onClick={() => setStep(3)}
                disabled={Object.keys(mappings).length === 0 || preflightErrors.length > 0}
                className="px-10 py-2.5 bg-secondary text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-100 hover:bg-secondary-dark transition-all flex items-center gap-2"
              >
                Next: Verify
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {step === 3 && (
              <button
                onClick={handleImport}
                disabled={loading}
                className="px-10 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                {loading ? "Importing..." : "Finalize Import"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LaborImportModal;
