import { useState, useEffect } from "react";
import { X, Download, FileText } from "lucide-react";
import api from "../../../api/axios";

interface Revision {
  id: number;
  revisionNumber: string;
  revisionDate: string; // ISO Date
  uploadedAt: string;
  originalFileName: string;
  fileSize: number;
  uploadedBy: {
    id: number;
    username: string;
  };
}

interface RevisionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  registerItem: { id: number; drawingNumber: string; title: string } | null;
  projectId: string;
  onDownload: (revisionId: number, filename: string) => void;
  canDownload: boolean;
}

const RevisionHistoryModal = ({
  isOpen,
  onClose,
  registerItem,
  projectId,
  onDownload,
  canDownload,
}: RevisionHistoryModalProps) => {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && registerItem) {
      fetchRevisions();
    }
  }, [isOpen, registerItem]);

  const fetchRevisions = async () => {
    if (!registerItem || !projectId) return;
    setLoading(true);
    try {
      const res = await api.get(
        `/design/${projectId}/register/${registerItem.id}/revisions`,
      );
      setRevisions(res.data);
    } catch (err) {
      console.error("Failed to fetch revisions", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !registerItem) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-surface-card rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col mx-4 animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-4 border-b border-border-subtle bg-surface-base rounded-t-lg">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <FileText size={18} className="text-primary" />
              Revision History
            </h3>
            <p className="text-sm text-text-muted">
              {registerItem.drawingNumber} - {registerItem.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-disabled hover:text-text-secondary transition-colors p-1 rounded-full hover:bg-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-0">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-text-muted">
              Loading history...
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-base sticky top-0 z-10 border-b border-border-default">
                <tr>
                  <th className="px-6 py-3 font-medium text-text-secondary">
                    Revision
                  </th>
                  <th className="px-6 py-3 font-medium text-text-secondary">
                    Revision Date
                  </th>
                  <th className="px-6 py-3 font-medium text-text-secondary">
                    Upload Date
                  </th>
                  <th className="px-6 py-3 font-medium text-text-secondary">
                    Uploaded By
                  </th>
                  <th className="px-6 py-3 font-medium text-text-secondary">
                    File
                  </th>
                  <th className="px-6 py-3 font-medium text-text-secondary text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {revisions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-text-disabled"
                    >
                      No revisions found.
                    </td>
                  </tr>
                ) : (
                  revisions.map((rev) => (
                    <tr
                      key={rev.id}
                      className="hover:bg-primary-muted/50 transition-colors group"
                    >
                      <td className="px-6 py-3 font-semibold text-primary">
                        <span className="bg-primary-muted px-2 py-1 rounded border border-blue-100">
                          {rev.revisionNumber}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-text-secondary">
                        {rev.revisionDate
                          ? new Date(rev.revisionDate).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="px-6 py-3 text-text-muted text-xs">
                        {new Date(rev.uploadedAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-text-secondary">
                        {rev.uploadedBy?.username || "Unknown"}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex flex-col">
                          <span
                            className="text-text-secondary truncate max-w-[200px]"
                            title={rev.originalFileName}
                          >
                            {rev.originalFileName}
                          </span>
                          <span className="text-xs text-text-disabled">
                            {(rev.fileSize / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={() => {
                            if (!canDownload) return;
                            onDownload(rev.id, rev.originalFileName);
                          }}
                          disabled={!canDownload}
                          className={`p-1.5 rounded-full transition-all ${
                            canDownload
                              ? "text-text-disabled hover:bg-success-muted hover:text-success opacity-0 group-hover:opacity-100"
                              : "cursor-not-allowed text-text-disabled/60 opacity-100"
                          }`}
                          title={
                            canDownload
                              ? "Download"
                              : "Download is allowed only for Active GFC drawings"
                          }
                        >
                          <Download size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default RevisionHistoryModal;
