import { useEffect, useState } from "react";
import { X, FileText, AlertTriangle, Loader2 } from "lucide-react";
import CadViewer from "./CadViewer";
import api from "../../../api/axios";

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string | null;
  fileName: string;
  fileType: string;
  canDownload?: boolean;
  /** Pass for DWG files so the backend can convert DWG → DXF on-demand */
  revisionId?: number;
  projectId?: string | number;
}

const PreviewModal = ({
  isOpen,
  onClose,
  fileUrl,
  fileName,
  fileType,
  canDownload = false,
  revisionId,
  projectId,
}: PreviewModalProps) => {
  const lower = fileName.toLowerCase();
  const isPDF = fileType === "application/pdf" || lower.endsWith(".pdf");
  const isImage =
    fileType.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp)$/i.test(lower);
  const isDXF = fileType === "image/vnd.dxf" || lower.endsWith(".dxf");
  const isDWG = lower.endsWith(".dwg");

  // For DWG: fetch converted DXF blob from backend preview endpoint
  const [dwgDxfUrl, setDwgDxfUrl] = useState<string | null>(null);
  const [dwgLoading, setDwgLoading] = useState(false);
  const [dwgError, setDwgError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !isDWG || !revisionId || !projectId) return;

    let objectUrl: string | null = null;
    setDwgLoading(true);
    setDwgError(null);
    setDwgDxfUrl(null);

    api
      .get(`/design/${projectId}/preview/${revisionId}`, { responseType: "blob" })
      .then((res) => {
        const ct: string = res.headers["content-type"] ?? "";
        // Accept DXF or generic binary (server may not set specific mime-type)
        if (
          ct.includes("dxf") ||
          ct.includes("octet-stream") ||
          ct.includes("x-dxf")
        ) {
          objectUrl = window.URL.createObjectURL(
            new Blob([res.data], { type: "image/vnd.dxf" }),
          );
          setDwgDxfUrl(objectUrl);
        } else {
          setDwgError("no_conversion");
        }
      })
      .catch(() => setDwgError("fetch_failed"))
      .finally(() => setDwgLoading(false));

    return () => {
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [isOpen, isDWG, revisionId, projectId]);

  // Clean up on close
  useEffect(() => {
    if (!isOpen && dwgDxfUrl) {
      window.URL.revokeObjectURL(dwgDxfUrl);
      setDwgDxfUrl(null);
      setDwgError(null);
    }
  }, [isOpen]);

  if (!isOpen || !fileUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      <div className="bg-surface-card rounded-lg shadow-2xl w-full h-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-border-subtle bg-surface-base flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-info-muted text-primary rounded-lg">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text-primary truncate max-w-md">
                {fileName}
              </h3>
              <p className="text-xs text-text-muted uppercase tracking-wide">
                {isDWG ? "DWG Drawing" : fileType || "Unknown Type"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-disabled hover:text-text-secondary hover:bg-surface-raised rounded-full transition-all"
          >
            <X size={24} />
          </button>
        </div>

        {/* Viewer area */}
        <div className="flex-1 bg-surface-raised relative overflow-hidden flex items-center justify-center">
          {isPDF ? (
            <iframe
              src={`${fileUrl}#toolbar=0`}
              className="w-full h-full border-none"
              title="PDF Preview"
            />
          ) : isImage ? (
            <img
              src={fileUrl}
              alt="Preview"
              className="max-w-full max-h-full object-contain shadow-lg"
            />
          ) : isDXF ? (
            <CadViewer fileUrl={fileUrl} />
          ) : isDWG ? (
            dwgLoading ? (
              <div className="flex flex-col items-center gap-4 text-text-muted">
                <Loader2 size={40} className="animate-spin text-primary" />
                <span className="text-sm">Converting DWG → DXF on server…</span>
              </div>
            ) : dwgDxfUrl ? (
              <CadViewer fileUrl={dwgDxfUrl} />
            ) : (
              <DwgFallback
                fileUrl={fileUrl}
                fileName={fileName}
                canDownload={canDownload}
                error={dwgError}
              />
            )
          ) : (
            <div className="text-center p-8 max-w-md">
              <div className="mx-auto w-16 h-16 bg-amber-100 text-warning rounded-full flex items-center justify-center mb-4">
                <AlertTriangle size={32} />
              </div>
              <h4 className="text-xl font-semibold text-gray-800 mb-2">
                Preview Not Available
              </h4>
              <p className="text-text-secondary mb-6">
                This file type ({lower.split(".").pop()?.toUpperCase()}) cannot be
                previewed in the browser.
              </p>
              {canDownload ? (
                <a
                  href={fileUrl}
                  download={fileName}
                  className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary-dark transition-colors"
                >
                  Download File
                </a>
              ) : (
                <div className="inline-flex items-center justify-center px-6 py-3 rounded-md text-sm font-medium text-amber-800 bg-amber-100">
                  Download is allowed only for Active GFC drawings
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── DWG conversion not available fallback ───────────────────────────────────
const DwgFallback = ({
  fileUrl,
  fileName,
  canDownload,
  error,
}: {
  fileUrl: string;
  fileName: string;
  canDownload: boolean;
  error: string | null;
}) => (
  <div className="text-center p-8 max-w-sm">
    <div className="mx-auto w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
      <AlertTriangle size={32} />
    </div>
    <h4 className="text-xl font-semibold text-gray-800 mb-2">DWG Preview Unavailable</h4>
    <p className="text-text-secondary mb-4 text-sm">
      {error === "no_conversion"
        ? "Server-side DWG conversion is not enabled. Ask your admin to install dwg2dxf and enable ENABLE_DWG_PREVIEW_CONVERSION."
        : "Could not fetch the drawing from the server."}
    </p>
    <div className="p-4 bg-blue-50 rounded-lg text-left text-sm text-blue-800 border border-blue-100 mb-4">
      <p className="font-semibold mb-1">Alternative: upload as DXF</p>
      <p>
        Save the drawing as <strong>.dxf</strong> and upload it to use the
        full browser viewer with measurement tools.
      </p>
    </div>
    {canDownload && (
      <a
        href={fileUrl}
        download={fileName}
        className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary-dark transition-colors"
      >
        Download DWG
      </a>
    )}
  </div>
);

export default PreviewModal;
