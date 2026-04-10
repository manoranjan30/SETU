import React, { useState, useMemo } from "react";
import type { BoqItem } from "../../services/boq.service"; // Adjust path
import {
  Download,
  Upload,
  Plus,
  Calculator,
  ArrowLeft,
  Trash2,
  Save,
  Layout,
  ChevronDown,
} from "lucide-react";
import { boqService } from "../../services/boq.service";
import {
  tableViewService,
  type TableViewConfig,
} from "../../services/table-view.service";
import { ImportWizard } from "../../components/ImportWizard";
import { formatIndianNumber } from "../../utils/format";

interface MeasurementManagerProps {
  projectId: number;
  boqItem: BoqItem; // Parent Context
  subItem?: any; // Target SubItem (Optional if we support direct item measures later, but for now mandatory for layer 2)
  onClose: () => void;
  onUpdate: () => void; // Trigger refresh of parent list
  epsNodes?: any[];
}

interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  width: number; // Changed to number for resizing
  align?: "left" | "center" | "right";
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: "select", label: "", visible: true, width: 40 },
  { id: "elementRef", label: "ID", visible: true, width: 80 }, // Shortened label
  { id: "description", label: "Description", visible: true, width: 250 }, // Added Description
  { id: "elementName", label: "Measurement Name", visible: false, width: 150 }, // Hide Name by default if desc is main
  { id: "category", label: "Category", visible: true, width: 100 },
  { id: "grid", label: "Grid", visible: true, width: 80 },
  { id: "location", label: "Location (EPS)", visible: true, width: 250 }, // Increased width
  { id: "l", label: "L", visible: true, align: "right", width: 60 },
  { id: "b", label: "B", visible: true, align: "right", width: 60 },
  { id: "d", label: "D", visible: true, align: "right", width: 60 },
  { id: "levels", label: "Levels", visible: true, align: "right", width: 100 },
  { id: "qty", label: "Qty", visible: true, align: "right", width: 90 }, // Slightly wider
  { id: "executed", label: "Exec", visible: true, align: "right", width: 90 },
  { id: "bal", label: "Bal", visible: true, align: "right", width: 90 },
  { id: "uom", label: "UOM", visible: true, align: "center", width: 60 },
  // Hidden by default details
  {
    id: "bottomLevel",
    label: "Bot Lvl",
    visible: false,
    align: "right",
    width: 80,
  },
  {
    id: "topLevel",
    label: "Top Lvl",
    visible: false,
    align: "right",
    width: 80,
  },
  { id: "height", label: "Height", visible: false, align: "right", width: 60 },
  {
    id: "perimeter",
    label: "Perim.",
    visible: false,
    align: "right",
    width: 80,
  },
  { id: "baseArea", label: "Area", visible: false, align: "right", width: 80 },
  { id: "baseCoordinates", label: "Coords", visible: false, width: 150 },
  { id: "plineAllLengths", label: "P-Lines", visible: false, width: 150 },
  { id: "elementType", label: "Type", visible: false, width: 100 },
  { id: "linkingElement", label: "Link Ref", visible: false, width: 100 },
  { id: "importedOn", label: "Import Date", visible: false, width: 120 },
  { id: "customAttributes", label: "Attrs", visible: false, width: 150 },
];

