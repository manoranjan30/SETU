
import React, { useState } from 'react';
import Modal from '../common/Modal';
import api from '../../api/axios';
import { toast } from 'react-hot-toast';
import { FileUp, Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const WorkOrderUploadModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
    const { projectId } = useParams();
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);

    const handleUpload = async () => {
        if (!file || !projectId) return;

        const formData = new FormData();
        formData.append('file', file);

        setLoading(true);
        try {
            await api.post(`/workdoc/${projectId}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success('Work Order processed successfully');
            setFile(null);
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to upload Work Order');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Import SAP Work Order">
            <div className="space-y-6 py-4">
                <div
                    className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${file ? 'border-blue-500 bg-blue-50 shadow-inner' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                        }`}
                    onClick={() => document.getElementById('wo-file')?.click()}
                >
                    <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${file ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                        <FileUp className="w-8 h-8" />
                    </div>

                    <input
                        id="wo-file"
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={e => setFile(e.target.files?.[0] || null)}
                    />
                    <div className="text-center">
                        {file ? (
                            <div className="space-y-1">
                                <p className="font-black text-blue-700 text-lg">{file.name}</p>
                                <p className="text-xs text-blue-400">PDF Document ready for processing</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                <p className="text-gray-900 font-bold">Select SAP Work Order PDF</p>
                                <p className="text-xs text-gray-500">Only .pdf files are supported</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 items-center pt-6 border-t border-gray-100">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleUpload}
                        disabled={!file || loading}
                        className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all shadow-xl shadow-blue-100 active:scale-95"
                    >
                        {loading ? <Loader2 className="animate-spin w-5 h-5" /> : null}
                        {loading ? 'Processing PDF Engine...' : 'Import Now'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default WorkOrderUploadModal;
