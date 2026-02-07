import React, { useState } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle, Play } from 'lucide-react';
import api from '../../api/axios';

interface ScheduleImportWizardProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: number;
    onSuccess: () => void;
}

const ScheduleImportWizard: React.FC<ScheduleImportWizardProps> = ({ isOpen, onClose, projectId, onSuccess }) => {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setResult(null);
            setError(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post(`/projects/${projectId}/schedule/import`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setResult(res.data);
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <h2 className="text-xl font-bold text-gray-800">Import Schedule</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-6 flex-1 overflow-y-auto">
                    {/* File Drop / Select */}
                    {!result && (
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 hover:bg-white transition-colors">
                            <input
                                type="file"
                                accept=".xml,.mpp,.xer"
                                onChange={handleFileChange}
                                className="hidden"
                                id="schedule-file-upload"
                            />
                            <label htmlFor="schedule-file-upload" className="cursor-pointer flex flex-col items-center">
                                <Upload className="w-12 h-12 text-blue-500 mb-4" />
                                <span className="text-gray-700 font-medium">Click to Upload Schedule File</span>
                                <span className="text-sm text-gray-500 mt-2">Supported: MS Project (.xml), P6 (.xml)</span>
                            </label>
                            {file && (
                                <div className="mt-4 flex items-center justify-center text-sm font-semibold text-green-600 bg-green-50 p-2 rounded">
                                    <FileText className="w-4 h-4 mr-2" />
                                    {file.name}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Progress / Error */}
                    {uploading && (
                        <div className="text-center py-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                            <p className="text-gray-600">Parsing Schedule File...</p>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 text-red-700 p-4 rounded-md flex items-start">
                            <AlertCircle className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
                            <div>
                                <h4 className="font-bold">Import Failed</h4>
                                <p className="text-sm">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Result Preview */}
                    {result && (
                        <div className="bg-green-50 text-green-800 p-4 rounded-lg">
                            <div className="flex items-center mb-2">
                                <CheckCircle className="w-5 h-5 mr-2" />
                                <span className="font-bold">Parsed Successfully!</span>
                            </div>
                            <p className="text-sm mb-4">{result.message}</p>

                            {result.preview && (
                                <div className="bg-white p-3 rounded border border-green-200 max-h-40 overflow-y-auto text-xs font-mono">
                                    <h5 className="font-bold border-b mb-2 pb-1">Preview Activities:</h5>
                                    {result.preview.map((t: any, i: number) => (
                                        <div key={i} className="mb-1">{t.name} ({t.duration})</div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="mt-6 pt-4 border-t flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700">
                        Cancel
                    </button>
                    {!result ? (
                        <button
                            onClick={handleUpload}
                            disabled={!file || uploading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                            Import & Calculate
                        </button>
                    ) : (
                        <button
                            onClick={() => { onSuccess(); onClose(); }}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
                        >
                            <Play className="w-4 h-4 mr-2" />
                            Done
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ScheduleImportWizard;
