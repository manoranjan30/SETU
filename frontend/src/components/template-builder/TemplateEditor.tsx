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
  Settings,
  Wand2,
} from "lucide-react";
import ZoneOverlay from "./ZoneOverlay";
import PropertiesPanel from "./PropertiesPanel";
import type {
  PdfTemplate,
  TemplateZone,
  TemplateConfig,
  ZoneBounds,
} from "../../types/template.types";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface TemplateEditorProps {
  template: PdfTemplate | null;
  onSave: (template: Partial<PdfTemplate>) => Promise<void>;
  onCancel: () => void;
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

  const handleZoneDrawn = useCallback(
    (_zone: TemplateZone, _bounds: ZoneBounds) => {
      // The external PDF extractor has been removed. Zones are configured manually.
    },
    [],
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
          <div className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-surface-card shadow text-gray-800">
            <Settings size={14} />
            Properties
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
          <PropertiesPanel
            zone={selectedZone}
            onZoneUpdate={handleZoneUpdate}
            onZoneDelete={handleZoneDelete}
          />
        </div>
      </div>
    </div>
  );
};

export default TemplateEditor;
