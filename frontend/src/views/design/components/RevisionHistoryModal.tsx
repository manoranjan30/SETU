
import { useState, useEffect } from 'react';
import { X, Download, FileText } from 'lucide-react';
import api from '../../../api/axios';

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
}

const RevisionHistoryModal = ({ isOpen, onClose, registerItem, projectId, onDownload }: RevisionHistoryModalProps) => {
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
            const res = await api.get(`/design/${projectId}/register/${registerItem.id}/revisions`);
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
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col mx-4 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <FileText size={18} className="text-blue-600" />
                            Revision History
                        </h3>
                        <p className="text-sm text-gray-500">{registerItem.drawingNumber} - {registerItem.title}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-200">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-0">
                    {loading ? (
                        <div className="flex items-center justify-center h-40 text-gray-500">Loading history...</div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 font-medium text-gray-600">Revision</th>
                                    <th className="px-6 py-3 font-medium text-gray-600">Revision Date</th>
                                    <th className="px-6 py-3 font-medium text-gray-600">Upload Date</th>
                                    <th className="px-6 py-3 font-medium text-gray-600">Uploaded By</th>
                                    <th className="px-6 py-3 font-medium text-gray-600">File</th>
                                    <th className="px-6 py-3 font-medium text-gray-600 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {revisions.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                                            No revisions found.
                                        </td>
                                    </tr>
                                ) : (
                                    revisions.map((rev) => (
                                        <tr key={rev.id} className="hover:bg-blue-50/50 transition-colors group">
                                            <td className="px-6 py-3 font-semibold text-blue-600">
                                                <span className="bg-blue-50 px-2 py-1 rounded border border-blue-100">{rev.revisionNumber}</span>
                                            </td>
                                            <td className="px-6 py-3 text-gray-600">
                                                {rev.revisionDate ? new Date(rev.revisionDate).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-6 py-3 text-gray-500 text-xs">
                                                {new Date(rev.uploadedAt).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-3 text-gray-600">
                                                {rev.uploadedBy?.username || 'Unknown'}
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="flex flex-col">
                                                    <span className="text-gray-700 truncate max-w-[200px]" title={rev.originalFileName}>{rev.originalFileName}</span>
                                                    <span className="text-xs text-gray-400">{(rev.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                                <button
                                                    onClick={() => onDownload(rev.id, rev.originalFileName)}
                                                    className="text-gray-400 hover:text-green-600 p-1.5 rounded-full hover:bg-green-50 transition-all opacity-0 group-hover:opacity-100"
                                                    title="Download"
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
