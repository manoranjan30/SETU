import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface DeleteConfirmationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    itemName: string;
}

export const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    itemName,
}) => {
    const [confirmationText, setConfirmationText] = useState('');

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (confirmationText === 'DELETE') {
            onConfirm();
            setConfirmationText('');
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-5 w-5" />
                        <h2 className="font-semibold">Delete Confirmation</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-gray-600">
                        Are you sure you want to delete <span className="font-bold text-gray-900">{itemName}</span>?
                    </p>
                    <p className="text-sm text-red-500 bg-red-50 p-3 rounded-md">
                        Warning: This action will permanently delete this item and ALL associated measurements. This action cannot be undone.
                    </p>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Type <span className="font-mono font-bold">DELETE</span> to confirm
                        </label>
                        <input
                            type="text"
                            value={confirmationText}
                            onChange={(e) => setConfirmationText(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                            placeholder="DELETE"
                            autoFocus
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 rounded-b-lg">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={confirmationText !== 'DELETE'}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Delete Permanently
                    </button>
                </div>
            </div>
        </div>
    );
};
