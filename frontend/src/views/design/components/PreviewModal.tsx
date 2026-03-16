import { X, FileText, AlertTriangle } from "lucide-react";
import CadViewer from "./CadViewer";

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string | null;
  fileName: string;
  fileType: string;
}

const PreviewModal = ({
  isOpen,
  onClose,
  fileUrl,
  fileName,
  fileType,
}: PreviewModalProps) => {
  const isPDF =
    fileType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
  const isImage =
    fileType.startsWith("image/") ||
    /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
  const isDXF =
    fileType === "image/vnd.dxf" || fileName.toLowerCase().endsWith(".dxf");
  const isDWG = fileName.toLowerCase().endsWith(".dwg");

  if (!isOpen || !fileUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      <div className="bg-surface-card rounded-lg shadow-2xl w-full h-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b border-border-subtle bg-surface-base flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-info-muted text-primary rounded-lg">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-text-primary truncate max-w-md">
                {fileName}
              </h3>
              <p className="text-xs text-text-muted uppercase">
                {fileType || "Unknown Type"}
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
          ) : (
            <div className="text-center p-8 max-w-md">
              <div className="mx-auto w-16 h-16 bg-amber-100 text-warning rounded-full flex items-center justify-center mb-4">
                <AlertTriangle size={32} />
              </div>
              <h4 className="text-xl font-semibold text-gray-800 mb-2">
                Preview Not Available
              </h4>
              <p className="text-text-secondary mb-6">
                This file type ({fileName.split(".").pop()}) cannot be previewed
                directly in the browser.
              </p>
              <a
                href={fileUrl}
                download={fileName}
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary-dark transition-colors"
              >
                Download File
              </a>
              {isDWG && (
                <div className="mt-6 p-4 bg-primary-muted rounded-lg text-left text-sm text-blue-800 border border-blue-100">
                  <p className="font-semibold mb-1">
                    Want to view and measure this drawing?
                  </p>
                  <p>
                    Browser preview is available for <strong>DXF files</strong>.
                    Please save your drawing as a <code>.dxf</code> file and
                    upload it to use the built-in viewer with measurement tools.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreviewModal;
