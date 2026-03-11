import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { X, Upload, FileText, AlertCircle, Calendar } from "lucide-react";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (
    file: File,
    registerId: number,
    revisionNumber: string,
    revisionDate: string,
  ) => Promise<void>;
  registerItem: {
    id: number;
    drawingNumber: string;
    title: string;
    nextRevision: string;
  } | null;
}

const UploadModal = ({
  isOpen,
  onClose,
  onUpload,
  registerItem,
}: UploadModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [revisionNumber, setRevisionNumber] = useState(
    registerItem?.nextRevision || "0",
  );
  const [revisionDate, setRevisionDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError(null);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/vnd.dwg": [".dwg"],
      "image/vnd.dxf": [".dxf"],
      "application/octet-stream": [".rvt", ".ifc", ".nwd", ".h"],
    },
    maxFiles: 1,
    multiple: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !registerItem) return;

    setIsUploading(true);
    setError(null);

    try {
      await onUpload(file, registerItem.id, revisionNumber, revisionDate);
      onClose();
      setFile(null);
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen || !registerItem) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-overlay backdrop-blur-sm">
      <div className="bg-surface-card rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-surface-base">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">
              Upload Drawing
            </h3>
            <p className="text-sm text-text-muted">
              {registerItem.drawingNumber} - {registerItem.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-200 transition-colors"
          >
            <X size={20} className="text-text-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Revision Input */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Revision Number
              </label>
              <input
                type="text"
                value={revisionNumber}
                onChange={(e) => setRevisionNumber(e.target.value)}
                className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                placeholder="e.g. 0, A, B, 1"
                required
              />
            </div>

            {/* Revision Date Input */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Revision Date
              </label>
              <input
                type="date"
                value={revisionDate}
                onChange={(e) => setRevisionDate(e.target.value)}
                className="w-full px-3 py-2 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                required
              />
            </div>
          </div>

          {/* Upload Date (Read Only) */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Upload Date (System)
            </label>
            <div className="w-full px-3 py-2 bg-surface-base border border-border-default rounded-lg text-text-muted flex items-center gap-2 cursor-not-allowed">
              <Calendar size={16} />
              {new Date().toLocaleDateString()}
            </div>
            <p className="text-xs text-text-muted mt-1">
              System suggested next revision:{" "}
              <span className="font-mono font-medium">
                {registerItem.nextRevision}
              </span>
            </p>
          </div>

          {/* File Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
                            ${isDragActive ? "border-primary bg-primary-muted" : "border-border-strong hover:border-gray-400 hover:bg-surface-base"}
                            ${file ? "bg-success-muted border-green-200" : ""}
                        `}
          >
            <input {...getInputProps()} />

            {file ? (
              <div className="flex flex-col items-center text-green-700">
                <FileText size={40} className="mb-2" />
                <span className="font-medium text-sm truncate max-w-full px-4">
                  {file.name}
                </span>
                <span className="text-xs opacity-70">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="mt-3 text-xs text-error hover:underline"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center text-text-muted">
                <Upload size={40} className="mb-2 text-text-disabled" />
                <p className="text-sm font-medium text-text-secondary">
                  {isDragActive ? "Drop file here" : "Click or Drag file here"}
                </p>
                <p className="text-xs text-text-disabled mt-1">
                  PDF, DWG, DXF, RVT, IFC, NWD (Max 50MB)
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-error bg-error-muted p-3 rounded-lg">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface-card border border-border-strong rounded-lg hover:bg-surface-base transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || isUploading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm shadow-blue-200"
            >
              {isUploading ? "Uploading..." : "Upload Revision"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadModal;
