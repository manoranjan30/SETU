import React, { useState } from 'react';
import { Upload, X, FileSpreadsheet } from 'lucide-react';
import api from '../../../api/axios';

interface RevisionImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    sourceVersion: any; // Type simplified for now
    onSuccess: () => void;
}

const RevisionImportModal: React.FC<RevisionImportModalProps> = ({ isOpen, onClose, projectId, sourceVersion, onSuccess }) => {
    const [file, setFile] = useState<File | null>(null);
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);

    // Auto-set code on open? handled in parent or effect?
    // Let's assume parent sets it or user types it.
    // Actually better to have user type it or default to R{seq+1}.
    // For now user enters code.

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!file || !sourceVersion) return;

        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('sourceVersionId', sourceVersion.id.toString());
        formData.append('code', code || `Rev-from-${sourceVersion.versionCode}`);

        try {
            await api.post(`/planning/${projectId}/versions/import-revision`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            onSuccess();
            onClose();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Import failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Upload className="text-blue-600" size={24} />
                        Import Schedule Revision
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
                    <p className="text-sm text-blue-800 font-medium">Source: <span className="font-bold">{sourceVersion?.versionCode}</span></p>
                    <p className="text-xs text-blue-600 mt-1">
                        New revision will be created based on this source. Dates will be updated from the uploaded Excel file.
                    </p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">New Version Code</label>
                        <input
                            type="text"
                            value={code}
                            onChange={e => setCode(e.target.value)}
                            placeholder={`e.g. R${(sourceVersion?.sequenceNumber || 0) + 1}`}
                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Excel File</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer relative">
                            <input
                                type="file"
                                onChange={e => setFile(e.target.files?.[0] || null)}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                accept=".xlsx, .xls"
                            />
                            {file ? (
                                <div className="flex flex-col items-center text-green-600">
                                    <FileSpreadsheet size={32} className="mb-2" />
                                    <span className="font-medium text-sm truncate max-w-full px-4">{file.name}</span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center text-gray-400">
                                    <Upload size={32} className="mb-2" />
                                    <span className="text-sm">Click to upload or drag and drop</span>
                                    <span className="text-xs mt-1">.xlsx or .xls files</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !file}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm transition-all"
                    >
                        {loading ? 'Importing...' : 'Create Revision'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RevisionImportModal;
