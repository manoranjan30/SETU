import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import {
  Archive,
  BarChart3,
  Calculator,
  Check,
  ChevronDown,
  ChevronRight,
  Database,
  Download,
  Eye,
  FileText,
  MapPin,
  Plus,
  Save,
  Settings2,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { PermissionCode } from "../../config/permissions";
import EpsLocationPicker from "../../components/common/EpsLocationPicker";
import { customTrackerService } from "../../services/customTracker.service";
import {
  type CustomTracker,
  type CustomTrackerAnalytics,
  type CustomTrackerCategory,
  type CustomTrackerField,
  type CustomTrackerFieldType,
  type CustomTrackerRecord,
  type CustomTrackerRecordStatus,
} from "../../services/customTracker.service";

type TrackerTab = "setup" | "preview" | "records" | "visualization" | "reporting";

interface TrackerViewConfig {
  groupLevels: string[];
  slicers: Record<string, string>;
  valueFields: string[];
  chartType: "BAR" | "TABLE" | "STATUS";
  reportTitle: string;
}

interface PivotRow {
  key: string;
  label: string;
  level: number;
  count: number;
  averageProgress: number;
  sums: Record<string, number>;
  children: PivotRow[];
  records: CustomTrackerRecord[];
}

const fieldTypes: CustomTrackerFieldType[] = [
  "TEXT",
  "NUMBER",
  "DATE",
  "BOOLEAN",
  "SELECT",
  "MULTI_SELECT",
  "PERCENT",
  "STATUS",
  "USER",
  "CURRENCY",
  "FORMULA",
];

const recordStatuses: CustomTrackerRecordStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "BLOCKED",
  "ON_HOLD",
];

const defaultCategories: CustomTrackerCategory[] = [
  { key: "package", label: "Package", options: ["Civil", "MEP", "Finishing"] },
  { key: "contractor", label: "Contractor", options: [] },
  { key: "zone", label: "Zone", options: [] },
];

const emptyField = {
  label: "",
  key: "",
  fieldType: "TEXT" as CustomTrackerFieldType,
  required: false,
  unit: "",
  optionsText: "",
  formula: "",
  sequence: 0,
  isKpi: false,
};

const locationScopeOptions = ["BLOCK", "TOWER", "FLOOR", "UNIT", "ROOM"];

const labelize = (value: string) =>
  value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const percent = (value: number) => `${Math.round(Number(value || 0))}%`;

const evaluateLocalFormula = (
  formula: string | null | undefined,
  values: Record<string, any>,
) => {
  const expression = String(formula || "").trim();
  if (!expression || !/^[a-zA-Z0-9_+\-*/().\s]+$/.test(expression)) return "";
  const hydrated = expression.replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, (token) => {
    const value = Number(values[token]);
    return Number.isFinite(value) ? String(value) : "0";
  });
  try {
    const result = Function(`"use strict"; return (${hydrated});`)();
    return Number.isFinite(Number(result)) ? Number(result).toFixed(2) : "";
  } catch {
    return "";
  }
};

const defaultViewConfig = (
  tracker?: CustomTracker | null,
  fields: CustomTrackerField[] = [],
): TrackerViewConfig => ({
  groupLevels: tracker?.locationScopeTypes?.length
    ? tracker.locationScopeTypes
    : ["BLOCK", "TOWER", "FLOOR", "UNIT"],
  slicers: {},
  valueFields: fields
    .filter((field) =>
      ["NUMBER", "PERCENT", "CURRENCY", "FORMULA"].includes(field.fieldType),
    )
    .slice(0, 4)
    .map((field) => field.key),
  chartType: "BAR",
  reportTitle: tracker?.name || "Custom Tracker Report",
});

const normalizeViewConfig = (
  tracker: CustomTracker,
  fields: CustomTrackerField[],
): TrackerViewConfig => {
  const raw = (tracker.chartConfig || {}) as Partial<TrackerViewConfig>;
  const fallback = defaultViewConfig(tracker, fields);
  return {
    groupLevels: Array.isArray(raw.groupLevels) && raw.groupLevels.length
      ? raw.groupLevels
      : fallback.groupLevels,
    slicers:
      raw.slicers && typeof raw.slicers === "object" && !Array.isArray(raw.slicers)
        ? raw.slicers
        : {},
    valueFields: Array.isArray(raw.valueFields) && raw.valueFields.length
      ? raw.valueFields
      : fallback.valueFields,
    chartType: raw.chartType || fallback.chartType,
    reportTitle: raw.reportTitle || fallback.reportTitle,
  };
};

const splitLocationPath = (record: CustomTrackerRecord) =>
  String(record.locationText || "Unmapped")
    .split(">")
    .map((part) => part.trim())
    .filter(Boolean);

const getGroupValue = (
  record: CustomTrackerRecord,
  groupKey: string,
  categories: CustomTrackerCategory[],
) => {
  const path = splitLocationPath(record);
  const locationIndex = locationScopeOptions.indexOf(groupKey);
  if (locationIndex >= 0) return path[locationIndex] || "Unmapped";
  if (groupKey === "STATUS") return labelize(record.status);
  const category = categories.find((item) => item.key === groupKey);
  if (category) return record.categoryValues?.[category.key] || "Unspecified";
  return "Unspecified";
};

const buildPivotRows = (
  rows: CustomTrackerRecord[],
  groupLevels: string[],
  valueFields: CustomTrackerField[],
  categories: CustomTrackerCategory[],
) => {
  const roots: PivotRow[] = [];
  const index = new Map<string, PivotRow>();

  rows.forEach((record) => {
    let branch = roots;
    let parentKey = "";
    groupLevels.forEach((groupKey, level) => {
      const label = getGroupValue(record, groupKey, categories);
      const key = `${parentKey}/${groupKey}:${label}`;
      let node = index.get(key);
      if (!node) {
        node = {
          key,
          label,
          level,
          count: 0,
          averageProgress: 0,
          sums: {},
          children: [],
          records: [],
        };
        index.set(key, node);
        branch.push(node);
      }
      node.count += 1;
      node.averageProgress += Number(record.progressPercent || 0);
      node.records.push(record);
      valueFields.forEach((field) => {
        const value = Number(record.values?.[field.key]);
        if (Number.isFinite(value)) {
          node!.sums[field.key] = (node!.sums[field.key] || 0) + value;
        }
      });
      branch = node.children;
      parentKey = key;
    });
  });

  const finalize = (nodes: PivotRow[]) => {
    nodes.forEach((node) => {
      node.averageProgress = node.count ? node.averageProgress / node.count : 0;
      node.children.sort((a, b) => a.label.localeCompare(b.label));
      finalize(node.children);
    });
  };
  roots.sort((a, b) => a.label.localeCompare(b.label));
  finalize(roots);
  return roots;
};

