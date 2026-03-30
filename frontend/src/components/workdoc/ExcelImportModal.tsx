import React, { useState, useEffect } from "react";
import Modal from "../common/Modal";
import {
  WorkDocService,
  type ColumnMapping,
  type ConfirmWorkOrderData,
} from "../../services/work-doc.service";
import type { ImportFieldDefinition, ImportPreviewResult } from "../../types/data-transfer";
import {
  autoMapHeaders,
  readSpreadsheetPreview,
  validateRequiredMappings,
} from "../../utils/import-staging.utils";
import { toast } from "react-hot-toast";
import {
  FileSpreadsheet,
  Loader2,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Indent,
  Outdent,
  Save,
} from "lucide-react";
import { useParams } from "react-router-dom";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vendorId?: number;
  vendorName?: string;
}

interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
}

interface ImportedItem {
  id: string; // temporary ID for UI
  serialNumber: string;
  parentSerialNumber: string | null;
  level: number;
  isParent: boolean;
  materialCode: string;
  shortText: string;
  longText: string;
  uom: string;
  quantity: number;
  rate: number;
  amount: number;
  calculatedAmount: number;
  isExpanded?: boolean;
}

const COLUMN_OPTIONS = [
  { key: "serialNumber", label: "Serial No.", required: true },
  { key: "sapItemNumber", label: "SAP Item No.", required: false },
  { key: "shortDescription", label: "Short Description", required: true },
  { key: "detailDescription", label: "Detail Description", required: false },
  { key: "uom", label: "Unit of Measurement", required: true },
  { key: "quantity", label: "Quantity", required: false },
  { key: "rate", label: "Rate", required: false },
  { key: "amount", label: "Amount", required: true },
];

const WORK_ORDER_IMPORT_FIELDS: ImportFieldDefinition[] = [
  {
    key: "serialNumber",
    label: "Serial No.",
    required: true,
    aliases: ["serial no", "serial number", "item no", "item number"],
  },
  {
    key: "shortDescription",
    label: "Short Description",
    required: true,
    aliases: ["short text", "description", "item description"],
  },
  {
    key: "uom",
    label: "Unit of Measurement",
    required: true,
    aliases: ["unit", "unit of measurement", "uom"],
  },
  {
    key: "amount",
    label: "Amount",
    required: true,
    aliases: ["value", "line amount", "item amount"],
  },
  {
    key: "quantity",
    label: "Quantity",
    aliases: ["qty", "quantity"],
  },
  {
    key: "rate",
    label: "Rate",
    aliases: ["unit rate", "basic rate"],
  },
  {
    key: "sapItemNumber",
    label: "SAP Item No.",
    aliases: ["sap item no", "sap item number", "sap code", "material code"],
  },
  {
    key: "detailDescription",
    label: "Detail Description",
    aliases: ["long text", "detail description", "long description"],
  },
];

const ExcelImportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  vendorId,
}) => {
  const { projectId } = useParams();
  const [step, setStep] = useState<"upload" | "mapping" | "review">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  // Preview data
  const [previewData, setPreviewData] = useState<{
    previewRows: string[][];
    potentialHeaders: string[][];
    totalRows: number;
    fileName: string;
  } | null>(null);
  const [localPreview, setLocalPreview] = useState<ImportPreviewResult | null>(
    null,
  );
  const [preflightErrors, setPreflightErrors] = useState<string[]>([]);

  // Mapping
  const [headerRow, setHeaderRow] = useState(1);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});

  // Imported items
  const [items, setItems] = useState<ImportedItem[]>([]);
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(
    new Set(),
  );

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setStep("upload");
      setFile(null);
      setPreviewData(null);
      setLocalPreview(null);
      setPreflightErrors([]);
      setColumnMapping({});
      setItems([]);
      setCollapsedParents(new Set());
    }
  }, [isOpen]);

  // Handle file upload for preview
  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setLoading(true);
    setPreviewData(null);
    setLocalPreview(null);
    setPreflightErrors([]);

    try {
      const parsed = await readSpreadsheetPreview(selectedFile, 8);
      const autoMapping = autoMapHeaders(parsed.headers, WORK_ORDER_IMPORT_FIELDS);
      const missingRequired = validateRequiredMappings(
        WORK_ORDER_IMPORT_FIELDS,
        autoMapping,
      );
      setLocalPreview(parsed);
      setPreflightErrors(
        missingRequired.length > 0
          ? [`Missing required columns: ${missingRequired.join(", ")}`]
          : [],
      );

      if (missingRequired.length > 0) {
        toast.error(`Missing required columns: ${missingRequired.join(", ")}`);
        return;
      }

      const data = await WorkDocService.previewExcelFn(
        Number(projectId),
        selectedFile,
      );

      setPreviewData(data);
      setStep("mapping");
    } catch (error: unknown) {
      const apiError = error as ApiError;
      const msg = apiError.response?.data?.message || "Failed to preview file";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Handle column mapping and import
  const handleImport = async () => {
    if (!file || !projectId) return;

    // Validate required mappings
    const missingRequired = COLUMN_OPTIONS.filter(
      (opt) =>
        opt.required &&
        columnMapping[opt.key as keyof ColumnMapping] === undefined,
    ).map((opt) => opt.label);

    if (missingRequired.length > 0) {
      toast.error(`Please map required columns: ${missingRequired.join(", ")}`);
      return;
    }

    setLoading(true);

    try {
      const data = await WorkDocService.importExcelFn(
        Number(projectId),
        file,
        columnMapping,
        headerRow,
      );

      // Add temporary IDs and expansion state
      const itemsWithIds: ImportedItem[] = data.items.map(
        (item, idx: number) => ({
          ...item,
          id: `item-${idx}`,
          isExpanded: true,
        }),
      );

      setItems(itemsWithIds);
      setStep("review");
      toast.success(`Imported ${data.totalItems} items`);
    } catch (error: unknown) {
      const apiError = error as ApiError;
      const msg = apiError.response?.data?.message || "Failed to import file";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Toggle parent collapse
  const toggleCollapse = (serialNumber: string) => {
    setCollapsedParents((prev) => {
      const next = new Set(prev);
      if (next.has(serialNumber)) {
        next.delete(serialNumber);
      } else {
        next.add(serialNumber);
      }
      return next;
    });
  };

  // Indent item (make it a child)
  const indentItem = (index: number) => {
    const newItems = [...items];
    const item = newItems[index];

    // Find previous parent-level item
    let parentSerial: string | null = null;
    for (let i = index - 1; i >= 0; i--) {
      if (newItems[i].level === 0 || newItems[i].level < item.level) {
        parentSerial = newItems[i].serialNumber;
        break;
      }
    }

    if (parentSerial) {
      item.level = 1;
      item.parentSerialNumber = parentSerial;
      item.isParent = false;

      // Recalculate serial number
      const siblings = newItems.filter(
        (i) => i.parentSerialNumber === parentSerial,
      );
      const newChildNum = siblings.length;
      item.serialNumber = `${parentSerial}.${newChildNum}`;

      setItems(newItems);
      recalculateAmounts(newItems);
    }
  };

  // Outdent item (make it a parent)
  const outdentItem = (index: number) => {
    const newItems = [...items];
    const item = newItems[index];

    if (item.level > 0) {
      item.level = 0;
      item.parentSerialNumber = null;
      item.isParent = item.quantity === 0;

      // Assign new parent serial number
      const parentItems = newItems.filter((i) => i.level === 0);
      const maxSerial = Math.max(
        ...parentItems.map((i) => parseInt(i.serialNumber) || 0),
      );
      item.serialNumber = String(maxSerial + 10);

      setItems(newItems);
      recalculateAmounts(newItems);
    }
  };

  // Recalculate parent amounts
  const recalculateAmounts = (itemList: ImportedItem[]) => {
    const newItems = [...itemList];

    // Calculate child amounts first
    for (const item of newItems) {
      if (!item.isParent) {
        item.calculatedAmount = item.quantity * item.rate || item.amount;
      }
    }

    // Calculate parent amounts
    for (const item of newItems) {
      if (item.isParent) {
        const children = newItems.filter(
          (i) => i.parentSerialNumber === item.serialNumber,
        );
        item.calculatedAmount = children.reduce(
          (sum, c) => sum + c.calculatedAmount,
          0,
        );
      }
    }

    setItems(newItems);
  };

  // Update item field
  const updateItem = <K extends keyof ImportedItem>(
    index: number,
    field: K,
    value: ImportedItem[K],
  ) => {
    const newItems = [...items];
    newItems[index][field] = value;

    // Recalculate if quantity or rate changed
    if (field === "quantity" || field === "rate") {
      recalculateAmounts(newItems);
    } else {
      setItems(newItems);
    }
  };

  // Save to database
  const handleSave = async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      // Prepare data for save
      const saveData: ConfirmWorkOrderData = {
        vendor: { code: vendorId ? String(vendorId) : "EXCEL-IMPORT" },
        header: {
          woNumber: `EXCEL-${Date.now()}`,
          date: new Date().toISOString(),
        },
        items: items.map((item) => ({
          code: item.materialCode,
          description: item.shortText,
          longText: item.longText,
          qty: item.quantity,
          uom: item.uom,
          rate: item.rate,
          amount: item.calculatedAmount,
          serialNumber: item.serialNumber,
          parentSerialNumber: item.parentSerialNumber,
          level: item.level,
          isParent: item.isParent,
        })),
        pdfPath: null,
        originalFileName: file?.name,
      };

      await WorkDocService.confirmWorkOrder(Number(projectId), saveData);
      toast.success("Work Order imported successfully");

      // Ask user if they want to go to mapping
      if (
        window.confirm(
          "Import successful. Do you want to review unmapped items in the Pending Board?",
        )
      ) {
        // Navigate to Pending Board (assuming route or tab exists)
        // For now, we rely on the parent component to refresh or show the board
        // But generally, the modal should perhaps interact with the parent context
      }

      onSuccess();
      onClose();
    } catch (error: unknown) {
      const apiError = error as ApiError;
      const msg = apiError.response?.data?.message || "Failed to save";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Filter visible items (respecting collapse state)
  const visibleItems = items.filter((item) => {
    if (item.level === 0) return true;
    return !collapsedParents.has(item.parentSerialNumber!);
  });

  // ============ STEP 1: UPLOAD ============
  if (step === "upload") {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Import from Excel/CSV">
        <div className="space-y-6 py-4">
          <div
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
              file
                ? "border-success bg-success-muted"
                : "border-border-strong hover:border-blue-400 hover:bg-surface-base"
            }`}
            onClick={() => document.getElementById("excel-file")?.click()}
          >
            <div
              className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                file
                  ? "bg-green-600 text-white"
                  : "bg-surface-raised text-text-disabled"
              }`}
            >
              <FileSpreadsheet className="w-8 h-8" />
            </div>

            <input
              id="excel-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />

            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="animate-spin w-5 h-5 text-primary" />
                <span className="text-primary font-medium">
                  Reading file...
                </span>
              </div>
            ) : file ? (
              <div>
                <p className="font-bold text-green-700 text-lg">{file.name}</p>
                <p className="text-xs text-success">File loaded successfully</p>
              </div>
            ) : (
              <div>
                <p className="text-text-primary font-bold">
                  Select Excel or CSV file
                </p>
                <p className="text-xs text-text-muted mt-1">
                  Supported formats: .xlsx, .xls, .csv
                </p>
              </div>
            )}
          </div>

          {localPreview && (
            <div className="rounded-xl border border-border-default bg-surface-card p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-text-primary">
                    Client-side preflight
                  </div>
                  <div className="text-xs text-text-muted">
                    {localPreview.totalRows} rows detected • {localPreview.headers.length} columns
                    {localPreview.sheetName ? ` • ${localPreview.sheetName}` : ""}
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

          <div className="bg-warning-muted border border-amber-200 rounded-xl p-4">
            <h4 className="font-bold text-amber-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Expected Columns
            </h4>
            <ul className="text-sm text-amber-700 mt-2 space-y-1">
              <li>
                • <strong>Serial No.</strong> - Hierarchy indicator (10, 10.1,
                10.2, 20, etc.)
              </li>
              <li>
                • <strong>SAP Item Number</strong> - Material/Service code
              </li>
              <li>
                • <strong>Short/Detail Description</strong> - Item descriptions
              </li>
              <li>
                • <strong>UOM, Quantity, Rate, Amount</strong> - Measurements
              </li>
            </ul>
          </div>
        </div>
      </Modal>
    );
  }

  // ============ STEP 2: COLUMN MAPPING ============
  if (step === "mapping" && previewData) {
    const headers = previewData.previewRows[headerRow - 1] || [];

    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Map Columns">
        <div className="space-y-6 max-h-[80vh] overflow-auto">
          {/* Header Row Selection */}
          <div className="bg-surface-base p-4 rounded-xl border border-border-default">
            <label className="text-xs font-bold text-text-muted uppercase">
              Header Row
            </label>
            <select
              className="mt-1 w-full p-3 border rounded-lg"
              value={headerRow}
              onChange={(e) => setHeaderRow(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  Row {n}
                </option>
              ))}
            </select>
          </div>

          {/* Column Mapping */}
          <div className="space-y-3">
            <h4 className="font-bold text-text-secondary">
              Map Excel Columns to Fields
            </h4>
            <div className="grid grid-cols-2 gap-4">
              {COLUMN_OPTIONS.map((opt) => (
                <div
                  key={opt.key}
                  className="bg-surface-card border rounded-lg p-3"
                >
                  <label className="text-xs font-bold text-text-muted uppercase flex items-center gap-1">
                    {opt.label}
                    {opt.required && <span className="text-error">*</span>}
                  </label>
                  <select
                    className="mt-1 w-full p-2 border rounded text-sm"
                    value={columnMapping[opt.key as keyof ColumnMapping] ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setColumnMapping((prev) => ({
                        ...prev,
                        [opt.key]: val === "" ? undefined : Number(val),
                      }));
                    }}
                  >
                    <option value="">-- Select Column --</option>
                    {headers.map((h, idx) => (
                      <option key={idx} value={idx}>
                        Column {idx + 1}: {h || `(Empty)`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Preview Table */}
          <div>
            <h4 className="font-bold text-text-secondary mb-2">Data Preview</h4>
            <div className="border rounded-xl overflow-auto max-h-48">
              <table className="w-full text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    {headers.map((h, idx) => (
                      <th
                        key={idx}
                        className="px-2 py-2 text-left font-bold text-slate-600"
                      >
                        {h || `Col ${idx + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.previewRows
                    .slice(headerRow, headerRow + 5)
                    .map((row, idx) => (
                      <tr key={idx} className="border-t">
                        {row.map((cell, cidx) => (
                          <td
                            key={cidx}
                            className="px-2 py-1 text-slate-600 truncate max-w-[150px]"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t">
            <button
              onClick={() => setStep("upload")}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={handleImport}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark disabled:bg-slate-300"
            >
              {loading ? (
                <Loader2 className="animate-spin w-4 h-4" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              Import Data
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  // ============ STEP 3: REVIEW & EDIT ============
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Review Imported Items">
      <div className="space-y-4 max-h-[80vh] flex flex-col">
        {/* Stats */}
        <div className="flex gap-4 text-sm">
          <div className="bg-primary-muted px-4 py-2 rounded-lg">
            <span className="text-primary font-bold">
              {items.filter((i) => i.isParent).length}
            </span>
            <span className="text-primary ml-1">Parent Items</span>
          </div>
          <div className="bg-success-muted px-4 py-2 rounded-lg">
            <span className="text-success font-bold">
              {items.filter((i) => !i.isParent).length}
            </span>
            <span className="text-success ml-1">Child Items</span>
          </div>
          <div className="bg-surface-base px-4 py-2 rounded-lg">
            <span className="text-text-secondary font-bold">
              ₹
              {items
                .filter((i) => i.level === 0)
                .reduce((s, i) => s + i.calculatedAmount, 0)
                .toLocaleString()}
            </span>
            <span className="text-text-muted ml-1">Total</span>
          </div>
        </div>

        {/* Hierarchical Table */}
        <div className="flex-1 overflow-auto border rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 sticky top-0">
              <tr className="text-xs font-bold text-slate-600 uppercase">
                <th className="px-3 py-3 text-left w-8"></th>
                <th className="px-3 py-3 text-left">Serial</th>
                <th className="px-3 py-3 text-left">SAP Code</th>
                <th className="px-3 py-3 text-left">Description</th>
                <th className="px-3 py-3 text-left">UOM</th>
                <th className="px-3 py-3 text-right">Qty</th>
                <th className="px-3 py-3 text-right">Rate</th>
                <th className="px-3 py-3 text-right">Amount</th>
                <th className="px-3 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleItems.map((item) => {
                const originalIdx = items.findIndex((i) => i.id === item.id);
                const hasChildren = items.some(
                  (i) => i.parentSerialNumber === item.serialNumber,
                );
                const isCollapsed = collapsedParents.has(item.serialNumber);

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-primary-muted/50 transition-colors ${
                      item.isParent ? "bg-surface-base font-semibold" : ""
                    }`}
                  >
                    {/* Expand/Collapse */}
                    <td className="px-3 py-2">
                      {hasChildren && (
                        <button
                          onClick={() => toggleCollapse(item.serialNumber)}
                          className="p-1 hover:bg-slate-200 rounded"
                        >
                          {isCollapsed ? (
                            <ChevronRight className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </td>

                    {/* Serial */}
                    <td className="px-3 py-2">
                      <span
                        className={`font-mono ${item.isParent ? "text-primary font-bold" : "text-slate-600"}`}
                        style={{ paddingLeft: item.level * 20 }}
                      >
                        {item.serialNumber}
                      </span>
                    </td>

                    {/* SAP Code */}
                    <td className="px-3 py-2">
                      <input
                        className="w-full bg-transparent text-text-secondary focus:outline-blue-400"
                        value={item.materialCode}
                        onChange={(e) =>
                          updateItem(
                            originalIdx,
                            "materialCode",
                            e.target.value,
                          )
                        }
                      />
                    </td>

                    {/* Description */}
                    <td className="px-3 py-2">
                      <input
                        className="w-full bg-transparent focus:outline-blue-400"
                        value={item.shortText}
                        onChange={(e) =>
                          updateItem(originalIdx, "shortText", e.target.value)
                        }
                      />
                    </td>

                    {/* UOM */}
                    <td className="px-3 py-2">
                      <input
                        className="w-16 bg-transparent focus:outline-blue-400"
                        value={item.uom}
                        onChange={(e) =>
                          updateItem(originalIdx, "uom", e.target.value)
                        }
                      />
                    </td>

                    {/* Qty */}
                    <td className="px-3 py-2 text-right">
                      {!item.isParent ? (
                        <input
                          type="number"
                          className="w-20 text-right bg-transparent focus:outline-blue-400"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(
                              originalIdx,
                              "quantity",
                              Number(e.target.value),
                            )
                          }
                        />
                      ) : (
                        <span className="text-text-disabled">-</span>
                      )}
                    </td>

                    {/* Rate */}
                    <td className="px-3 py-2 text-right">
                      {!item.isParent ? (
                        <input
                          type="number"
                          className="w-24 text-right bg-transparent focus:outline-blue-400"
                          value={item.rate}
                          onChange={(e) =>
                            updateItem(
                              originalIdx,
                              "rate",
                              Number(e.target.value),
                            )
                          }
                        />
                      ) : (
                        <span className="text-text-disabled">-</span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="px-3 py-2 text-right font-bold">
                      <span
                        className={
                          item.isParent ? "text-primary" : "text-slate-800"
                        }
                      >
                        ₹{item.calculatedAmount.toLocaleString()}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => indentItem(originalIdx)}
                          disabled={item.level > 0}
                          className="p-1 text-text-muted hover:bg-slate-200 rounded disabled:opacity-30"
                          title="Make Child"
                        >
                          <Indent className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => outdentItem(originalIdx)}
                          disabled={item.level === 0}
                          className="p-1 text-text-muted hover:bg-slate-200 rounded disabled:opacity-30"
                          title="Make Parent"
                        >
                          <Outdent className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t">
          <button
            onClick={() => setStep("mapping")}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Mapping
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:bg-slate-300 shadow-lg"
          >
            {loading ? (
              <Loader2 className="animate-spin w-5 h-5" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Save Work Order
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ExcelImportModal;
