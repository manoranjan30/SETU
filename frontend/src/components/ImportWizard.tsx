import React, { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  X,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { boqService, type ImportMapping } from "../services/boq.service";
import api from "../api/axios";
import { toast } from "react-hot-toast";
import type {
  ImportFieldDefinition,
  ImportPreviewRow,
} from "../types/data-transfer";
import {
  autoMapHeaders,
  collectUniqueColumnValues,
  readSpreadsheetPreview,
  validateRequiredMappings,
} from "../utils/import-staging.utils";

interface Props {
  projectId: number;
  mode: "BOQ_ITEM" | "MEASUREMENT" | "RESOURCE_MASTER";
  boqItemId?: number; // Required if mode is MEASUREMENT
  boqSubItemId?: number; // Optional: Link to Sub Item (Layer 2)
  onClose: () => void;
  onSuccess: () => void;
  epsNodes?: EpsNode[]; // Pass flatten list or fetch
}

interface EpsNode {
  id: number;
  name: string;
  parentId?: number;
  type?: string;
}

const BOQ_FIELDS: ImportFieldDefinition[] = [
  { key: "rowType", label: "Row Type (Main/Sub/Meas)", required: false },
  { key: "parentBoqCode", label: "Parent BOQ Code", required: false },
  { key: "boqCode", label: "Item Code", required: true },
  { key: "description", label: "Description/Title", required: true },
  { key: "longDescription", label: "Detailed Description", required: false },
  { key: "uom", label: "UOM", required: false },
  { key: "qty", label: "Quantity", required: false },
  { key: "rate", label: "Rate", required: false },
  { key: "epsName", label: "Location / EPS Name", required: false },
  { key: "epsId", label: "Location ID (Optional)", required: false },
  // Measurement / Pamphlet Fields
  { key: "parentSubItem", label: "Parent Sub-Item (Ref)", required: false },
  { key: "elementName", label: "Measurement Name", required: false },
  { key: "length", label: "Length", required: false },
  { key: "breadth", label: "Breadth", required: false },
  { key: "depth", label: "Depth", required: false },
  { key: "calculatedQty", label: "Calculated Qty", required: false },
];

const MEASUREMENT_FIELDS: ImportFieldDefinition[] = [
  { key: "parentBoqCode", label: "Parent BOQ Code", required: false },
  { key: "parentSubItem", label: "Parent Sub-Item", required: false },
  { key: "epsName", label: "Location / EPS Name", required: true },
  { key: "epsPath", label: "EPS Path", required: false },
  { key: "elementName", label: "Element Name", required: true },
  { key: "elementCategory", label: "Element Category", required: false },
  { key: "elementType", label: "Element Type", required: false },
  { key: "grid", label: "Grid", required: false },
  { key: "linkingElement", label: "Linking Element (3D)", required: false },
  { key: "length", label: "Length", required: false },
  { key: "breadth", label: "Breadth", required: false },
  { key: "depth", label: "Depth", required: false },
  { key: "height", label: "Height", required: false },
  { key: "bottomLevel", label: "Bottom Level", required: false },
  { key: "topLevel", label: "Top Level", required: false },
  { key: "perimeter", label: "Perimeter", required: false },
  { key: "baseArea", label: "Base Area", required: false },
  { key: "uom", label: "UOM", required: false },
  { key: "qty", label: "Quantity", required: true },
  { key: "epsId", label: "Location ID (Optional)", required: false },
  { key: "baseCoordinates", label: "Base Coordinates (JSON)", required: false },
  { key: "plineAllLengths", label: "Pline All Lengths", required: false },
];

const RESOURCE_FIELDS: ImportFieldDefinition[] = [
  { key: "resourceCode", label: "Resource Code (Optional)", required: false },
  { key: "resourceName", label: "Resource Name*", required: true },
  { key: "uom", label: "UOM*", required: true },
  {
    key: "resourceType",
    label: "Type (MATERIAL/LABOR/PLANT/OTHER)*",
    required: true,
  },
  { key: "standardRate", label: "Standard Rate (Price)", required: false },
  { key: "category", label: "Category", required: false },
  { key: "specification", label: "Specification", required: false },
];

export const ImportWizard: React.FC<Props> = ({
  projectId,
  mode,
  boqItemId,
  boqSubItemId,
  onClose,
  onSuccess,
  epsNodes,
}) => {
  // --- State ---
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ImportPreviewRow[]>([]);
  const [parsedRows, setParsedRows] = useState<ImportPreviewRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [validationReport, setValidationReport] = useState<{
    newCount: number;
    updateCount: number;
    errorCount: number;
    errors: string[];
    warnings: string[];
    total?: number;
  } | null>(null);

  // Hierarchy Mapping State
  const [hierarchyMapping, setHierarchyMapping] = useState<{
    level1?: string; // Block
    level2?: string; // Tower
    level3?: string; // Floor
    level4?: string; // Unit
    level5?: string; // Room
  }>({});
  const [defaultEpsId, setDefaultEpsId] = useState<number | undefined>(
    undefined,
  );
  const [locationMode, setLocationMode] = useState<"SINGLE" | "HIERARCHY">(
    "SINGLE",
  ); // New Toggle State
  const [uploading, setUploading] = useState(false);
  const [validating, setValidating] = useState(false);

  // Step 3 State
  const [valueMap, setValueMap] = useState<ImportMapping>({}); // Key=CSV Value, Val=EPS ID (stringified)
  const [uniqueValues, setUniqueValues] = useState<string[]>([]);

  const [localNodes, setLocalNodes] = useState<EpsNode[]>(epsNodes || []);

  useEffect(() => {
    if (epsNodes && epsNodes.length > 0) {
      setLocalNodes(epsNodes);
    } else if (projectId) {
      boqService
        .getProjectEpsList(projectId)
        .then((nodes) => {
          setLocalNodes(nodes);
        })
        .catch((e) => console.error("ImportWizard: Local fetch failed", e));
    }
  }, [epsNodes, projectId]);

  const targetFields =
    mode === "BOQ_ITEM"
      ? BOQ_FIELDS
      : mode === "RESOURCE_MASTER"
        ? RESOURCE_FIELDS
        : MEASUREMENT_FIELDS;

  // --- Step 1: File Drop ---
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv", ".xlsx", ".xls"] },
    multiple: false,
  });

  const parseFile = async (selectedFile: File) => {
    try {
      const parsed = await readSpreadsheetPreview(selectedFile, 10);
      setHeaders(parsed.headers);
      setPreviewData(parsed.previewRows);
      setParsedRows(parsed.rows);
      setStep(2);
      setMapping(autoMapHeaders(parsed.headers, targetFields) as ImportMapping);
    } catch (error) {
      console.error("Failed to parse import file", error);
      toast.error("Failed to read the selected file.");
    }
  };

  // --- Step 2: Mapping Logic ---
  const handleMapChange = (fieldKey: string, header: string) => {
    setMapping((prev) => ({ ...prev, [fieldKey]: header }));
  };

  const isMappingValid = () => {
    const missingRequired = validateRequiredMappings(targetFields, mapping, [
      "epsName",
    ]);

    const hasLocation =
      mode === "RESOURCE_MASTER" ||
      mapping["epsName"] ||
      hierarchyMapping.level1 ||
      defaultEpsId;
    return missingRequired.length === 0 && !!hasLocation;
  };

  // Transition Step 2 -> Step 3
  const onStep2Next = async () => {
    if (mode === "BOQ_ITEM") {
      await runBackendDryRun();
      return;
    }

    const hasHierarchy = Object.values(hierarchyMapping).some((v) => v);
    if (hasHierarchy) {
      setStep(3);
      return;
    }

    const epsCol = mapping["epsName"];
    if (mode === "RESOURCE_MASTER" || !epsCol) {
      setStep(3);
      return;
    }

    if (parsedRows.length > 0) {
      setUniqueValues(collectUniqueColumnValues(parsedRows, epsCol));
      setStep(3);
    }
  };

  const runBackendDryRun = async () => {
    if (!file) return;
    setValidating(true);
    try {
      const formData = new FormData();
      formData.append("projectId", String(projectId));
      formData.append("file", file);
      const finalMapping = { ...mapping };
      if (locationMode === "HIERARCHY") {
        delete finalMapping["epsName"];
      }
      formData.append("mapping", JSON.stringify(finalMapping));
      formData.append("dryRun", "true");
      if (
        locationMode === "HIERARCHY" &&
        Object.keys(hierarchyMapping).length > 0
      ) {
        formData.append("hierarchyMapping", JSON.stringify(hierarchyMapping));
      }
      if (defaultEpsId) formData.append("defaultEpsId", String(defaultEpsId));

      const res = await boqService.importBoq(formData);
      setValidationReport(res.data);
      setStep(3);
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message || "Validation failed";
      toast.error(msg);
    } finally {
      setValidating(false);
    }
  };

  // --- Step 3: Execution ---
  const handleImport = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("projectId", String(projectId));
      formData.append("file", file);
      const finalMapping = { ...mapping };
      if (locationMode === "HIERARCHY") {
        delete finalMapping["epsName"];
      }

      if (mode === "BOQ_ITEM") {
        formData.append("mapping", JSON.stringify(finalMapping));
        if (
          locationMode === "HIERARCHY" &&
          Object.keys(hierarchyMapping).length > 0
        ) {
          formData.append("hierarchyMapping", JSON.stringify(hierarchyMapping));
        }
        if (defaultEpsId) formData.append("defaultEpsId", String(defaultEpsId));
        await boqService.importBoq(formData);
      } else if (mode === "MEASUREMENT") {
        if (!boqItemId) throw new Error("BOQ Item ID required");
        formData.append("boqItemId", String(boqItemId));
        if (boqSubItemId) formData.append("boqSubItemId", String(boqSubItemId));
        formData.append("mapping", JSON.stringify(finalMapping));
        if (
          locationMode === "HIERARCHY" &&
          Object.keys(hierarchyMapping).length > 0
        ) {
          formData.append("hierarchyMapping", JSON.stringify(hierarchyMapping));
        }
        if (defaultEpsId) formData.append("defaultEpsId", String(defaultEpsId));
        await boqService.importMeasurements(formData);
      } else if (mode === "RESOURCE_MASTER") {
        formData.append("mapping", JSON.stringify(mapping));
        await api.post("/resources/import", formData);
      }
      toast.success("Import completed successfully!");
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || "Import failed.");
    } finally {
      setUploading(false);
    }
  };

  // --- Renders ---
  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() =>
            mode === "MEASUREMENT"
              ? boqService.getMeasurementTemplate(
                  projectId,
                  boqItemId,
                  boqSubItemId,
                )
              : boqService.getBoqTemplate(projectId)
          }
          className="px-3 py-1.5 text-sm bg-primary-muted text-primary rounded-md hover:bg-info-muted flex items-center gap-2 font-medium transition-colors"
        >
          <FileText size={16} />
          Download {mode === "MEASUREMENT" ? "Measurement" : "BOQ"} Template
        </button>
      </div>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${isDragActive ? "border-primary bg-primary-muted" : "border-border-default hover:border-blue-400"}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-info-muted text-primary rounded-full flex items-center justify-center">
            <Upload size={32} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Upload CSV/Excel File
            </h3>
            <p className="text-text-muted mt-1">
              Drag & drop or click to select
            </p>
            <p className="text-xs text-text-disabled mt-2">
              Supports .csv, .xlsx, .xls
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Standard Columns */}
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <CheckCircle size={18} className="text-emerald-500" />
            Column Mapping
          </h3>
          <div className="space-y-3 bg-surface-base p-4 rounded-lg border border-border-default">
            {targetFields
              .filter((f) => f.key !== "epsName" && f.key !== "epsId")
              .map((field) => (
                <div
                  key={field.key}
                  className="flex items-center justify-between"
                >
                  <div className="flex flex-col">
                    <span
                      className={`text-sm font-medium ${field.required ? "text-text-secondary" : "text-text-muted"}`}
                    >
                      {field.label} {field.required && "*"}
                    </span>
                    <span className="text-xs text-text-disabled">
                      {field.key}
                    </span>
                  </div>
                  <select
                    className={`w-48 text-sm border rounded px-2 py-1 ${!mapping[field.key as keyof ImportMapping] && field.required ? "border-red-300 bg-error-muted" : "border-slate-300"}`}
                    value={mapping[field.key as keyof ImportMapping] || ""}
                    onChange={(e) => handleMapChange(field.key, e.target.value)}
                  >
                    <option value="">-- Select Column --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
          </div>
        </div>

        {/* Hierarchy & Fallback */}
        {mode !== "RESOURCE_MASTER" && (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-blue-800 flex items-center gap-2">
                <AlertTriangle size={18} className="text-primary" />
                Location / EPS Mapping
              </h3>

              {/* Mode Toggle */}
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setLocationMode("SINGLE")}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                    locationMode === "SINGLE"
                      ? "bg-surface-card text-primary shadow-sm"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  Single Column (Path)
                </button>
                <button
                  onClick={() => setLocationMode("HIERARCHY")}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                    locationMode === "HIERARCHY"
                      ? "bg-surface-card text-primary shadow-sm"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  Separate Columns (Hierarchy)
                </button>
              </div>

              {/* Single Column Mapping */}
              {locationMode === "SINGLE" && (
                <div className="space-y-3 bg-surface-base p-4 rounded-lg border border-border-default">
                  <p className="text-xs text-text-muted mb-2">
                    Map a single column containing the full path (e.g. "Tower A
                    &gt; Floor 1").
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-text-secondary">
                        EPS Path Column
                      </span>
                      <span className="text-xs text-text-disabled">
                        epsName
                      </span>
                    </div>
                    <select
                      className="w-48 text-sm border border-slate-300 rounded px-2 py-1"
                      value={mapping["epsName"] || ""}
                      onChange={(e) =>
                        handleMapChange("epsName", e.target.value)
                      }
                    >
                      <option value="">-- Select Column --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Hierarchy Mapping */}
              {locationMode === "HIERARCHY" && (
                <div className="space-y-3 bg-surface-base p-4 rounded-lg border border-border-default">
                  <p className="text-xs text-text-muted mb-2">
                    Map separate columns for each level (Structure).
                  </p>
                  {[
                    { level: "level1", label: "Level 1 (e.g. Block)" },
                    { level: "level2", label: "Level 2 (e.g. Tower)" },
                    { level: "level3", label: "Level 3 (e.g. Floor)" },
                  ].map((L) => (
                    <div
                      key={L.level}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm text-text-secondary">
                        {L.label}
                      </span>
                      <select
                        className="w-48 border rounded px-2 py-1 text-sm"
                        value={
                          hierarchyMapping[
                            L.level as keyof typeof hierarchyMapping
                          ] || ""
                        }
                        onChange={(e) =>
                          setHierarchyMapping({
                            ...hierarchyMapping,
                            [L.level]: e.target.value,
                          })
                        }
                      >
                        <option value="">-- (Skip Level) --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-500" />
                Fallback Values
              </h3>
              <select
                className="w-full mt-1 border border-slate-300 rounded px-2 py-1.5 text-sm"
                value={defaultEpsId || ""}
                onChange={(e) => setDefaultEpsId(Number(e.target.value))}
              >
                <option value="">(None) Skip row if missing</option>
                {localNodes?.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-text-secondary">
          Data Preview (First 5 Rows)
        </h3>
        <div className="overflow-auto max-h-48 border rounded bg-surface-card text-xs">
          <table className="w-full">
            <thead className="bg-slate-100 sticky top-0">
              <tr>
                {headers.map((h) => (
                  <th
                    key={h}
                    className="p-2 text-left font-medium text-slate-600"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewData.slice(0, 5).map((row, i) => (
                <tr key={i} className="border-t">
                  {headers.map((h) => (
                    <td key={h} className="p-2 whitespace-nowrap">
                      {row[h]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => {
    if (validating) {
      return (
        <div className="flex flex-col items-center justify-center p-12 space-y-4 text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-600 font-medium">
            Running Structural Analysis...
          </p>
          <p className="text-xs text-text-disabled">
            Comparing your file against Project EPS structure
          </p>
        </div>
      );
    }

    if (mode === "RESOURCE_MASTER") {
      return (
        <div className="space-y-6 text-center py-12">
          <CheckCircle className="text-emerald-500 mx-auto" size={48} />
          <h4 className="text-xl font-bold text-slate-900">
            Ready to Import Resources
          </h4>
          <p className="text-text-muted">
            All fields mapped successfully. Click Finish to import.
          </p>
        </div>
      );
    }

    if (validationReport) {
      const hasCriticalErrors =
        (validationReport.errorCount || 0) > 0 ||
        (validationReport.errors && validationReport.errors.length > 0);

      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              {hasCriticalErrors ? (
                <AlertTriangle className="text-error" />
              ) : (
                <CheckCircle className="text-emerald-500" />
              )}
              Structural Analysis & Verification
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface-card border p-4 rounded-xl shadow-sm text-center">
              <div className="text-3xl font-black text-primary">
                {validationReport.newCount}
              </div>
              <div className="text-[10px] text-text-disabled uppercase font-bold tracking-wider mt-1">
                New Elements
              </div>
            </div>
            <div className="bg-surface-card border p-4 rounded-xl shadow-sm text-center">
              <div className="text-3xl font-black text-amber-500">
                {validationReport.updateCount}
              </div>
              <div className="text-[10px] text-text-disabled uppercase font-bold tracking-wider mt-1">
                Existing Updates
              </div>
            </div>
            <div
              className={`p-4 rounded-xl shadow-sm border text-center ${hasCriticalErrors ? "bg-error-muted border-red-200" : "bg-surface-card"}`}
            >
              <div
                className={`text-3xl font-black ${hasCriticalErrors ? "text-error" : "text-slate-300"}`}
              >
                {validationReport.errorCount ||
                  validationReport.errors?.length ||
                  0}
              </div>
              <div className="text-[10px] text-text-disabled uppercase font-bold tracking-wider mt-1">
                Structural Errors
              </div>
            </div>
          </div>

          {validationReport.warnings?.length > 0 && (
            <div className="bg-warning-muted border border-amber-200 rounded-xl p-4">
              <h4 className="text-sm font-bold text-amber-800 flex items-center gap-2 mb-2">
                <AlertTriangle size={16} /> Math Validation Warnings
              </h4>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {validationReport.warnings.map((w, i) => (
                  <div key={i} className="text-xs text-amber-700 font-medium">
                    • {w}
                  </div>
                ))}
              </div>
            </div>
          )}

          {validationReport.errors?.length > 0 && (
            <div className="bg-error-muted border border-red-200 rounded-xl p-4">
              <h4 className="text-sm font-bold text-red-800 flex items-center gap-2 mb-2">
                <X size={16} /> Blocked: Structural Mismatches
              </h4>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {validationReport.errors.map((e, i) => (
                  <div key={i} className="text-xs text-red-700 font-medium">
                    • {e}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasCriticalErrors && (
            <div className="bg-success-muted border border-emerald-200 p-8 rounded-xl text-center">
              <CheckCircle
                size={32}
                className="text-emerald-500 mx-auto mb-2"
              />
              <h4 className="font-bold text-emerald-900 text-lg">
                System Verification Success
              </h4>
              <p className="text-sm text-emerald-700">
                All locations mapped. Structure is symmetrical.
              </p>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <CheckCircle size={18} className="text-primary" />
          Map EPS Values
        </h3>
        <div className="bg-surface-base border border-border-default rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-600 font-medium">
              <tr>
                <th className="p-3 text-left">Value in File</th>
                <th className="p-3 text-left">Map to System Node</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {uniqueValues.map((val, idx) => (
                <tr key={idx} className="bg-surface-card">
                  <td className="p-3 font-medium text-text-secondary">{val}</td>
                  <td className="p-3">
                    <select
                      className="w-full border-slate-300 rounded px-2 py-1.5"
                      value={valueMap[val] || ""}
                      onChange={(e) =>
                        setValueMap((prev) => ({
                          ...prev,
                          [val]: e.target.value,
                        }))
                      }
                    >
                      <option value="">-- Select --</option>
                      <option value="SKIP">(Skip Rows)</option>
                      {localNodes?.map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-surface-overlay z-50 flex items-center justify-center p-4">
      <div className="bg-surface-card rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b flex items-center justify-between bg-surface-base rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-info-muted text-primary rounded-lg flex items-center justify-center">
              <FileText size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Import{" "}
                {mode === "BOQ_ITEM"
                  ? "BOQ Items"
                  : mode === "RESOURCE_MASTER"
                    ? "Global Resources"
                    : "Measurements"}
              </h2>
              <p className="text-xs text-text-muted">
                Step {step} of 3 •{" "}
                {step === 1
                  ? "File Selection"
                  : step === 2
                    ? "Column Mapping"
                    : "Critical Review"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X size={20} className="text-text-muted" />
          </button>
        </div>

        <div className="flex-1 p-6 overflow-y-auto bg-surface-card">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>

        <div className="p-6 border-t bg-surface-base rounded-b-xl flex justify-between items-center">
          {step === 1 && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium"
            >
              Cancel
            </button>
          )}
          {step === 2 && (
            <>
              <button
                onClick={() => {
                  setFile(null);
                  setHeaders([]);
                  setPreviewData([]);
                  setParsedRows([]);
                  setMapping({});
                  setStep(1);
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium"
              >
                Back to Upload
              </button>
              <div className="flex items-center gap-4">
                <div className="text-xs text-text-disabled text-right">
                  {isMappingValid()
                    ? "All required fields mapped"
                    : "Missing required fields"}
                </div>
                <button
                  onClick={onStep2Next}
                  disabled={!isMappingValid()}
                  className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-all
                                        ${!isMappingValid() ? "bg-slate-200 text-text-disabled cursor-not-allowed" : "bg-primary text-white hover:bg-primary-dark shadow"}
                                    `}
                >
                  {mode === "BOQ_ITEM" ? "Run Analysis" : "Next: Map Values"}{" "}
                  <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium"
              >
                Back to Mapping
              </button>
              <button
                onClick={handleImport}
                disabled={
                  uploading ||
                  !!(
                    validationReport &&
                    ((validationReport.errorCount || 0) > 0 ||
                      (validationReport.errors &&
                        validationReport.errors.length > 0))
                  )
                }
                className={`px-6 py-2 rounded-lg font-medium shadow-md flex items-center gap-2 transition-all
                                    ${
                                      uploading ||
                                      !!(
                                        validationReport &&
                                        ((validationReport.errorCount || 0) >
                                          0 ||
                                          (validationReport.errors &&
                                            validationReport.errors.length > 0))
                                      )
                                        ? "bg-slate-200 text-text-disabled cursor-not-allowed"
                                        : "bg-emerald-600 text-white hover:bg-emerald-700"
                                    }
                                `}
              >
                {uploading ? "Importing..." : "Finish & Import"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
