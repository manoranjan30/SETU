import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { Link } from 'react-router-dom';
import { Plus, Boxes, ArrowRight, LayoutTemplate, Trash2 } from 'lucide-react';

interface Template {
    id: number;
    templateName: string;
    description: string;
    projectType: string;
    isActive: boolean;
    createdOn: string;
}

const WbsTemplates: React.FC = () => {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Create Form
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newType, setNewType] = useState('');

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const res = await api.get('/wbs/templates');
            setTemplates(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/wbs/templates', {
                templateName: newName,
                description: newDesc,
                projectType: newType
            });
            setIsCreateModalOpen(false);
            setNewName('');
            setNewDesc('');
            setNewType('');
            fetchTemplates();
        } catch (err) {
            alert('Failed to create template');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this template? This cannot be undone.')) return;
        try {
            await api.delete(`/wbs/templates/${id}`);
            fetchTemplates();
        } catch (err) {
            alert('Failed to delete template');
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <LayoutTemplate className="w-6 h-6 text-blue-600" />
                        Standard WBS Templates
                    </h2>
                    <p className="text-sm text-gray-500">Manage standard structures that can be imported into any project.</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700 shadow-sm transition-all text-sm"
                >
                    <Plus className="w-4 h-4 mr-2" /> Create Template
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-400">Loading templates...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pr-2">
                    {templates.map(tpl => (
                        <div key={tpl.id} className="bg-white border rounded-xl p-5 hover:shadow-sm transition-shadow">
                            <div className="flex justify-between items-start mb-3">
                                <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
                                    <Boxes className="w-5 h-5" />
                                </div>
                                <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-1 rounded font-bold uppercase">
                                    {tpl.projectType || 'General'}
                                </span>
                            </div>
                            <h3 className="font-bold text-base text-gray-800 mb-1">{tpl.templateName}</h3>
                            <p className="text-gray-500 text-xs mb-4 line-clamp-2 h-8">
                                {tpl.description || 'No description provided.'}
                            </p>

                            <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-2">
                                <span className="text-[10px] text-gray-400 font-mono">ID: #{tpl.id}</span>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleDelete(tpl.id)}
                                        className="text-red-400 hover:text-red-600 transition-colors"
                                        title="Delete Template"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    <Link to={`/dashboard/wbs/templates/${tpl.id}`} className="text-blue-600 text-xs font-bold flex items-center hover:underline">
                                        View Details <ArrowRight className="w-3.5 h-3.5 ml-1" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex justify-center items-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-[450px] p-6">
                        <h3 className="font-bold text-lg mb-4">New WBS Template</h3>
                        <form onSubmit={handleCreate}>
                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Template Name *</label>
                                    <input
                                        className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={newName} onChange={e => setNewName(e.target.value)} required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Project Type</label>
                                    <input
                                        className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="e.g. Residential, Infra"
                                        value={newType} onChange={e => setNewType(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                                    <textarea
                                        className="w-full border rounded px-3 py-2 h-20 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={newDesc} onChange={e => setNewDesc(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-sm font-medium hover:bg-gray-100 rounded-md">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">Create Template</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WbsTemplates;
