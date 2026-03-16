import React, { useState } from "react";
import { X, AlertTriangle } from "lucide-react";

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName: string;
}

export const DeleteConfirmationDialog: React.FC<
  DeleteConfirmationDialogProps
> = ({ isOpen, onClose, onConfirm, itemName }) => {
  const [confirmationText, setConfirmationText] = useState("");

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (confirmationText === "DELETE") {
      onConfirm();
      setConfirmationText("");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-surface-overlay z-50 flex items-center justify-center p-4">
      <div className="bg-surface-card rounded-2xl shadow-2xl border border-border-default w-full max-w-md animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-4 border-b border-border-default bg-error-muted/40">
          <div className="flex items-center gap-2 text-error">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="font-semibold">Delete Confirmation</h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-disabled hover:text-text-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-text-secondary">
            Are you sure you want to delete{" "}
            <span className="font-bold text-text-primary">{itemName}</span>?
          </p>
          <p className="text-sm text-error bg-error-muted p-3 rounded-xl border border-error/20">
            Warning: This action will permanently delete this item and ALL
            associated measurements. This action cannot be undone.
          </p>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-secondary">
              Type <span className="font-mono font-bold">DELETE</span> to
              confirm
            </label>
            <input
              type="text"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              className="w-full px-3 py-2 border border-border-default rounded-xl focus:ring-2 focus:ring-error focus:border-error outline-none bg-surface-card"
              placeholder="DELETE"
              autoFocus
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-border-default bg-surface-base rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface-card border border-border-strong rounded-xl hover:bg-surface-base"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirmationText !== "DELETE"}
            className="px-4 py-2 text-sm font-semibold text-white bg-error rounded-xl hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Delete Permanently
          </button>
        </div>
      </div>
    </div>
  );
};