export const MeasurementManager: React.FC<MeasurementManagerProps> = ({
  projectId,
  boqItem,
  subItem,
  onClose,
  onUpdate,
  epsNodes,
}) => {
  // Measurements come from subItem now
  const measurements = subItem?.measurements || [];
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // --- Table View State ---
  const [views, setViews] = useState<TableViewConfig[]>([]);
  const [currentViewName, setCurrentViewName] = useState("Default");
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [showSaveView, setShowSaveView] = useState(false);

  React.useEffect(() => {
    loadViews();
  }, []);

  const loadViews = async () => {
    try {
      const saved = await tableViewService.getViews("MEASUREMENT_TABLE");
      setViews(saved);
    } catch (e) {
      console.error("Failed to load views", e);
    }
  };

  const handleColumnToggle = (id: string) => {
    setColumns((cols) =>
      cols.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)),
    );
  };

  const handleSaveView = async () => {
    if (!newViewName) return;
    try {
      const config = { columns }; // Save current state
      await tableViewService.saveView("MEASUREMENT_TABLE", newViewName, config);
      alert("View saved!");
      setNewViewName("");
      setShowSaveView(false);
      loadViews();
      setCurrentViewName(newViewName);
    } catch (e) {
      alert("Failed to save view");
    }
  };

  // --- Resize Logic ---
  // Using Ref for performance instead of State for drag operations
  const resizingRef = React.useRef<{
    id: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  const onMouseDown = (e: React.MouseEvent, colId: string, width: number) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { id: colId, startX: e.clientX, startWidth: width };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!resizingRef.current) return;
    const { id, startX, startWidth } = resizingRef.current;
    const diff = e.clientX - startX;
    setColumns((cols) =>
      cols.map((c) =>
        c.id === id ? { ...c, width: Math.max(40, startWidth + diff) } : c,
      ),
    );
  };

  const onMouseUp = () => {
    resizingRef.current = null;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "default";
  };

  // --- Drag & Drop Reordering ---
  const [draggedColId, setDraggedColId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedColId(id);
    e.dataTransfer.effectAllowed = "move";
    // e.dataTransfer.setDragImage(new Image(), 0, 0); // Optional: Hide ghost if custom
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedColId || draggedColId === targetId) return;

    // Perform reorder only if distinct
    setColumns((prev) => {
      const fromIndex = prev.findIndex((c) => c.id === draggedColId);
      const toIndex = prev.findIndex((c) => c.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;

      const newCols = [...prev];
      const [moved] = newCols.splice(fromIndex, 1);
      newCols.splice(toIndex, 0, moved);
      return newCols;
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedColId(null);
  };

  const handleApplyView = (view: TableViewConfig) => {
    // Ensure width is numeric (migration safety if old views exist)
    const safeCols = view.config.columns.map((c: any) => ({
      ...c,
      width: typeof c.width === "number" ? c.width : 100,
    }));
    setColumns(safeCols as ColumnConfig[]);
    setCurrentViewName(view.viewName);
    setIsViewMenuOpen(false);
  };

  const handleResetView = () => {
    setColumns(DEFAULT_COLUMNS);
    setCurrentViewName("Default");
  };

  // Memoize EPS Node Map for lookup
  const epsNodeMap = useMemo(() => {
    const map = new Map();
    if (epsNodes) {
      epsNodes.forEach((n: any) => map.set(n.id, n));
    }
    return map;
  }, [epsNodes]);

  const resolveEpsPath = (nodeId: number | string) => {
    if (!nodeId) return "-";
    let current = epsNodeMap.get(Number(nodeId));
    if (!current) return "Unknown Node (" + nodeId + ")"; // Better debugging info

    const path = [current.name];
    let parentId = current.parentId;
    let visited = new Set([current.id]);

    while (parentId && !visited.has(parentId)) {
      const parent = epsNodeMap.get(parentId);
      if (parent) {
        path.unshift(parent.name);
        visited.add(parent.id);
        parentId = parent.parentId;
      } else {
        break;
      }
    }
    return path.join(" > ");
  };

  // New Manual Entry State - EXPANDED Fields
  const [newM, setNewM] = useState<{
    epsNodeId: string;
    elementName: string;
    elementCategory: string;
    elementType: string;
    linkingElement: string;
    grid: string;
    uom: string;
    bottomLevel: string;
    topLevel: string;
    length: number;
    breadth: number;
    depth: number;
    height: number;
    perimeter: number;
    baseArea: number;
    baseCoordinates: string;
    plineAllLengths: string;
    qty: number;
  }>({
    epsNodeId: "",
    elementName: "",
    elementCategory: "",
    elementType: "",
    linkingElement: "",
    grid: "",
    uom: "",
    bottomLevel: "",
    topLevel: "",
    length: 0,
    breadth: 0,
    depth: 0,
    height: 0,
    perimeter: 0,
    baseArea: 0,
    baseCoordinates: "",
    plineAllLengths: "",
    qty: 0,
  });

  const handleCalculate = () => {
    // Simple L x B x D logic
    const l = newM.length || 0;
    const b = newM.breadth || 0;
    const d = newM.depth || 0;

    // If dimensions are provided, calculate. If not, maybe qty is manual.
    let qty = newM.qty;
    if (l || b || d) {
      qty = (l || 1) * (b || 1) * (d || 1);
    }
    setNewM({ ...newM, qty: Number(qty.toFixed(3)) });
  };

  const handleAddManual = async () => {
    if (!newM.epsNodeId || !newM.elementName) {
      alert("Please provide Location ID (EPS) and Element Name");
      return;
    }

    try {
      await boqService.addMeasurement({
        projectId,
        boqItemId: boqItem.id, // Required Check
        boqSubItemId: subItem?.id, // Target Sub Item
        epsNodeId: Number(newM.epsNodeId),
        elementName: newM.elementName,
        elementCategory: newM.elementCategory,
        elementType: newM.elementType, // New
        linkingElement: newM.linkingElement, // New
        grid: newM.grid,
        uom: newM.uom,
        bottomLevel: newM.bottomLevel ? Number(newM.bottomLevel) : undefined,
        topLevel: newM.topLevel ? Number(newM.topLevel) : undefined,
        length: newM.length,
        breadth: newM.breadth,
        depth: newM.depth,
        height: newM.height, // New
        perimeter: newM.perimeter, // New
        baseArea: newM.baseArea, // New
        baseCoordinates: newM.baseCoordinates
          ? JSON.parse(newM.baseCoordinates)
          : undefined, // Parse text to JSON
        plineAllLengths: newM.plineAllLengths
          ? JSON.parse(newM.plineAllLengths)
          : undefined,
        qty: newM.qty,
      });
      alert("Measurement added!");
      setNewM({
        epsNodeId: "",
        elementName: "",
        elementCategory: "",
        elementType: "",
        linkingElement: "",
        grid: "",
        uom: "",
        bottomLevel: "",
        topLevel: "",
        length: 0,
        breadth: 0,
        depth: 0,
        height: 0,
        perimeter: 0,
        baseArea: 0,
        baseCoordinates: "",
        plineAllLengths: "",
        qty: 0,
      });
      onUpdate(); // Ideally we should re-fetch to see it, or add to local list if we return it
    } catch (error) {
      console.error(error);
      alert("Failed to add measurement");
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await boqService.getMeasurementTemplate(projectId, boqItem.id, subItem?.id);
    } catch (error) {
      alert("Failed to download template");
    }
  };

  // --- Bulk Delete Logic ---
  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set<number>(
        measurements.map((m: any) => Number(m.id)),
      );
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set<number>());
    }
  };

  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (
      !confirm(
        `Are you sure you want to delete ${selectedIds.size} measurements? This action cannot be undone.`,
      )
    )
      return;

    try {
      await boqService.deleteMeasurements(Array.from(selectedIds));
      setSelectedIds(new Set());
      onUpdate();
    } catch (error) {
      console.error(error);
      alert("Failed to delete measurements");
    }
  };

  return (
    <div className="fixed inset-0 bg-surface-base/80 backdrop-blur-sm flex items-center justify-center z-50 overflow-hidden">
      {/* Full Screen Layout Container */}
      <div className="bg-surface-card w-full h-full md:m-4 md:w-[98%] md:h-[95%] md:rounded-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border-default flex justify-between items-center bg-surface-base rounded-t-lg">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-info-muted text-info px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
                Measurement Sheet
              </span>
              <h2 className="text-xl font-bold text-text-primary">
                {boqItem.boqCode} -{" "}
                {subItem?.description || boqItem.description}
              </h2>
            </div>
            <p className="text-sm text-text-muted mt-1">
              Manage detailed measurements and manual entries
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onUpdate}
              className="text-primary hover:text-primary-dark text-sm font-medium px-3"
            >
              Refresh
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-raised rounded-full text-text-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden gap-4">
          {/* Top Bar: Actions & Summary */}
          {/* Top Bar: Actions & Summary */}
          <div className="flex justify-between items-center">
            <div className="flex gap-2 items-center">
              {/* View Manager */}
              <div className="relative">
                <button
                  onClick={() => setIsViewMenuOpen(!isViewMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-surface-card border border-border-strong rounded text-text-secondary hover:bg-surface-base text-sm"
                  title="Table Settings"
                >
                  <Layout className="w-4 h-4 text-primary" />
                  <span className="font-medium text-text-primary">
                    {currentViewName}
                  </span>
                  <ChevronDown className="w-3 h-3 text-text-disabled" />
                </button>

                {isViewMenuOpen && (
                  <div className="absolute top-10 left-0 w-64 bg-surface-card shadow-xl rounded-lg border border-border-default z-50 p-3 max-h-[80vh] overflow-y-auto">
                    <h4 className="text-xs font-bold text-text-muted uppercase mb-2">
                      Saved Views
                    </h4>
                    <div className="space-y-1 mb-3">
                      <button
                        onClick={handleResetView}
                        className={`w-full text-left px-2 py-1 rounded text-sm ${currentViewName === "Default" ? "bg-primary-muted text-blue-700 font-bold" : "hover:bg-surface-base"}`}
                      >
                        Default
                      </button>
                      {views.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => handleApplyView(v)}
                          className={`w-full text-left px-2 py-1 rounded text-sm flex justify-between ${currentViewName === v.viewName ? "bg-primary-muted text-blue-700 font-bold" : "hover:bg-surface-base"}`}
                        >
                          {v.viewName}
                          <span
                            className="text-xs text-text-disabled"
                            onClick={(e) => {
                              e.stopPropagation();
                              tableViewService.deleteView(v.id).then(loadViews);
                            }}
                          >
                            ×
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="border-t border-border-subtle my-2"></div>
                    <h4 className="text-xs font-bold text-text-muted uppercase mb-2 flex justify-between items-center">
                      Columns
                      {showSaveView ? (
                        <div className="flex gap-1">
                          <input
                            className="w-20 border rounded px-1 text-xs"
                            placeholder="Name"
                            value={newViewName}
                            onChange={(e) => setNewViewName(e.target.value)}
                          />
                          <button
                            onClick={handleSaveView}
                            className="text-success"
                          >
                            <Save className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowSaveView(true)}
                          className="text-primary text-[10px] hover:underline"
                        >
                          + Save View
                        </button>
                      )}
                    </h4>
                    <div className="space-y-1">
                      {columns
                        .filter((c) => c.id !== "select")
                        .map((col) => (
                          <label
                            key={col.id}
                            className="flex items-center gap-2 text-sm text-text-secondary hover:bg-surface-base px-1 py-0.5 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={col.visible}
                              onChange={() => handleColumnToggle(col.id)}
                              className="rounded text-primary focus:ring-primary"
                            />
                            <span
                              className={
                                col.visible ? "" : "text-text-disabled"
                              }
                            >
                              {col.label}
                            </span>
                          </label>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="w-px h-6 bg-border-strong mx-1"></div>

              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 px-3 py-1.5 bg-surface-card border border-border-strong rounded text-text-secondary hover:bg-surface-base text-sm"
              >
                <Download className="w-4 h-4" /> Template
              </button>
              <button
                onClick={() => setShowImportWizard(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-success text-white rounded hover:opacity-90 text-sm"
              >
                <Upload className="w-4 h-4" /> Import Excel
              </button>
              {selectedIds.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-2 px-3 py-1.5 bg-error text-white rounded hover:opacity-90 text-sm animate-in fade-in"
                >
                  <Trash2 className="w-4 h-4" /> Delete ({selectedIds.size})
                </button>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm text-text-muted">Total Quantity</div>
              <div className="text-2xl font-bold text-primary tabular-nums">
                {formatIndianNumber(subItem?.qty)}{" "}
                <span className="text-sm text-text-disabled font-normal">
                  {subItem?.uom}
                </span>
              </div>
            </div>
          </div>

          {showImportWizard && (
            <ImportWizard
              projectId={projectId}
              mode="MEASUREMENT"
              boqItemId={boqItem.id}
              boqSubItemId={subItem?.id} // New Prop
              onClose={() => setShowImportWizard(false)}
              onSuccess={() => {
                onUpdate();
              }}
              epsNodes={epsNodes}
            />
          )}

          {/* Manual Entry Form - Expanded to Horizontal Strip or Grid */}
          <div className="bg-surface-base p-4 rounded-lg border border-border-default">
            <h3 className="font-semibold text-sm text-text-primary mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Manual Entry
            </h3>

            <div className="grid grid-cols-12 gap-2 items-end">
              {/* Row 1: Identification & Metadata */}
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-text-muted uppercase">
                  EPS Location
                </label>
                <select
                  className="w-full p-2 border border-border-strong rounded text-sm focus:ring-1 focus:ring-primary"
                  value={newM.epsNodeId}
                  onChange={(e) =>
                    setNewM({ ...newM, epsNodeId: e.target.value })
                  }
                >
                  <option value="">-- Select --</option>
                  {epsNodes?.map((node: any) => (
                    <option key={node.id} value={node.id}>
                      {resolveEpsPath(node.id)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-text-muted uppercase">
                  Element Name
                </label>
                <input
                  type="text"
                  className="w-full p-2 border border-border-strong rounded text-sm focus:ring-1 focus:ring-primary"
                  placeholder="e.g. Wall A1"
                  value={newM.elementName}
                  onChange={(e) =>
                    setNewM({ ...newM, elementName: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-text-muted uppercase">
                  Category
                </label>
                <input
                  type="text"
                  className="w-full p-2 border border-border-strong rounded text-sm"
                  placeholder="e.g. Wall"
                  value={newM.elementCategory}
                  onChange={(e) =>
                    setNewM({ ...newM, elementCategory: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-text-muted uppercase">
                  Type
                </label>
                <input
                  type="text"
                  className="w-full p-2 border border-border-strong rounded text-sm"
                  placeholder="e.g. Concrete"
                  value={newM.elementType}
                  onChange={(e) =>
                    setNewM({ ...newM, elementType: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-text-muted uppercase">
                  Link Ref
                </label>
                <input
                  type="text"
                  className="w-full p-2 border border-border-strong rounded text-sm"
                  placeholder="ID-123"
                  value={newM.linkingElement}
                  onChange={(e) =>
                    setNewM({ ...newM, linkingElement: e.target.value })
                  }
                />
              </div>
              <div className="col-span-1">
                <label className="text-[10px] font-bold text-text-muted uppercase">
                  Grid
                </label>
                <input
                  type="text"
                  className="w-full p-2 border border-border-strong rounded text-sm"
                  placeholder="A-1"
                  value={newM.grid}
                  onChange={(e) => setNewM({ ...newM, grid: e.target.value })}
                />
              </div>
              <div className="col-span-1">
                <label className="text-[10px] font-bold text-text-muted uppercase">
                  UOM
                </label>
                <input
                  type="text"
                  className="w-full p-2 border border-border-strong rounded text-sm"
                  placeholder="m3"
                  value={newM.uom}
                  onChange={(e) => setNewM({ ...newM, uom: e.target.value })}
                />
              </div>

              {/* Row 2: Dimensions & Technical */}
              <div className="col-span-1">
                <label className="text-[10px] font-bold text-text-muted uppercase">
                  Length
                </label>
                <input
                  type="number"
                  className="w-full p-2 border border-border-strong rounded text-sm"
                  value={newM.length}
                  onChange={(e) =>
                    setNewM({ ...newM, length: Number(e.target.value) })
                  }
                />
              </div>
              <div className="col-span-1">
                <label className="text-[10px] font-bold text-text-muted uppercase">
                  Breadth
                </label>
                <input
                  type="number"
                  className="w-full p-2 border border-border-strong rounded text-sm"
                  value={newM.breadth}
                  onChange={(e) =>
                    setNewM({ ...newM, breadth: Number(e.target.value) })
                  }
                />
              </div>
              <div className="col-span-1">
                <label className="text-[10px] font-bold text-text-muted uppercase">
                  Depth
                </label>
                <input
                  type="number"
                  className="w-full p-2 border border-border-strong rounded text-sm"
                  value={newM.depth}
                  onChange={(e) =>
                    setNewM({ ...newM, depth: Number(e.target.value) })
                  }
                />
              </div>
              <div className="col-span-1">
                <label className="text-[10px] font-bold text-text-muted uppercase">
                  Height
                </label>
                <input
                  type="number"
                  className="w-full p-2 border border-border-strong rounded text-sm"
                  value={newM.height}
                  onChange={(e) =>
                    setNewM({ ...newM, height: Number(e.target.value) })
                  }
                />
              </div>
              <div className="col-span-1">
                <label className="text-[10px] font-bold text-text-muted uppercase">
                  Bot Lvl
                </label>
                <input
                  type="number"
                  className="w-full p-2 border border-border-strong rounded text-sm"
                  placeholder="0.00"
                  value={newM.bottomLevel}
                  onChange={(e) =>
                    setNewM({ ...newM, bottomLevel: e.target.value })
                  }
                />
              </div>
              <div className="col-span-1">
                <label className="text-[10px] font-bold text-text-muted uppercase">
                  Top Lvl
                </label>
                <input
                  type="number"
                  className="w-full p-2 border border-border-strong rounded text-sm"
                  placeholder="3.00"
                  value={newM.topLevel}
                  onChange={(e) =>
                    setNewM({ ...newM, topLevel: e.target.value })
                  }
                />
              </div>
              <div className="col-span-1">
                <label className="text-[10px] font-bold text-text-muted uppercase">
                  Perim.
                </label>
                <input
                  type="number"
                  className="w-full p-2 border border-border-strong rounded text-sm"
                  value={newM.perimeter}
                  onChange={(e) =>
                    setNewM({ ...newM, perimeter: Number(e.target.value) })
                  }
                />
              </div>
              <div className="col-span-1">
                <label className="text-[10px] font-bold text-text-muted uppercase">
                  Base Area
                </label>
                <input
                  type="number"
                  className="w-full p-2 border border-border-strong rounded text-sm"
                  value={newM.baseArea}
                  onChange={(e) =>
                    setNewM({ ...newM, baseArea: Number(e.target.value) })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-text-muted uppercase">
                  Base Coords (JSON)
                </label>
                <input
                  type="text"
                  className="w-full p-2 border border-border-strong rounded text-xs tabular-nums"
                  placeholder="[[0,0],[10,0]...]"
                  value={newM.baseCoordinates}
                  onChange={(e) =>
                    setNewM({ ...newM, baseCoordinates: e.target.value })
                  }
                />
              </div>

              <div className="col-span-2 col-end-13">
                <label className="text-[10px] font-bold text-text-muted uppercase text-primary">
                  Total Qty
                </label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    className="w-full p-2 border-2 border-blue-200 rounded text-sm font-bold text-blue-700 bg-surface-card"
                    value={newM.qty}
                    onChange={(e) =>
                      setNewM({ ...newM, qty: Number(e.target.value) })
                    }
                  />
                  <button
                    onClick={handleCalculate}
                    className="px-2 py-1 bg-surface-raised rounded hover:bg-surface-base text-text-secondary"
                    title="Calculate L*B*D"
                  >
                    <Calculator className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleAddManual}
                    className="px-4 py-1 bg-primary text-white rounded font-medium hover:bg-primary-dark ml-1"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Table View */}
          <div className="flex-1 bg-surface-card border border-border-default rounded-lg flex flex-col overflow-hidden">
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-sm whitespace-nowrap table-fixed [font-variant-numeric:tabular-nums]">
                {/* Colgroup for Consistent Widths */}
                <colgroup>
                  {columns
                    .filter((c) => c.visible)
                    .map((col) => (
                      <col key={col.id} style={{ width: col.width }} />
                    ))}
                </colgroup>
                <thead className="bg-surface-raised text-text-secondary font-semibold sticky top-0 z-10 border-b border-border-default">
                  <tr>
                    {columns
                      .filter((c) => c.visible)
                      .map((col) => (
                        <th
                          key={col.id}
                          className={`p-3 border-b relative group ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"} ${draggedColId === col.id ? "bg-info-muted opacity-50" : ""}`}
                          draggable={col.id !== "select"}
                          onDragStart={(e) => handleDragStart(e, col.id)}
                          onDragOver={(e) => handleDragOver(e, col.id)}
                          onDrop={handleDrop}
                          data-column-id={col.id} // Added for drop target identification
                          style={{
                            cursor: col.id === "select" ? "default" : "grab",
                          }}
                        >
                          {col.id === "select" ? (
                            <input
                              type="checkbox"
                              onChange={toggleSelectAll}
                              checked={
                                measurements.length > 0 &&
                                selectedIds.size === measurements.length
                              }
                              className="rounded border-border-strong text-primary focus:ring-primary"
                            />
                          ) : (
                            <span
                              className="truncate block select-none"
                              title={col.label}
                            >
                              {col.label}
                            </span>
                          )}

                          {/* Resizer Handle */}
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 group-hover:bg-gray-300 z-20"
                            onMouseDown={(e) =>
                              onMouseDown(e, col.id, col.width)
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                        </th>
                      ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {measurements.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columns.filter((c) => c.visible).length}
                        className="p-12 text-center text-text-disabled"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Calculator className="w-8 h-8 opacity-20" />
                          <p>No measurements recorded yet.</p>
                          <p className="text-xs">
                            Use the form above or Import Excel to add
                            quantities.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    measurements.map((m: any) => (
                      <tr
                        key={m.id}
                        className="hover:bg-primary-muted/30 transition-colors"
                      >
                        {columns
                          .filter((c) => c.visible)
                          .map((col) => {
                            // Map column ID to value/render
                            // const cellStyle = { width: col.width, minWidth: col.width, maxWidth: col.width }; // Handled by colgroup now
                            switch (col.id) {
                              case "select":
                                return (
                                  <td key="select" className="p-3 border-b">
                                    <input
                                      type="checkbox"
                                      checked={selectedIds.has(m.id)}
                                      onChange={() => toggleSelect(m.id)}
                                      className="rounded border-border-strong text-primary focus:ring-primary"
                                    />
                                  </td>
                                );
                              case "elementRef":
                                return (
                                  <td
                                    key={col.id}
                                    className="p-3 border-b text-text-disabled font-mono text-xs truncate"
                                  >
                                    {m.elementId?.substring(0, 8) || "-"}
                                  </td>
                                );
                              case "description":
                                return (
                                  <td
                                    key={col.id}
                                    className="p-3 border-b font-medium text-gray-800 truncate"
                                    title={m.elementName}
                                  >
                                    {m.elementName}
                                  </td>
                                );
                              case "elementName":
                                return (
                                  <td
                                    key={col.id}
                                    className="p-3 border-b text-text-secondary truncate"
                                    title={m.elementName}
                                  >
                                    {m.elementName}
                                  </td>
                                );
                              case "category":
                                return (
                                  <td
                                    key={col.id}
                                    className="p-3 border-b text-xs text-text-muted truncate"
                                  >
                                    {m.elementCategory || "-"}
                                  </td>
                                );
                              case "grid":
                                return (
                                  <td
                                    key={col.id}
                                    className="p-3 border-b text-xs text-text-muted font-mono truncate"
                                  >
                                    {m.grid || "-"}
                                  </td>
                                );
                              case "location":
                                return (
                                  <td
                                    key={col.id}
                                    className="p-3 border-b text-blue-900 font-medium text-xs truncate"
                                    title={resolveEpsPath(m.epsNodeId)}
                                  >
                                    {resolveEpsPath(m.epsNodeId)}
                                  </td>
                                );
                              case "l":
                                return (
                                  <td
                                    key={col.id}
                                    className="p-3 border-b text-right text-text-secondary font-mono bg-surface-base/30"
                                  >
                                    {m.length}
                                  </td>
                                );
                              case "b":
                                return (
                                  <td
                                    key={col.id}
                                    className="p-3 border-b text-right text-text-secondary font-mono bg-surface-base/30"
                                  >
                                    {m.breadth}
                                  </td>
                                );
                              case "d":
                                return (
                                  <td
                                    key={col.id}
                                    className="p-3 border-b text-right text-text-secondary font-mono bg-surface-base/30"
                                  >
                                    {m.depth}
                                  </td>
                                );
                              case "levels":
                                return (
                                  <td
                                    key={col.id}
                                    className="p-3 border-b text-right text-xs text-text-disabled font-mono"
                                  >
                                    {m.bottomLevel || m.topLevel
                                      ? `${m.bottomLevel} / ${m.topLevel}`
                                      : "-"}
                                  </td>
                                );
                              case "qty":
                                return (
                                  <td
                                    key={col.id}
                                    className="p-3 border-b text-right font-bold text-blue-700 bg-primary-muted/10 font-mono"
                                  >
                                    {formatIndianNumber(m.qty, 3)}
                                  </td>
                                );
                              case "executed":
                                return (
                                  <td
                                    key={col.id}
                                    className="p-3 border-b text-right text-xs text-green-700"
                                  >
                                    {formatIndianNumber(m.executedQty, 3)}
                                  </td>
                                );
                              case "bal":
                                return (
                                  <td
                                    key={col.id}
                                    className="p-3 border-b text-right text-xs text-text-disabled"
                                  >
                                    {formatIndianNumber(
                                      m.qty - (m.executedQty || 0),
                                      3,
                                    )}
                                  </td>
                                );
                              case "uom":
                                return (
                                  <td
                                    key={col.id}
                                    className="p-3 border-b text-center text-xs text-text-muted"
                                  >
                                    {m.uom || ""}
                                  </td>
                                );

                              // Hidden By Default
                              case "bottomLevel":
                                return (
                                  <td
                                    key={col.id}
                                    className="p-3 border-b text-right text-xs text-text-disabled font-mono"
                                  >
                                    {m.bottomLevel || "-"}
                                  </td>
                                );
                              case "topLevel":
                                return (
                                  <td
                                    key={col.id}
                                    className="p-3 border-b text-right text-xs text-text-disabled font-mono"
                                  >
                                    {m.topLevel || "-"}
                                  </td>
                                );
                              case "height":
                                return (
                                  <td
                                    key={col.id}
                                    className="p-3 border-b text-right text-text-secondary font-mono bg-surface-base/30"
                                  >
                                    {m.height}
                                  </td>
                                );
                              case "perimeter":
                                return (
                                  <td
                                    key={col.id}
                                    className="p-3 border-b text-right text-xs text-text-muted font-mono"
                                  >
                                    {formatIndianNumber(m.perimeter, 3)}
                                  </td>
                                );
                              case "baseArea":
                                return (
                                  <td
                                    key={col.id}
                                    className="p-3 border-b text-right text-xs text-text-muted font-mono"
                                  >
                                    {formatIndianNumber(m.baseArea, 3)}
                                  </td>
                                );
                              case "baseCoordinates":
                                return (
                                  <td
                                    key={col.id}
                                    className="p-3 border-b text-xs text-text-disabled truncate"
                                    title={JSON.stringify(m.baseCoordinates)}
                                  >
                                    {m.baseCoordinates ? "Present" : "-"}
                                  </td>
                                );
                              case "plineAllLengths":
                                return (
                                  <td
                                    key={col.id}
                                    className="p-3 border-b text-xs text-text-disabled truncate"
                                    title={JSON.stringify(m.plineAllLengths)}
                                  >
                                    {m.plineAllLengths ? "Present" : "-"}
                                  </td>
                                );
                              case "elementType":
                                return (
                                  <td
                                    key={col.id}
                                    className="p-3 border-b text-xs text-text-muted truncate"
                                  >
                                    {m.elementType || "-"}
                                  </td>
                                );
                              case "linkingElement":
                                return (
                                  <td
                                    key={col.id}
                                    className="p-3 border-b text-xs text-text-muted truncate"
                                  >
                                    {m.linkingElement || "-"}
                                  </td>
                                );
                              case "importedOn":
                                return (
                                  <td
                                    key={col.id}
                                    className="p-3 border-b text-xs text-text-disabled"
                                  >
                                    {m.importedOn
                                      ? new Date(
                                          m.importedOn,
                                        ).toLocaleDateString()
                                      : "-"}
                                  </td>
                                );
                              case "customAttributes":
                                return (
                                  <td
                                    key={col.id}
                                    className="p-3 border-b text-xs text-text-disabled truncate max-w-[150px]"
                                  >
                                    {JSON.stringify(m.customAttributes || {})}
                                  </td>
                                );
                              default:
                                return (
                                  <td key={col.id} className="p-3 border-b">
                                    -
                                  </td>
                                );
                            }
                          })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Footer Stats - Cleaned */}
            <div className="bg-surface-base border-t border-border-default p-2 text-xs text-text-muted flex justify-between px-4">
              <span>Showing {measurements.length} records</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
