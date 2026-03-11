import React from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  scheduleName: string;
  activityCount: number;
  hasProgress: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({
  isOpen,
  scheduleName,
  activityCount,
  hasProgress,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-card rounded-lg shadow-xl max-w-md w-full animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 className="text-error" size={20} />
            </div>
            <h3 className="text-lg font-semibold text-text-primary">
              Delete Micro Schedule
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="text-text-disabled hover:text-text-secondary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Main Warning */}
          <div className="bg-error-muted border border-red-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertTriangle
                className="text-error flex-shrink-0 mt-0.5"
                size={20}
              />
              <div className="flex-1">
                <h4 className="font-semibold text-red-900 mb-1">
                  ⚠️ This action cannot be undone!
                </h4>
                <p className="text-sm text-red-700">
                  You are about to permanently delete:
                </p>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="bg-surface-base rounded-lg p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase mb-1">
                Schedule Name
              </p>
              <p className="font-medium text-text-primary">{scheduleName}</p>
            </div>

            {/* Warning Items */}
            <div className="space-y-2 pt-3 border-t">
              <p className="text-xs font-semibold text-text-muted uppercase mb-2">
                What will be deleted:
              </p>

              <div className="flex items-start gap-2 text-sm text-text-secondary">
                <span className="text-error font-bold">✗</span>
                <span>
                  The micro schedule: <strong>"{scheduleName}"</strong>
                </span>
              </div>

              <div className="flex items-start gap-2 text-sm text-text-secondary">
                <span className="text-error font-bold">✗</span>
                <span>
                  <strong>{activityCount}</strong> micro activit
                  {activityCount === 1 ? "y" : "ies"} linked to this schedule
                </span>
              </div>

              <div className="flex items-start gap-2 text-sm text-text-secondary">
                <span className="text-error font-bold">✗</span>
                <span>All BOQ quantity allocations for these activities</span>
              </div>

              {hasProgress && (
                <div className="flex items-start gap-2 text-sm font-semibold text-red-700 bg-error-muted p-2 rounded border border-red-200 mt-2">
                  <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>Progress data and measurements already recorded</span>
                </div>
              )}

              <div className="flex items-start gap-2 text-sm text-text-secondary">
                <span className="text-error font-bold">✗</span>
                <span>All date/time tracking and forecast info</span>
              </div>
            </div>
          </div>

          {/* Final Confirmation Text */}
          <div className="bg-warning-muted border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> The parent schedule activity will NOT be
              deleted, only the micro-level breakdown.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-surface-base">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-border-strong rounded-md text-text-secondary hover:bg-surface-raised transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium flex items-center gap-2"
          >
            <Trash2 size={16} />
            Delete Permanently
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationDialog;
