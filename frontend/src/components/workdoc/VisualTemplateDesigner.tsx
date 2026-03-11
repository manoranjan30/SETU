import React, { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  MousePointer2,
  Wand2,
  Info,
  X,
} from "lucide-react";
import { toast } from "react-hot-toast";
import Modal from "../common/Modal";

import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

// Set worker path
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: any) => void;
  initialConfig: any;
  sampleFile: File | null;
}

const VisualTemplateDesigner: React.FC<Props> = ({
  isOpen,
  onClose,
  onSave,
  initialConfig,
  sampleFile,
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [selection, setSelection] = useState<{
    text: string;
    rect: DOMRect;
  } | null>(null);
  const [config, setConfig] = useState(initialConfig);
  const [showHelp, setShowHelp] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initial config structure if empty
  useEffect(() => {
    if (!config.tableConfig) {
      setConfig({
        ...config,
        tableConfig: {
          rowRegex: "",
          columnMapping: {
            itemNo: 1,
            code: 2,
            description: 3,
            qty: 4,
            uom: 5,
            rate: 6,
            amount: 7,
          },
        },
      });
    }
  }, []);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.toString().trim() === "") {
      setSelection(null);
      return;
    }

    const text = selection.toString().trim();
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Adjust rect to be relative to our container if needed,
    // but for a fixed overlay, screen coords might be easier
    // provided the modal uses fixed positioning.
    setSelection({ text, rect });
  };

  const generateRegexFromText = (
    text: string,
    type: "exact" | "value-after" | "table-row",
  ) => {
    // Escape special regex chars
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    if (type === "exact") {
      return escaped;
    }

    if (type === "value-after") {
      // E.g. "Order No: 12345" -> "Order No:\s*(\d+)"
      // Heuristic: Split by colon or space
      if (text.includes(":")) {
        const parts = text.split(":");
        const label = parts[0].trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // The value part is dynamic, so we replace it with a capture group
        return `${label}\\s*[:]?\\s*(.*)`;
      }
      // Fallback: assume the whole selection is the value? No, usually valid for "Order No 12345"
      // Let's prompt the user or be smarter.
      return `${escaped}\\s*(.*)`;
    }

    if (type === "table-row") {
      // THE MAGIC
      // Split by 2+ spaces
      const parts = text.split(/\s{2,}/).filter((p) => p.trim());

      // Generate basic capture groups based on content types
      const regexParts = parts.map((part) => {
        if (/^\d+$/.test(part)) return "(\\d+)"; // number
        if (/^\d{2}[./-]\d{2}[./-]\d{4}$/.test(part))
          return "(\\d{2}[./-]\\d{2}[./-]\\d{4})"; // date
        if (/^[\d,.]+$/.test(part)) return "([\\d,.]+)"; // decimal/amount
        return "(.+?)"; // text
      });

      return "^\\s*" + regexParts.join("\\s+") + "$"; // Basic construction
    }

    return text;
  };

  const applyRule = (type: string) => {
    if (!selection) return;
    const text = selection.text.trim();

    let newConfig = { ...config };

    const escapeRegex = (str: string) =>
      str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    if (type === "vendor") {
      // Ask user for the label
      const defaultLabel = text.includes(":") ? text.split(":")[0].trim() : "";
      const label = prompt(
        "Enter the exact LABEL text that appears before the Vendor Name (e.g. 'Vendor:'):",
        defaultLabel,
      );

      if (label) {
        // If user provided a label, look for Label + space/colon + Value
        const regex = `${escapeRegex(label)}\\s*[:.-]?\\s*(.*)`;
        newConfig.vendorRegex = regex;
      } else {
        // Fallback: Assume the selected text IS the prefix? Or just alert?
        // Let's assume they selected "Vendor: Name"
        const generated = generateRegexFromText(text, "value-after");
        const regex = prompt("Confirm Regex for Vendor:", generated);
        if (regex) newConfig.vendorRegex = regex;
      }
    } else if (type === "woNumber") {
      const defaultLabel = text.includes(":")
        ? text.split(":")[0].trim()
        : text.match(/Order|WO|PO|No/i)
          ? text.split(/\s+/)[0]
          : "";
      const label = prompt(
        "Enter the exact LABEL text that appears before the Order Number (e.g. 'Order No:'):",
        defaultLabel,
      );

      if (label) {
        const regex = `${escapeRegex(label)}\\s*[:.-]?\\s*(.*)`;
        newConfig.woNumberRegex = regex;
      } else {
        const generated = generateRegexFromText(text, "value-after");
        const regex = prompt("Confirm Regex for Order #:", generated);
        if (regex) newConfig.woNumberRegex = regex;
      }
    } else if (type === "tableRow") {
      // Smart Table Row Generator
      // Improve splitting: try 2 spaces, then TAB, then if only 1 part, try 1 space but warn
      let parts = text.split(/\s{2,}/).filter((p) => p.trim());
      if (parts.length <= 1) {
        // Try splitting by single space if it looks like a table row with numbers
        // Only if it has at least 3 parts
        const singleSpaceParts = text.split(/\s+/).filter((p) => p.trim());
        if (singleSpaceParts.length >= 3) {
          if (
            confirm(
              "We couldn't detect clear columns with 2+ spaces. Try splitting by single spaces?",
            )
          ) {
            parts = singleSpaceParts;
          }
        } else {
          alert(
            "⚠️ Warning: Could not detect multiple columns. Ensure you selected a full row with gaps between columns.",
          );
        }
      }

      if (parts.length < 3) {
        if (
          !confirm(
            `Warning: Only detected ${parts.length} columns. This might match irrelevant lines. Continue?`,
          )
        )
          return;
      }

      const regexParts = parts.map((part) => {
        if (/^\d+$/.test(part)) return "(\\d+)"; // number
        if (/^\d{2}[./-]\d{2}[./-]\d{4}$/.test(part))
          return "(\\d{2}[./-]\\d{2}[./-]\\d{4})"; // date
        if (/^[\d,.]+$/.test(part)) return "([\\d,.]+)"; // decimal/amount
        return "(.+?)"; // text - use lazy match!
      });

      // Relaxed anchors to allow whitespace variations
      const generatedRegex = "\\s*" + regexParts.join("\\s+") + "\\s*";

      const regex = prompt(
        "Generated Table Row Regex:\n(Check capture groups!)\nDefault Column Mapping:\n1:ItemNo, 2:Code, 3:Desc, 4:Qty, 5:UOM, 6:Rate, 7:Amount",
        generatedRegex,
      );
      if (regex) newConfig.tableConfig.rowRegex = regex;
    }

    setConfig(newConfig);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
    toast.success(`Updated ${type} rule!`);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => onClose()}
      title="Visual Template Designer"
      size="xl"
    >
      <div className="flex h-[80vh] gap-4">
        {/* Left: PDF Viewer */}
        <div
          className="flex-1 bg-slate-100 rounded-xl overflow-hidden relative flex flex-col"
          ref={containerRef}
        >
          <div className="bg-surface-card border-b border-border-default p-2 flex justify-between items-center z-10 shadow-sm">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                disabled={pageNumber <= 1}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold w-12 text-center">
                {pageNumber} / {numPages}
              </span>
              <button
                onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                disabled={pageNumber >= numPages}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold w-12 text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale((s) => Math.min(2.5, s + 0.1))}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>

          {showHelp && (
            <div className="absolute top-14 left-4 right-4 z-20 bg-primary-muted border border-blue-200 p-3 rounded-xl shadow-lg flex justify-between items-start animate-in slide-in-from-top-2">
              <div className="text-xs text-blue-800 space-y-1">
                <p className="font-bold flex items-center gap-2">
                  <Info className="w-4 h-4" /> How to use Visual Designer:
                </p>
                <ul className="list-disc pl-5 space-y-1 opacity-80">
                  <li>
                    <strong>Zoom & Navigate</strong> to find your data.
                  </li>
                  <li>
                    <strong>Highlight Text</strong> (e.g. Vendor Name, Order #)
                    with your mouse.
                  </li>
                  <li>
                    <strong>Select Rule Type</strong> from the popup menu.
                  </li>
                  <li>
                    For <strong>Tables</strong>: Highlight a{" "}
                    <u>single full row</u> to auto-detect columns.
                  </li>
                </ul>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="text-blue-400 hover:text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div
            className="flex-1 overflow-auto p-4 flex justify-center selection:bg-blue-300 selection:bg-opacity-50"
            onMouseUp={handleTextSelection}
          >
            {sampleFile ? (
              <Document
                file={sampleFile}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="animate-pulse text-xs">Loading PDF...</div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={false}
                  className="shadow-lg"
                />
              </Document>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-text-disabled">
                <Info className="w-12 h-12 mb-2 opacity-50" />
                <p className="font-bold text-sm">
                  Upload a sample PDF in the previous step
                  <br />
                  to use the Visual Designer.
                </p>
              </div>
            )}
          </div>

          {/* Floating Action Menu */}
          {selection && (
            <div
              className="fixed z-50 bg-slate-900 text-white p-2 rounded-xl shadow-2xl flex flex-col gap-1 border border-slate-700 animate-in fade-in zoom-in-95 duration-200"
              style={{
                top: Math.min(
                  selection.rect.bottom + 10,
                  window.innerHeight - 200,
                ), // Keep on screen
                left: Math.max(
                  10,
                  Math.min(selection.rect.left, window.innerWidth - 250),
                ),
              }}
            >
              <div className="px-2 py-1 border-b border-slate-700 mb-1">
                <p className="text-[10px] uppercase font-black text-text-disabled">
                  Assign Selection To:
                </p>
                <p className="text-xs max-w-[200px] truncate opacity-70 italic">
                  "{selection.text}"
                </p>
              </div>
              <button
                onClick={() => applyRule("vendor")}
                className="flex items-center gap-2 px-3 py-2 hover:bg-primary rounded-lg text-xs font-bold transition-colors text-left"
              >
                <MousePointer2 className="w-3 h-3" /> Vendor Rule
              </button>
              <button
                onClick={() => applyRule("woNumber")}
                className="flex items-center gap-2 px-3 py-2 hover:bg-primary rounded-lg text-xs font-bold transition-colors text-left"
              >
                <MousePointer2 className="w-3 h-3" /> Order No. Rule
              </button>
              <div className="h-px bg-slate-700 my-1" />
              <button
                onClick={() => applyRule("tableRow")}
                className="flex items-center gap-2 px-3 py-2 hover:bg-green-600 rounded-lg text-xs font-bold transition-colors text-left"
              >
                <Wand2 className="w-3 h-3" /> Auto-Generate Table Row Rule
              </button>
            </div>
          )}
        </div>

        {/* Right: Config Preview */}
        <div className="w-80 bg-surface-card border-l border-border-default p-4 flex flex-col gap-4 overflow-auto">
          <div>
            <h4 className="text-xs font-black text-text-disabled uppercase tracking-widest mb-2">
              Live Configuration
            </h4>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-text-muted">
                  Vendor Regex
                </label>
                <div className="p-2 bg-surface-base border border-border-default rounded text-xs font-mono break-all">
                  {config.vendorRegex || (
                    <span className="text-slate-300 italic">Not set</span>
                  )}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-text-muted">
                  Order No Regex
                </label>
                <div className="p-2 bg-surface-base border border-border-default rounded text-xs font-mono break-all">
                  {config.woNumberRegex || (
                    <span className="text-slate-300 italic">Not set</span>
                  )}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-text-muted">
                  Table Row Regex
                </label>
                <div className="p-2 bg-surface-base border border-border-default rounded text-xs font-mono break-all">
                  {config.tableConfig?.rowRegex || (
                    <span className="text-slate-300 italic">Not set</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-slate-100">
            <button
              onClick={() => onSave(config)}
              className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark shadow-lg shadow-blue-100 active:scale-95 transition-all"
            >
              Save Rules
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default VisualTemplateDesigner;