const flattenPivotRows = (
  rows: PivotRow[],
  expanded: Set<string>,
): PivotRow[] =>
  rows.flatMap((row) => [
    row,
    ...(expanded.has(row.key) ? flattenPivotRows(row.children, expanded) : []),
  ]);

export default function CustomTrackerPage() {
  const { projectId } = useParams();
  const pId = Number(projectId || 0);
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(PermissionCode.PLANNING_CUSTOM_TRACKER_CREATE);
  const canUpdate = hasPermission(PermissionCode.PLANNING_CUSTOM_TRACKER_UPDATE);
  const canDelete = hasPermission(PermissionCode.PLANNING_CUSTOM_TRACKER_DELETE);
  const canConfig = hasPermission(PermissionCode.PLANNING_CUSTOM_TRACKER_CONFIG);

  const [trackers, setTrackers] = useState<CustomTracker[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<CustomTracker | null>(null);
  const [analytics, setAnalytics] = useState<CustomTrackerAnalytics | null>(null);
  const [records, setRecords] = useState<CustomTrackerRecord[]>([]);
  const [tab, setTab] = useState<TrackerTab>("setup");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [viewConfig, setViewConfig] = useState<TrackerViewConfig>(
    defaultViewConfig(),
  );
  const [expandedPivotRows, setExpandedPivotRows] = useState<Set<string>>(
    new Set(),
  );

  const [trackerForm, setTrackerForm] = useState({
    name: "",
    description: "",
    trackerType: "GENERAL",
    categoryConfig: defaultCategories as CustomTrackerCategory[],
    locationScopeTypes: ["BLOCK", "TOWER", "FLOOR", "UNIT"],
  });
  const [fieldForm, setFieldForm] = useState(emptyField);
  const [recordForm, setRecordForm] = useState({
    id: null as number | null,
    epsNodeId: null as number | null,
    locationText: "",
    categoryValues: {} as Record<string, string>,
    values: {} as Record<string, any>,
    status: "NOT_STARTED" as CustomTrackerRecordStatus,
    progressPercent: 0,
    remarks: "",
  });

  const fields = useMemo(() => selected?.fields || [], [selected]);
  const numericFields = useMemo(
    () =>
      fields.filter((field) =>
        ["NUMBER", "PERCENT", "CURRENCY", "FORMULA"].includes(field.fieldType),
      ),
    [fields],
  );
  const categories = useMemo(
    () => selected?.categoryConfig || defaultCategories,
    [selected],
  );
  const valueFields = useMemo(
    () =>
      numericFields.filter((field) => viewConfig.valueFields.includes(field.key)),
    [numericFields, viewConfig.valueFields],
  );
  const filteredRecords = useMemo(
    () =>
      records.filter((record) =>
        Object.entries(viewConfig.slicers || {}).every(([key, selectedValue]) => {
          if (!selectedValue) return true;
          return getGroupValue(record, key, categories) === selectedValue;
        }),
      ),
    [records, viewConfig.slicers, categories],
  );
  const pivotRows = useMemo(
    () =>
      buildPivotRows(
        filteredRecords,
        viewConfig.groupLevels.length ? viewConfig.groupLevels : ["STATUS"],
        valueFields,
        categories,
      ),
    [filteredRecords, viewConfig.groupLevels, valueFields, categories],
  );
  const visiblePivotRows = useMemo(
    () => flattenPivotRows(pivotRows, expandedPivotRows),
    [pivotRows, expandedPivotRows],
  );
  const slicerOptions = useMemo(() => {
    const keys = [
      ...viewConfig.groupLevels,
      "STATUS",
      ...categories.map((category) => category.key),
    ];
    return Array.from(new Set(keys)).map((key) => ({
      key,
      label:
        categories.find((category) => category.key === key)?.label || labelize(key),
      options: Array.from(
        new Set(records.map((record) => getGroupValue(record, key, categories))),
      )
        .filter(Boolean)
        .sort(),
    }));
  }, [records, viewConfig.groupLevels, categories]);

  const loadTrackers = async () => {
    setLoading(true);
    try {
      const data = await customTrackerService.list(pId);
      setTrackers(data);
      if (!selectedId && data[0]) setSelectedId(data[0].id);
      if (selectedId && !data.some((tracker) => tracker.id === selectedId)) {
        setSelectedId(data[0]?.id || null);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadSelected = async (trackerId: number) => {
    setLoading(true);
    try {
      const [tracker, trackerRecords, trackerAnalytics] = await Promise.all([
        customTrackerService.get(pId, trackerId),
        customTrackerService.listRecords(pId, trackerId),
        customTrackerService.analytics(pId, trackerId),
      ]);
      setSelected(tracker);
      setRecords(trackerRecords);
      setAnalytics(trackerAnalytics);
      setTrackerForm({
        name: tracker.name,
        description: tracker.description || "",
        trackerType: tracker.trackerType || "GENERAL",
        locationScopeTypes: tracker.locationScopeTypes?.length
          ? tracker.locationScopeTypes
          : ["BLOCK", "TOWER", "FLOOR", "UNIT"],
        categoryConfig: tracker.categoryConfig?.length
          ? tracker.categoryConfig
          : defaultCategories,
      });
      setViewConfig(normalizeViewConfig(tracker, tracker.fields || []));
      setExpandedPivotRows(new Set());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pId) void loadTrackers();
  }, [pId]);

  useEffect(() => {
    if (pId && selectedId) void loadSelected(selectedId);
  }, [pId, selectedId]);

  const flash = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 2500);
  };

  const applyQuantityTemplate = () => {
    setTrackerForm((prev) => ({
      ...prev,
      name: prev.name || "Location Quantity Tracker",
      description:
        prev.description ||
        "Tracks description, activity, location-wise total quantity, completed quantity, balance, and completion percentage.",
      trackerType: "QUANTITY_PROGRESS",
      locationScopeTypes: ["BLOCK", "TOWER", "FLOOR", "UNIT"],
      categoryConfig: [
        { key: "activity", label: "Activity", options: [] },
        { key: "package", label: "Package", options: [] },
      ],
    }));
    flash("Quantity tracker template loaded. Save to create the format.");
  };

  const saveViewConfig = async () => {
    if (!selected) return;
    const saved = await customTrackerService.update(pId, selected.id, {
      chartConfig: viewConfig,
    });
    setSelected(saved);
    flash("Visualization setup saved");
  };

  const moveGroupLevel = (index: number, direction: -1 | 1) => {
    setViewConfig((prev) => {
      const next = [...prev.groupLevels];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, groupLevels: next };
    });
  };

  const togglePivotRow = (key: string) => {
    setExpandedPivotRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const exportReportCsv = async () => {
    if (!selected) return;
    await saveViewConfig();
    const blob = await customTrackerService.exportReportCsv(pId, selected.id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(selected?.name || "custom-tracker").replace(/[^a-z0-9]+/gi, "_")}_report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const saveTracker = async () => {
    if (!trackerForm.name.trim()) return flash("Tracker name is required");
    const payload = {
      name: trackerForm.name,
      description: trackerForm.description,
      trackerType: trackerForm.trackerType,
      categoryConfig: trackerForm.categoryConfig,
      locationScopeTypes: trackerForm.locationScopeTypes,
      chartConfig: viewConfig,
    };
    const saved = selected
      ? await customTrackerService.update(pId, selected.id, payload)
      : await customTrackerService.create(pId, {
          ...payload,
          fields: [
            {
              label: "Description",
              key: "description",
              fieldType: "TEXT",
              required: false,
              sequence: 1,
              isKpi: false,
            },
            {
              label: "Activity",
              key: "activity",
              fieldType: "TEXT",
              required: false,
              sequence: 2,
              isKpi: false,
            },
            {
              label: "Total Qty",
              key: "total_qty",
              fieldType: "NUMBER",
              required: false,
              sequence: 3,
              isKpi: true,
            },
            {
              label: "Completed",
              key: "completed",
              fieldType: "NUMBER",
              required: false,
              sequence: 4,
              isKpi: true,
            },
            {
              label: "Balance",
              key: "balance",
              fieldType: "FORMULA",
              formula: "total_qty - completed",
              required: false,
              sequence: 5,
              isKpi: true,
            },
            {
              label: "Completed %",
              key: "completed_percent",
              fieldType: "FORMULA",
              formula: "(completed / total_qty) * 100",
              required: false,
              unit: "%",
              sequence: 6,
              isKpi: true,
            },
          ],
        });
    setSelectedId(saved.id);
    await loadTrackers();
    await loadSelected(saved.id);
    flash("Tracker saved");
  };

  const archiveTracker = async () => {
    if (!selected || !confirm(`Archive ${selected.name}?`)) return;
    await customTrackerService.archive(pId, selected.id);
    setSelected(null);
    setSelectedId(null);
    await loadTrackers();
    flash("Tracker archived");
  };

  const saveField = async () => {
    if (!selected) return;
    if (!fieldForm.label.trim()) return flash("Field label is required");
    await customTrackerService.createField(pId, selected.id, {
      label: fieldForm.label,
      key: fieldForm.key,
      fieldType: fieldForm.fieldType,
      required: fieldForm.required,
      unit: fieldForm.unit,
      options: fieldForm.optionsText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      formula: fieldForm.formula,
      sequence: fieldForm.sequence,
      isKpi: fieldForm.isKpi,
    });
    setFieldForm(emptyField);
    await loadSelected(selected.id);
    flash("Field added");
  };

  const deleteField = async (field: CustomTrackerField) => {
    if (!selected || !confirm(`Delete field ${field.label}?`)) return;
    await customTrackerService.deleteField(pId, selected.id, field.id);
    await loadSelected(selected.id);
  };

  const resetRecordForm = () => {
    setRecordForm({
      id: null,
      epsNodeId: null,
      locationText: "",
      categoryValues: {},
      values: {},
      status: "NOT_STARTED",
      progressPercent: 0,
      remarks: "",
    });
  };

  const saveRecord = async () => {
    if (!selected) return;
    const payload = {
      epsNodeId: recordForm.epsNodeId,
      locationText: recordForm.locationText,
      categoryValues: recordForm.categoryValues,
      values: recordForm.values,
      status: recordForm.status,
      progressPercent: Number(recordForm.progressPercent || 0),
      remarks: recordForm.remarks,
    };
    if (recordForm.id) {
      await customTrackerService.updateRecord(pId, selected.id, recordForm.id, payload);
    } else {
      await customTrackerService.createRecord(pId, selected.id, payload);
    }
    resetRecordForm();
    await loadSelected(selected.id);
    flash("Record saved");
  };

  const editRecord = (record: CustomTrackerRecord) => {
    setRecordForm({
      id: record.id,
      epsNodeId: record.epsNodeId || null,
      locationText: record.locationText || "",
      categoryValues: record.categoryValues || {},
      values: record.values || {},
      status: record.status,
      progressPercent: Number(record.progressPercent || 0),
      remarks: record.remarks || "",
    });
    setTab("records");
  };

  const deleteRecord = async (record: CustomTrackerRecord) => {
    if (!selected || !confirm("Delete this tracker record?")) return;
    await customTrackerService.deleteRecord(pId, selected.id, record.id);
    await loadSelected(selected.id);
  };

  const updateRecordValue = (key: string, value: any) => {
    setRecordForm((prev) => ({
      ...prev,
      values: { ...prev.values, [key]: value },
    }));
  };

  const updateCategoryValue = (key: string, value: string) => {
    setRecordForm((prev) => ({
      ...prev,
      categoryValues: { ...prev.categoryValues, [key]: value },
    }));
  };

  const renderFieldInput = (field: CustomTrackerField) => {
    const value = recordForm.values[field.key] ?? "";
    if (field.fieldType === "FORMULA") {
      return (
        <input
          value={evaluateLocalFormula(field.formula, recordForm.values)}
          readOnly
          title={field.formula || ""}
          className="h-9 w-full rounded-lg border border-border-default bg-surface-ground px-2 text-sm text-text-muted"
        />
      );
    }
    if (field.fieldType === "BOOLEAN") {
      return (
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => updateRecordValue(field.key, event.target.checked)}
          />
          Yes
        </label>
      );
    }
    if (field.fieldType === "SELECT" || field.fieldType === "STATUS") {
      return (
        <select
          value={value}
          onChange={(event) => updateRecordValue(field.key, event.target.value)}
          className="h-9 w-full rounded-lg border border-border-default px-2 text-sm"
        >
          <option value="">Select</option>
          {(field.options || []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }
    if (field.fieldType === "MULTI_SELECT") {
      return (
        <input
          value={Array.isArray(value) ? value.join(", ") : value}
          onChange={(event) =>
            updateRecordValue(
              field.key,
              event.target.value.split(",").map((item) => item.trim()).filter(Boolean),
            )
          }
          placeholder="Comma separated values"
          className="h-9 w-full rounded-lg border border-border-default px-2 text-sm"
        />
      );
    }
    const inputType =
      field.fieldType === "DATE"
        ? "date"
        : ["NUMBER", "PERCENT", "CURRENCY"].includes(field.fieldType)
          ? "number"
          : "text";
    return (
      <input
        type={inputType}
        value={value}
        onChange={(event) => updateRecordValue(field.key, event.target.value)}
        className="h-9 w-full rounded-lg border border-border-default px-2 text-sm"
      />
    );
  };

  return (
    <div className="flex h-full min-h-0 bg-surface-ground text-text-primary">
      <aside className="w-72 flex-shrink-0 border-r border-border-default bg-surface-card">
        <div className="border-b border-border-subtle p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">Custom Trackers</h2>
              <p className="text-xs text-text-muted">Project tree based progress tools</p>
            </div>
            {canCreate && (
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setSelectedId(null);
                  setTab("setup");
                  setTrackerForm({
                    name: "",
                    description: "",
                    trackerType: "GENERAL",
                    locationScopeTypes: ["BLOCK", "TOWER", "FLOOR", "UNIT"],
                    categoryConfig: defaultCategories,
                  });
                  setViewConfig(defaultViewConfig());
                }}
                className="rounded-lg border border-border-default p-2 text-primary"
                title="New tracker"
              >
                <Plus size={16} />
              </button>
            )}
          </div>
        </div>
        <div className="h-[calc(100%-73px)] overflow-y-auto p-2">
          {trackers.map((tracker) => (
            <button
              key={tracker.id}
              type="button"
              onClick={() => {
                setSelectedId(tracker.id);
                setTab("records");
              }}
              className={`mb-2 w-full rounded-lg border px-3 py-2 text-left text-sm ${
                selectedId === tracker.id
                  ? "border-primary/40 bg-primary-muted text-primary"
                  : "border-border-default bg-surface-raised text-text-secondary"
              }`}
            >
              <div className="font-semibold text-text-primary">{tracker.name}</div>
              <div className="mt-1 flex items-center justify-between text-xs text-text-muted">
                <span>{tracker.trackerType}</span>
                <span>{tracker.recordCount || 0} records</span>
              </div>
            </button>
          ))}
          {!trackers.length && !loading && (
            <div className="rounded-lg border border-dashed border-border-default p-4 text-sm text-text-muted">
              Create a tracker for facade, MEP clearances, flats, procurement,
              handover, or any project-specific progress dimension.
            </div>
          )}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border-default bg-surface-card px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold">
                {selected?.name || "Create Custom Tracker"}
              </h1>
              <p className="text-xs text-text-muted">
                Configure custom headers, map records to location tree, and review
                multidimensional progress rollups.
              </p>
            </div>
            {message && (
              <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                {message}
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              ["setup", Settings2, "1. Tracker Setup"],
              ["preview", Eye, "2. Preview Setup"],
              ["records", Database, "3. Record"],
              ["visualization", BarChart3, "4. Visualization"],
              ["reporting", FileText, "5. Reporting"],
            ].map(([key, Icon, label]) => (
              <button
                key={key as string}
                type="button"
                onClick={() => setTab(key as any)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                  tab === key
                    ? "border-primary/40 bg-primary-muted text-primary"
                    : "border-border-default bg-surface-raised text-text-secondary"
                }`}
              >
                <Icon size={15} />
                {label as string}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {tab === "setup" && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.8fr)]">
              <section className="rounded-lg border border-border-default bg-surface-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Tracker Definition</h3>
                  <div className="flex gap-2">
                    {(canCreate || canUpdate) && (
                      <button
                        type="button"
                        onClick={applyQuantityTemplate}
                        className="inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-sm font-semibold text-text-secondary"
                      >
                        <Calculator size={15} />
                        Qty Template
                      </button>
                    )}
                    {(canCreate || canUpdate) && (
                      <button
                        type="button"
                        onClick={saveTracker}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
                      >
                        <Save size={15} />
                        Save
                      </button>
                    )}
                    {selected && canDelete && (
                      <button
                        type="button"
                        onClick={archiveTracker}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600"
                      >
                        <Archive size={15} />
                        Archive
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-xs font-semibold text-text-muted">
                    Tracker Name
                    <input
                      value={trackerForm.name}
                      onChange={(event) =>
                        setTrackerForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                      className="mt-1 h-10 w-full rounded-lg border border-border-default px-3 text-sm text-text-primary"
                    />
                  </label>
                  <label className="text-xs font-semibold text-text-muted">
                    Tracker Type
                    <input
                      value={trackerForm.trackerType}
                      onChange={(event) =>
                        setTrackerForm((prev) => ({
                          ...prev,
                          trackerType: event.target.value,
                        }))
                      }
                      placeholder="Facade, MEP, Handover..."
                      className="mt-1 h-10 w-full rounded-lg border border-border-default px-3 text-sm text-text-primary"
                    />
                  </label>
                  <label className="md:col-span-2 text-xs font-semibold text-text-muted">
                    Description
                    <textarea
                      value={trackerForm.description}
                      onChange={(event) =>
                        setTrackerForm((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                      rows={3}
                      className="mt-1 w-full rounded-lg border border-border-default px-3 py-2 text-sm text-text-primary"
                    />
                  </label>
                </div>

                <div className="mt-5">
                  <h4 className="mb-2 text-sm font-semibold">Location Tree Levels</h4>
                  <p className="mb-2 text-xs text-text-muted">
                    Select the EPS levels that users can treat as recordable
                    locations. Parent levels are still included in rollups.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {locationScopeOptions.map((level) => (
                      <label
                        key={level}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                          trackerForm.locationScopeTypes.includes(level)
                            ? "border-primary/40 bg-primary-muted text-primary"
                            : "border-border-default text-text-secondary"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={trackerForm.locationScopeTypes.includes(level)}
                          onChange={(event) =>
                            setTrackerForm((prev) => ({
                              ...prev,
                              locationScopeTypes: event.target.checked
                                ? [...prev.locationScopeTypes, level]
                                : prev.locationScopeTypes.filter(
                                    (item) => item !== level,
                                  ),
                            }))
                          }
                        />
                        {level}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mt-5">
                  <h4 className="mb-2 text-sm font-semibold">Analysis Dimensions</h4>
                  <div className="grid gap-2">
                    {trackerForm.categoryConfig.map((category, index) => (
                      <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_2fr]">
                        <input
                          value={category.label}
                          onChange={(event) => {
                            const next = [...trackerForm.categoryConfig];
                            next[index] = {
                              ...next[index],
                              label: event.target.value,
                              key: event.target.value
                                .toLowerCase()
                                .replace(/[^a-z0-9]+/g, "_")
                                .replace(/^_+|_+$/g, ""),
                            };
                            setTrackerForm((prev) => ({ ...prev, categoryConfig: next }));
                          }}
                          placeholder="Dimension label"
                          className="h-9 rounded-lg border border-border-default px-2 text-sm"
                        />
                        <input
                          value={category.key}
                          readOnly
                          className="h-9 rounded-lg border border-border-default bg-surface-ground px-2 text-sm text-text-muted"
                        />
                        <input
                          value={(category.options || []).join(", ")}
                          onChange={(event) => {
                            const next = [...trackerForm.categoryConfig];
                            next[index] = {
                              ...next[index],
                              options: event.target.value
                                .split(",")
                                .map((item) => item.trim())
                                .filter(Boolean),
                            };
                            setTrackerForm((prev) => ({ ...prev, categoryConfig: next }));
                          }}
                          placeholder="Options, comma separated"
                          className="h-9 rounded-lg border border-border-default px-2 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setTrackerForm((prev) => ({
                        ...prev,
                        categoryConfig: [
                          ...prev.categoryConfig,
                          { key: "", label: "", options: [] },
                        ],
                      }))
                    }
                    className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-1.5 text-sm"
                  >
                    <Plus size={14} />
                    Add Dimension
                  </button>
                </div>
              </section>

              <section className="rounded-lg border border-border-default bg-surface-card p-4">
                <h3 className="mb-3 text-sm font-semibold">Custom Headers</h3>
                <div className="space-y-2">
                  {fields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between rounded-lg border border-border-default px-3 py-2 text-sm"
                    >
                      <div>
                        <div className="font-semibold">{field.label}</div>
                        <div className="text-xs text-text-muted">
                          {field.key} • {field.fieldType}
                          {field.required ? " • required" : ""}
                          {field.isKpi ? " • KPI" : ""}
                          {field.formula ? ` • ${field.formula}` : ""}
                        </div>
                      </div>
                      {canConfig && (
                        <button
                          type="button"
                          onClick={() => deleteField(field)}
                          className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {selected && canConfig && (
                  <div className="mt-4 border-t border-border-subtle pt-4">
                    <div className="grid gap-2 md:grid-cols-2">
                      <input
                        value={fieldForm.label}
                        onChange={(event) =>
                          setFieldForm((prev) => ({
                            ...prev,
                            label: event.target.value,
                          }))
                        }
                        placeholder="Header label"
                        className="h-9 rounded-lg border border-border-default px-2 text-sm"
                      />
                      <select
                        value={fieldForm.fieldType}
                        onChange={(event) =>
                          setFieldForm((prev) => ({
                            ...prev,
                            fieldType: event.target.value as CustomTrackerFieldType,
                          }))
                        }
                        className="h-9 rounded-lg border border-border-default px-2 text-sm"
                      >
                        {fieldTypes.map((type) => (
                          <option key={type} value={type}>
                            {labelize(type)}
                          </option>
                        ))}
                      </select>
                      <input
                        value={fieldForm.unit}
                        onChange={(event) =>
                          setFieldForm((prev) => ({ ...prev, unit: event.target.value }))
                        }
                        placeholder="Unit"
                        className="h-9 rounded-lg border border-border-default px-2 text-sm"
                      />
                      <input
                        type="number"
                        value={fieldForm.sequence}
                        onChange={(event) =>
                          setFieldForm((prev) => ({
                            ...prev,
                            sequence: Number(event.target.value || 0),
                          }))
                        }
                        placeholder="Order"
                        className="h-9 rounded-lg border border-border-default px-2 text-sm"
                      />
                      <input
                        value={fieldForm.optionsText}
                        onChange={(event) =>
                          setFieldForm((prev) => ({
                            ...prev,
                            optionsText: event.target.value,
                          }))
                        }
                        placeholder="Options for select fields"
                        className="md:col-span-2 h-9 rounded-lg border border-border-default px-2 text-sm"
                      />
                      {fieldForm.fieldType === "FORMULA" && (
                        <input
                          value={fieldForm.formula}
                          onChange={(event) =>
                            setFieldForm((prev) => ({
                              ...prev,
                              formula: event.target.value,
                            }))
                          }
                          placeholder="Formula, e.g. total_qty - completed"
                          className="md:col-span-2 h-9 rounded-lg border border-border-default px-2 text-sm"
                        />
                      )}
                      <label className="flex items-center gap-2 text-sm text-text-secondary">
                        <input
                          type="checkbox"
                          checked={fieldForm.required}
                          onChange={(event) =>
                            setFieldForm((prev) => ({
                              ...prev,
                              required: event.target.checked,
                            }))
                          }
                        />
                        Required
                      </label>
                      <label className="flex items-center gap-2 text-sm text-text-secondary">
                        <input
                          type="checkbox"
                          checked={fieldForm.isKpi}
                          onChange={(event) =>
                            setFieldForm((prev) => ({
                              ...prev,
                              isKpi: event.target.checked,
                            }))
                          }
                        />
                        KPI summary
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={saveField}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-sm font-semibold"
                    >
                      <Plus size={15} />
                      Add Header
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}

          {tab === "preview" && selected && (
            <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
              <section className="rounded-lg border border-border-default bg-surface-card p-4">
                <h3 className="mb-2 text-sm font-semibold">Form Preview</h3>
                <p className="mb-4 text-xs text-text-muted">
                  This is how users will capture records. Formula headers are
                  calculated after entry and shown read-only.
                </p>
                <div className="space-y-3">
                  <div className="rounded-lg border border-border-default p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-text-muted">
                      <MapPin size={14} />
                      Location Tree
                    </div>
                    <div className="space-y-1">
                      {trackerForm.locationScopeTypes.map((level, index) => (
                        <div
                          key={level}
                          className="flex items-center gap-2 rounded-md bg-surface-ground px-2 py-1.5 text-sm"
                          style={{ marginLeft: index * 14 }}
                        >
                          {index < trackerForm.locationScopeTypes.length - 1 ? (
                            <ChevronRight size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                          {level}
                        </div>
                      ))}
                    </div>
                  </div>
                  {categories.map((category) => (
                    <div key={category.key} className="rounded-lg border border-border-default p-3">
                      <div className="text-xs font-semibold text-text-muted">
                        Dimension
                      </div>
                      <div className="mt-1 text-sm font-semibold">
                        {category.label}
                      </div>
                    </div>
                  ))}
                  {fields.map((field) => (
                    <div key={field.id} className="rounded-lg border border-border-default p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{field.label}</div>
                          <div className="text-xs text-text-muted">
                            {labelize(field.fieldType)}
                            {field.unit ? ` • ${field.unit}` : ""}
                            {field.required ? " • required" : ""}
                          </div>
                        </div>
                        {field.fieldType === "FORMULA" && (
                          <span className="rounded-full bg-info-muted px-2 py-1 text-xs font-semibold text-primary">
                            {field.formula}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <section className="rounded-lg border border-border-default bg-surface-card p-4">
                <h3 className="mb-2 text-sm font-semibold">Collapsible Tracker Structure</h3>
                <p className="mb-4 text-xs text-text-muted">
                  The tracker breaks location data by the configured levels, then
                  applies sub headers below the selected location.
                </p>
                <div className="rounded-lg border border-border-default bg-surface-ground p-3">
                  <TreePreview
                    levels={trackerForm.locationScopeTypes}
                    fields={fields}
                  />
                </div>
              </section>
            </div>
          )}

          {tab === "records" && selected && (
            <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
              <section className="rounded-lg border border-border-default bg-surface-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">
                    {recordForm.id ? "Edit Record" : "Add Record"}
                  </h3>
                  {recordForm.id && (
                    <button
                      type="button"
                      onClick={resetRecordForm}
                      className="text-xs font-semibold text-primary"
                    >
                      New
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-text-muted">
                    Location
                    <div className="mt-1">
                      <EpsLocationPicker
                        projectId={pId}
                        value={recordForm.epsNodeId}
                        onChange={(nodeId, nodeLabel) =>
                          setRecordForm((prev) => ({
                            ...prev,
                            epsNodeId: nodeId,
                            locationText: nodeLabel,
                          }))
                        }
                      />
                    </div>
                  </label>
                  {categories.map((category) => (
                    <label
                      key={category.key}
                      className="block text-xs font-semibold text-text-muted"
                    >
                      {category.label}
                      {category.options?.length ? (
                        <select
                          value={recordForm.categoryValues[category.key] || ""}
                          onChange={(event) =>
                            updateCategoryValue(category.key, event.target.value)
                          }
                          className="mt-1 h-9 w-full rounded-lg border border-border-default px-2 text-sm"
                        >
                          <option value="">Select</option>
                          {category.options.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={recordForm.categoryValues[category.key] || ""}
                          onChange={(event) =>
                            updateCategoryValue(category.key, event.target.value)
                          }
                          className="mt-1 h-9 w-full rounded-lg border border-border-default px-2 text-sm"
                        />
                      )}
                    </label>
                  ))}
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs font-semibold text-text-muted">
                      Status
                      <select
                        value={recordForm.status}
                        onChange={(event) =>
                          setRecordForm((prev) => ({
                            ...prev,
                            status: event.target.value as CustomTrackerRecordStatus,
                          }))
                        }
                        className="mt-1 h-9 w-full rounded-lg border border-border-default px-2 text-sm"
                      >
                        {recordStatuses.map((status) => (
                          <option key={status} value={status}>
                            {labelize(status)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-text-muted">
                      Progress %
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={recordForm.progressPercent}
                        onChange={(event) =>
                          setRecordForm((prev) => ({
                            ...prev,
                            progressPercent: Number(event.target.value || 0),
                          }))
                        }
                        className="mt-1 h-9 w-full rounded-lg border border-border-default px-2 text-sm"
                      />
                    </label>
                  </div>
                  {fields.map((field) => (
                    <label
                      key={field.id}
                      className="block text-xs font-semibold text-text-muted"
                    >
                      {field.label}
                      {field.required ? " *" : ""}
                      {field.unit ? ` (${field.unit})` : ""}
                      <div className="mt-1">{renderFieldInput(field)}</div>
                    </label>
                  ))}
                  <label className="block text-xs font-semibold text-text-muted">
                    Remarks
                    <textarea
                      value={recordForm.remarks}
                      onChange={(event) =>
                        setRecordForm((prev) => ({
                          ...prev,
                          remarks: event.target.value,
                        }))
                      }
                      rows={3}
                      className="mt-1 w-full rounded-lg border border-border-default px-2 py-2 text-sm"
                    />
                  </label>
                  {canUpdate && (
                    <button
                      type="button"
                      onClick={saveRecord}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
                    >
                      <Check size={15} />
                      Save Record
                    </button>
                  )}
                </div>
              </section>

              <section className="min-w-0 rounded-lg border border-border-default bg-surface-card">
                <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
                  <h3 className="text-sm font-semibold">Tracker Records</h3>
                  <span className="text-xs text-text-muted">{records.length} rows</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-surface-ground text-xs uppercase text-text-muted">
                      <tr>
                        <th className="px-3 py-2">Location</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Progress</th>
                        {categories.map((category) => (
                          <th key={category.key} className="px-3 py-2">
                            {category.label}
                          </th>
                        ))}
                        {fields.slice(0, 6).map((field) => (
                          <th key={field.id} className="px-3 py-2">
                            {field.label}
                          </th>
                        ))}
                        <th className="px-3 py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record) => (
                        <tr key={record.id} className="border-t border-border-subtle">
                          <td className="min-w-56 px-3 py-2">
                            <div className="flex items-start gap-2">
                              <MapPin size={14} className="mt-0.5 text-text-muted" />
                              <span>{record.locationText || "Unmapped"}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">{labelize(record.status)}</td>
                          <td className="min-w-36 px-3 py-2">
                            <div className="h-2 rounded-full bg-surface-ground">
                              <div
                                className="h-2 rounded-full bg-primary"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Number(record.progressPercent || 0),
                                  )}%`,
                                }}
                              />
                            </div>
                            <div className="mt-1 text-xs text-text-muted">
                              {percent(record.progressPercent)}
                            </div>
                          </td>
                          {categories.map((category) => (
                            <td key={category.key} className="px-3 py-2">
                              {record.categoryValues?.[category.key] || "-"}
                            </td>
                          ))}
                          {fields.slice(0, 6).map((field) => (
                            <td key={field.id} className="px-3 py-2">
                              {Array.isArray(record.values?.[field.key])
                                ? record.values[field.key].join(", ")
                                : String(record.values?.[field.key] ?? "-")}
                            </td>
                          ))}
                          <td className="whitespace-nowrap px-3 py-2">
                            <button
                              type="button"
                              onClick={() => editRecord(record)}
                              className="rounded-lg border border-border-default px-2 py-1 text-xs font-semibold"
                            >
                              Edit
                            </button>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => deleteRecord(record)}
                                className="ml-2 rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-600"
                              >
                                Delete
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {!records.length && (
                        <tr>
                          <td
                            colSpan={4 + categories.length + fields.slice(0, 6).length}
                            className="px-3 py-8 text-center text-text-muted"
                          >
                            No records yet. Add the first location record from the form.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {tab === "visualization" && selected && analytics && (
            <div className="space-y-4">
              <section className="rounded-lg border border-border-default bg-surface-card p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Pivot & Slicer Setup</h3>
                    <p className="text-xs text-text-muted">
                      Rearrange row levels, choose value fields, and filter the
                      data like Excel slicers.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={saveViewConfig}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
                  >
                    <Save size={15} />
                    Save View
                  </button>
                </div>
                <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase text-text-muted">
                      Row Grouping Order
                    </div>
                    <div className="space-y-2">
                      {viewConfig.groupLevels.map((level, index) => (
                        <div
                          key={`${level}-${index}`}
                          className="flex items-center justify-between rounded-lg border border-border-default px-3 py-2 text-sm"
                        >
                          <span>{labelize(level)}</span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => moveGroupLevel(index, -1)}
                              className="rounded border border-border-default px-2 py-1 text-xs"
                            >
                              Up
                            </button>
                            <button
                              type="button"
                              onClick={() => moveGroupLevel(index, 1)}
                              className="rounded border border-border-default px-2 py-1 text-xs"
                            >
                              Down
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setViewConfig((prev) => ({
                                  ...prev,
                                  groupLevels: prev.groupLevels.filter(
                                    (_, itemIndex) => itemIndex !== index,
                                  ),
                                }))
                              }
                              className="rounded border border-red-200 px-2 py-1 text-xs text-red-600"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[...locationScopeOptions, "STATUS", ...categories.map((c) => c.key)]
                        .filter((level) => !viewConfig.groupLevels.includes(level))
                        .map((level) => (
                          <button
                            key={level}
                            type="button"
                            onClick={() =>
                              setViewConfig((prev) => ({
                                ...prev,
                                groupLevels: [...prev.groupLevels, level],
                              }))
                            }
                            className="rounded-lg border border-border-default px-2 py-1 text-xs"
                          >
                            + {categories.find((c) => c.key === level)?.label || labelize(level)}
                          </button>
                        ))}
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase text-text-muted">
                      Slicers
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      {slicerOptions.slice(0, 8).map((slicer) => (
                        <label key={slicer.key} className="text-xs font-semibold text-text-muted">
                          {slicer.label}
                          <select
                            value={viewConfig.slicers[slicer.key] || ""}
                            onChange={(event) =>
                              setViewConfig((prev) => ({
                                ...prev,
                                slicers: {
                                  ...prev.slicers,
                                  [slicer.key]: event.target.value,
                                },
                              }))
                            }
                            className="mt-1 h-9 w-full rounded-lg border border-border-default px-2 text-sm"
                          >
                            <option value="">All</option>
                            {slicer.options.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                    <div className="mt-4">
                      <div className="mb-2 text-xs font-semibold uppercase text-text-muted">
                        Values
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {numericFields.map((field) => (
                          <label
                            key={field.key}
                            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                              viewConfig.valueFields.includes(field.key)
                                ? "border-primary/40 bg-primary-muted text-primary"
                                : "border-border-default text-text-secondary"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={viewConfig.valueFields.includes(field.key)}
                              onChange={(event) =>
                                setViewConfig((prev) => ({
                                  ...prev,
                                  valueFields: event.target.checked
                                    ? [...prev.valueFields, field.key]
                                    : prev.valueFields.filter((key) => key !== field.key),
                                }))
                              }
                            />
                            {field.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
              <PivotTable
                rows={visiblePivotRows}
                valueFields={valueFields}
                expanded={expandedPivotRows}
                onToggle={togglePivotRow}
              />
              <div className="grid gap-3 md:grid-cols-4">
                <Metric label="Total Records" value={analytics.totalRecords} />
                <Metric label="Average Progress" value={percent(analytics.averageProgress)} />
                <Metric
                  label="Completed"
                  value={analytics.byStatus.COMPLETED || 0}
                />
                <Metric
                  label="Blocked / Hold"
                  value={(analytics.byStatus.BLOCKED || 0) + (analytics.byStatus.ON_HOLD || 0)}
                />
              </div>
              <section className="rounded-lg border border-border-default bg-surface-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <SlidersHorizontal size={16} />
                  <h3 className="text-sm font-semibold">Status Analysis</h3>
                </div>
                <div className="space-y-2">
                  {recordStatuses.map((status) => (
                    <Bar
                      key={status}
                      label={labelize(status)}
                      value={analytics.byStatus[status] || 0}
                      total={analytics.totalRecords || 1}
                    />
                  ))}
                </div>
              </section>
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-lg border border-border-default bg-surface-card p-4">
                  <h3 className="mb-3 text-sm font-semibold">Location Rollup</h3>
                  <div className="space-y-2">
                    {analytics.byLocation.slice(0, 12).map((row) => (
                      <Bar
                        key={row.location}
                        label={`${row.location} (${row.count})`}
                        value={row.averageProgress}
                        total={100}
                        suffix="%"
                      />
                    ))}
                  </div>
                </section>
                <section className="rounded-lg border border-border-default bg-surface-card p-4">
                  <h3 className="mb-3 text-sm font-semibold">Parent Level Sums</h3>
                  <div className="max-h-80 overflow-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="sticky top-0 bg-surface-ground text-xs uppercase text-text-muted">
                        <tr>
                          <th className="px-2 py-2">Level</th>
                          <th className="px-2 py-2">Location</th>
                          <th className="px-2 py-2">Rows</th>
                          <th className="px-2 py-2">Avg %</th>
                          {numericFields.slice(0, 4).map((field) => (
                            <th key={field.key} className="px-2 py-2">
                              {field.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(analytics.parentLocationRollup || []).slice(0, 40).map((row) => (
                          <tr key={row.location} className="border-t border-border-subtle">
                            <td className="px-2 py-2">{row.level}</td>
                            <td className="px-2 py-2">{row.location}</td>
                            <td className="px-2 py-2">{row.count}</td>
                            <td className="px-2 py-2">{percent(row.averageProgress)}</td>
                            {numericFields.slice(0, 4).map((field) => (
                              <td key={field.key} className="px-2 py-2">
                                {Number(row.sums?.[field.key] || 0).toFixed(2)}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {!(analytics.parentLocationRollup || []).length && (
                          <tr>
                            <td
                              className="px-2 py-6 text-center text-text-muted"
                              colSpan={4 + numericFields.slice(0, 4).length}
                            >
                              Select locations with tree paths to generate parent
                              summaries.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section className="rounded-lg border border-border-default bg-surface-card p-4">
                  <h3 className="mb-3 text-sm font-semibold">KPI Field Summary</h3>
                  <div className="grid gap-2">
                    {Object.entries(analytics.fieldSummary).map(([key, summary]) => (
                      <div
                        key={key}
                        className="rounded-lg border border-border-default px-3 py-2 text-sm"
                      >
                        <div className="font-semibold">{summary.label}</div>
                        <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-text-muted">
                          <span>Sum: {summary.sum.toFixed(2)}</span>
                          <span>Avg: {summary.average.toFixed(2)}</span>
                          <span>Max: {summary.max.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                    {!Object.keys(analytics.fieldSummary).length && (
                      <div className="text-sm text-text-muted">
                        Mark number, percent, or currency fields as KPI in Setup.
                      </div>
                    )}
                  </div>
                </section>
              </div>
              {Object.entries(analytics.byCategory).map(([categoryKey, rows]) => (
                <section
                  key={categoryKey}
                  className="rounded-lg border border-border-default bg-surface-card p-4"
                >
                  <h3 className="mb-3 text-sm font-semibold">
                    {labelize(categoryKey)} Analysis
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(rows).map(([label, value]) => (
                      <Bar
                        key={label}
                        label={label}
                        value={value}
                        total={analytics.totalRecords || 1}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {tab === "reporting" && selected && (
            <div className="space-y-4">
              <section className="rounded-lg border border-border-default bg-surface-card p-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <label className="min-w-[280px] flex-1 text-xs font-semibold text-text-muted">
                    Report Title
                    <input
                      value={viewConfig.reportTitle}
                      onChange={(event) =>
                        setViewConfig((prev) => ({
                          ...prev,
                          reportTitle: event.target.value,
                        }))
                      }
                      className="mt-1 h-10 w-full rounded-lg border border-border-default px-3 text-sm text-text-primary"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveViewConfig}
                      className="inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-sm font-semibold"
                    >
                      <Save size={15} />
                      Save Report Setup
                    </button>
                    <button
                      type="button"
                      onClick={exportReportCsv}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
                    >
                      <Download size={15} />
                      Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-2 text-sm font-semibold"
                    >
                      Print
                    </button>
                  </div>
                </div>
              </section>
              <section className="rounded-lg border border-border-default bg-surface-card p-5">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-text-primary">
                    {viewConfig.reportTitle || selected.name}
                  </h2>
                  <p className="text-xs text-text-muted">
                    {filteredRecords.length} filtered records from {records.length} total.
                    Active slicers:{" "}
                    {Object.entries(viewConfig.slicers)
                      .filter(([, value]) => value)
                      .map(([key, value]) => `${labelize(key)}=${value}`)
                      .join(", ") || "None"}
                  </p>
                </div>
                <PivotTable
                  rows={visiblePivotRows}
                  valueFields={valueFields}
                  expanded={expandedPivotRows}
                  onToggle={togglePivotRow}
                />
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function TreePreview({
  levels,
  fields,
}: {
  levels: string[];
  fields: CustomTrackerField[];
}) {
  if (!levels.length) {
    return <div className="text-sm text-text-muted">No location levels configured.</div>;
  }
  const renderLevel = (index: number): ReactNode => {
    const level = levels[index];
    const isLast = index === levels.length - 1;
    return (
      <div className="ml-3 border-l border-border-subtle pl-3">
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm font-semibold">
          {isLast ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {labelize(level)}
        </div>
        {isLast ? (
          <div className="ml-5 grid gap-2">
            {fields.map((field) => (
              <div
                key={field.key}
                className="rounded-md border border-border-default bg-white px-3 py-2 text-sm"
              >
                <span className="font-semibold">{field.label}</span>
                <span className="ml-2 text-xs text-text-muted">
                  {labelize(field.fieldType)}
                  {field.formula ? ` = ${field.formula}` : ""}
                </span>
              </div>
            ))}
          </div>
        ) : (
          renderLevel(index + 1)
        )}
      </div>
    );
  };
  return <div>{renderLevel(0)}</div>;
}

function PivotTable({
  rows,
  valueFields,
  expanded,
  onToggle,
}: {
  rows: PivotRow[];
  valueFields: CustomTrackerField[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border-default bg-surface-card">
      <div className="border-b border-border-subtle px-4 py-3">
        <h3 className="text-sm font-semibold">Pivot Table</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-surface-ground text-xs uppercase text-text-muted">
            <tr>
              <th className="px-3 py-2">Group</th>
              <th className="px-3 py-2">Rows</th>
              <th className="px-3 py-2">Avg Progress</th>
              {valueFields.map((field) => (
                <th key={field.key} className="px-3 py-2">
                  Sum {field.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-border-subtle">
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => row.children.length && onToggle(row.key)}
                    className="inline-flex items-center gap-2"
                    style={{ paddingLeft: row.level * 18 }}
                  >
                    {row.children.length ? (
                      expanded.has(row.key) ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronRight size={14} />
                      )
                    ) : (
                      <span className="w-3" />
                    )}
                    <span className="font-medium">{row.label}</span>
                  </button>
                </td>
                <td className="px-3 py-2">{row.count}</td>
                <td className="px-3 py-2">{percent(row.averageProgress)}</td>
                {valueFields.map((field) => (
                  <td key={field.key} className="px-3 py-2">
                    {Number(row.sums[field.key] || 0).toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td
                  className="px-3 py-8 text-center text-text-muted"
                  colSpan={3 + valueFields.length}
                >
                  No rows match the current slicers.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string | number; value: string | number }) {
  return (
    <div className="rounded-lg border border-border-default bg-surface-card p-4">
      <div className="text-xs font-semibold uppercase text-text-muted">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-text-primary">{value}</div>
    </div>
  );
}

function Bar({
  label,
  value,
  total,
  suffix = "",
}: {
  label: string;
  value: number;
  total: number;
  suffix?: string;
}) {
  const width = total > 0 ? Math.min(100, (Number(value || 0) / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between gap-3 text-xs text-text-muted">
        <span className="truncate">{label}</span>
        <span>
          {suffix ? Number(value || 0).toFixed(0) : value}
          {suffix}
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-ground">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
