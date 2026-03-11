import { useState, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  MousePointer2,
  Square,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Save,
  X,
  Play,
  Settings,
  Loader2,
  Wand2,
} from "lucide-react";
import ZoneOverlay from "./ZoneOverlay";
import PropertiesPanel from "./PropertiesPanel";
import TestPanel from "./TestPanel";
import type {
  PdfTemplate,
  TemplateZone,
  TemplateConfig,
  ZoneBounds,
  TemplateField,
} from "../../types/template.types";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PDF_TOOL_URL =
  import.meta.env.VITE_PDF_TOOL_URL || "http://localhost:8002";

interface TemplateEditorProps {
  template: PdfTemplate | null;
  onSave: (template: Partial<PdfTemplate>) => Promise<void>;
  onCancel: () => void;
}

type RightPanelMode = "properties" | "test";

interface DetectedField {
  label: string;
  value: string;
  key: string;
  type: string;
  confidence: number;
}

const TemplateEditor = ({
  template,
  onSave,
  onCancel,
}: TemplateEditorProps) => {
  // PDF state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [pageSize, setPageSize] = useState({ width: 595, height: 842 });

  // Template state
  const [name, setName] = useState(template?.name || "");
  const [category, setCategory] = useState<string>(
    template?.category || "custom",
  );
  const [description, setDescription] = useState(template?.description || "");
  const [zones, setZones] = useState<TemplateZone[]>(
    (template?.templateJson as TemplateConfig)?.zones || [],
  );
  const [extractionMode, setExtractionMode] = useState<
    "all_pages" | "first_only"
  >((template?.templateJson as TemplateConfig)?.extractionMode || "all_pages");

  // Editor state
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rightPanel, setRightPanel] = useState<RightPanelMode>("properties");
  const [autoDetecting, setAutoDetecting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      setCurrentPage(1);
      setZones([]);
      setSelectedZoneId(null);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const onPageLoadSuccess = ({
    width,
    height,
  }: {
    width: number;
    height: number;
  }) => {
    setPageSize({ width, height });
  };

  // Auto-detect fields when zone is drawn
  const handleZoneDrawn = useCallback(
    async (zone: TemplateZone, bounds: ZoneBounds) => {
      if (!pdfFile) return;

      setAutoDetecting(true);

      try {
        const formData = new FormData();
        formData.append("file", pdfFile);
        formData.append(
          "zone_data",
          JSON.stringify({
            bounds,
            pageNumber: currentPage,
          }),
        );

        const response = await fetch(`${PDF_TOOL_URL}/extract/zone-text`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          console.error("Auto-detection failed:", response.status);
          return;
        }

        const data = await response.json();

        if (data.success) {
          // Determine zone type based on detection
          let detectedType = zone.type;
          if (data.isTable) {
            detectedType = "table";
          } else if (data.detectedFields && data.detectedFields.length > 0) {
            detectedType = "label_value";
          } else if (data.lineCount > 3) {
            detectedType = "multiline";
          }

          // Convert detected fields to template fields
          const fields: TemplateField[] = (data.detectedFields || []).map(
            (f: DetectedField) => ({
              key: f.key,
              label: f.label,
              type: f.type || "text",
              required: false,
            }),
          );

          // Update the zone with detected info
          setZones((prev) =>
            prev.map((z) =>
              z.id === zone.id
                ? {
                    ...z,
                    type: detectedType as any,
                    fields,
                    // Add raw text as a hint
                    _detectedText: data.rawText,
                  }
                : z,
            ),
          );
        }
      } catch (err) {
        console.error("Auto-detection error:", err);
      } finally {
        setAutoDetecting(false);
      }
    },
    [pdfFile, currentPage],
  );

  const handleZoneUpdate = (updatedZone: TemplateZone) => {
    setZones((prev) =>
      prev.map((z) => (z.id === updatedZone.id ? updatedZone : z)),
    );
  };

  const handleZoneDelete = (zoneId: string) => {
    setZones((prev) => prev.filter((z) => z.id !== zoneId));
    if (selectedZoneId === zoneId) {
      setSelectedZoneId(null);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Please enter a template name");
      return;
    }

    setSaving(true);
    try {
      // Clean zones before saving (remove internal properties)
      const cleanZones = zones.map((z) => {
        const { _detectedText, ...cleanZone } = z as any;
        return cleanZone;
      });

      await onSave({
        id: template?.id,
        name,
        category: category as any,
        description,
        templateJson: {
          zones: cleanZones,
          extractionMode,
        },
      });
    } catch (error: any) {
      console.error("Failed to save template:", error);
      const message = error.message || "Unknown error occurred";
      alert(`Failed to save template:\n${message}`);
    } finally {
      setSaving(false);
    }
  };

  const selectedZone = zones.find((z) => z.id === selectedZoneId) || null;

  return (
    <div className="flex flex-col h-full bg-surface-base">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface-card border-b border-border-default shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onCancel}
            className="flex items-center gap-1 text-text-secondary hover:text-gray-800"
          >
            <X size={18} />
            Cancel
          </button>
          <div className="h-6 w-px bg-gray-200" />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template Name"
            className="px-3 py-1.5 text-sm font-medium border border-border-default rounded-lg w-48 focus:ring-2 focus:ring-primary"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-1.5 text-sm border border-border-default rounded-lg"
          >
            <option value="work_order">Work Order</option>
            <option value="invoice">Invoice</option>
            <option value="boq">BOQ</option>
            <option value="custom">Custom</option>
          </select>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            className="px-3 py-1.5 text-sm border border-border-default rounded-lg w-36"
          />
        </div>
        <div className="flex items-center gap-2">
          {/* Auto-detecting indicator */}
          {autoDetecting && (
            <div className="flex items-center gap-2 text-warning text-sm">
              <Loader2 size={14} className="animate-spin" />
              Detecting...
            </div>
          )}

          {/* Panel Toggle */}
          <div className="flex bg-surface-raised rounded-lg p-0.5">
            <button
              onClick={() => setRightPanel("properties")}
              className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1 transition-colors ${
                rightPanel === "properties"
                  ? "bg-surface-card shadow text-gray-800"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              <Settings size={14} />
              Properties
            </button>
            <button
              onClick={() => setRightPanel("test")}
              className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1 transition-colors ${
                rightPanel === "test"
                  ? "bg-surface-card shadow text-gray-800"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              <Play size={14} />
              Test
            </button>
          </div>
          <div className="h-6 w-px bg-gray-200" />
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? "Saving..." : "Save Template"}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* PDF Viewer */}
        <div className="flex-1 flex flex-col">
          {/* PDF Toolbar */}
          <div className="flex items-center justify-between px-4 py-2 bg-surface-raised border-b border-border-default">
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 text-sm bg-surface-card border border-border-default rounded-lg hover:bg-surface-base"
              >
                Upload PDF
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="h-6 w-px bg-gray-300 mx-2" />
              <button
                onClick={() => setIsDrawing(false)}
                className={`p-2 rounded-lg transition-colors ${!isDrawing ? "bg-info-muted text-primary" : "hover:bg-gray-200"}`}
                title="Select & Move Zones"
              >
                <MousePointer2 size={18} />
              </button>
              <button
                onClick={() => setIsDrawing(true)}
                className={`p-2 rounded-lg transition-colors ${isDrawing ? "bg-info-muted text-primary" : "hover:bg-gray-200"}`}
                title="Draw New Zone"
              >
                <Square size={18} />
              </button>

              {zones.length > 0 && (
                <div className="flex items-center gap-1 ml-2 px-2 py-1 bg-surface-base rounded text-xs text-text-secondary">
                  <Wand2 size={12} />
                  {zones.length} zone{zones.length > 1 ? "s" : ""}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
                className="p-1.5 hover:bg-gray-200 rounded"
              >
                <ZoomOut size={18} />
              </button>
              <span className="text-sm text-text-secondary w-16 text-center font-mono">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale((s) => Math.min(2, s + 0.1))}
                className="p-1.5 hover:bg-gray-200 rounded"
              >
                <ZoomIn size={18} />
              </button>
              {numPages > 0 && (
                <>
                  <div className="h-6 w-px bg-gray-300 mx-2" />
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="p-1.5 hover:bg-gray-200 rounded disabled:opacity-30"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="text-sm text-text-secondary">
                    {currentPage} / {numPages}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(numPages, p + 1))
                    }
                    disabled={currentPage >= numPages}
                    className="p-1.5 hover:bg-gray-200 rounded disabled:opacity-30"
                  >
                    <ChevronRight size={18} />
                  </button>
                </>
              )}
            </div>
            {/* Extraction Mode */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Apply to:</span>
              <select
                value={extractionMode}
                onChange={(e) => setExtractionMode(e.target.value as any)}
                className="px-2 py-1 text-xs border border-border-default rounded"
              >
                <option value="all_pages">All Pages</option>
                <option value="first_only">First Page Only</option>
              </select>
            </div>
          </div>

          {/* PDF Display */}
          <div className="flex-1 overflow-auto p-4 flex justify-center bg-gray-200">
            {pdfFile ? (
              <div
                className="relative bg-surface-card shadow-xl"
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: "top center",
                }}
              >
                {/* PDF Container - disable text selection when drawing */}
                <div
                  className={isDrawing ? "pointer-events-none select-none" : ""}
                >
                  <Document
                    file={pdfFile}
                    onLoadSuccess={onDocumentLoadSuccess}
                  >
                    <Page
                      pageNumber={currentPage}
                      onLoadSuccess={onPageLoadSuccess}
                      renderTextLayer={!isDrawing}
                      renderAnnotationLayer={false}
                    />
                  </Document>
                </div>
                {/* Zone Overlay - always on top */}
                <ZoneOverlay
                  zones={zones}
                  onZonesChange={setZones}
                  selectedZoneId={selectedZoneId}
                  onSelectZone={setSelectedZoneId}
                  isDrawing={isDrawing}
                  pageWidth={pageSize.width}
                  pageHeight={pageSize.height}
                  scale={scale}
                  onZoneDrawn={handleZoneDrawn}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                <div className="text-center text-text-disabled">
                  <Square size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="mb-2">No PDF loaded</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-primary hover:underline"
                  >
                    Upload a PDF to start
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel (Properties or Test) */}
        <div className="w-80 flex-shrink-0">
          {rightPanel === "properties" ? (
            <PropertiesPanel
              zone={selectedZone}
              onZoneUpdate={handleZoneUpdate}
              onZoneDelete={handleZoneDelete}
            />
          ) : (
            <TestPanel
              zones={zones}
              pdfFile={pdfFile}
              onClose={() => setRightPanel("properties")}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplateEditor;
