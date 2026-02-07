import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Download, Upload } from 'lucide-react';
import api from '../../../api/axios';
import { ImportWizard } from '../../ImportWizard';
import ResourceModal from './ResourceModal';
import { toast } from 'react-hot-toast';

const ResourceMasterList: React.FC = () => {
    const [resources, setResources] = useState<any[]>([]);
    const [showImport, setShowImport] = useState(false);
    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        mode: 'create' | 'edit';
        resourceToEdit?: any;
    }>({ isOpen: false, mode: 'create' });
    const [confirmDelete, setConfirmDelete] = useState<{
        isOpen: boolean;
        resourceId?: number;
    }>({ isOpen: false });

    const fetchResources = async () => {
        try {
            const res = await api.get('/resources/master');
            setResources(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchResources();
    }, []);

    const handleCreate = () => {
        setModalState({ isOpen: true, mode: 'create' });
    };

    const handleEdit = (resource: any) => {
        setModalState({ isOpen: true, mode: 'edit', resourceToEdit: resource });
    };

    const handleDeleteClick = (id: number) => {
        setConfirmDelete({ isOpen: true, resourceId: id });
    };

    const handleDeleteConfirm = async () => {
        if (!confirmDelete.resourceId) return;
        try {
            await api.delete(`/resources/master/${confirmDelete.resourceId}`);
            toast.success("Resource deleted");
            fetchResources();
        } catch (err) {
            toast.error("Failed to delete resource");
        } finally {
            setConfirmDelete({ isOpen: false });
        }
    };

    const handleDownloadTemplate = async () => {
        try {
            const response = await api.get('/resources/template', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'resource_template.csv');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            alert("Failed to download template");
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="mb-4 px-2 flex justify-between items-center gap-2">
                <button onClick={handleCreate} className="flex-1 flex items-center justify-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded text-sm hover:bg-indigo-700">
                    <Plus size={16} /> New Resource
                </button>
                <div className="flex gap-1">
                    <button onClick={handleDownloadTemplate} title="Download Template" className="p-1.5 border border-gray-300 rounded text-gray-600 hover:bg-gray-50">
                        <Download size={16} />
                    </button>
                    <button onClick={() => setShowImport(true)} title="Import Resources" className="p-1.5 border border-gray-300 rounded text-gray-600 hover:bg-gray-50">
                        <Upload size={16} />
                    </button>
                </div>
            </div>
            <div className="flex-1 overflow-auto space-y-1">
                {resources.map(r => (
                    <div key={r.id} className="p-2 bg-white border border-gray-100 rounded-md text-sm flex justify-between items-center group hover:border-gray-300">
                        <div className="flex-1 min-w-0">
                            <div className="font-medium truncate" title={r.resourceName}>{r.resourceName}</div>
                            <div className="text-xs text-gray-500 font-mono">
                                {r.resourceCode} | {r.resourceType}
                                {r.category && ` | ${r.category}`}
                            </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(r)} className="p-1 text-gray-400 hover:text-blue-600">
                                <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteClick(r.id)} className="p-1 text-gray-400 hover:text-red-500">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {showImport && (
                <ImportWizard
                    projectId={0}
                    mode="RESOURCE_MASTER"
                    onClose={() => setShowImport(false)}
                    onSuccess={() => {
                        fetchResources();
                        setShowImport(false);
                    }}
                />
            )}

            {modalState.isOpen && (
                <ResourceModal
                    isOpen={modalState.isOpen}
                    mode={modalState.mode}
                    resourceToEdit={modalState.resourceToEdit}
                    onClose={() => setModalState({ ...modalState, isOpen: false })}
                    onSuccess={() => {
                        fetchResources();
                        toast.success(modalState.mode === 'create' ? "Resource created" : "Resource updated");
                    }}
                />
            )}

            {confirmDelete.isOpen && (
                <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[60] p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Resource?</h3>
                        <p className="text-slate-600 text-sm mb-6">
                            This action cannot be undone. It might affect templates using this resource.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setConfirmDelete({ isOpen: false })}
                                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteConfirm}
                                className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 shadow-lg shadow-red-600/20"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResourceMasterList;
