import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { Link } from 'react-router-dom';
import { Plus, Boxes, ArrowRight, LayoutTemplate, Trash2 } from 'lucide-react';
// useNavigate removed as unused

interface Template {
    id: number;
    templateName: string;
    description: string;
    projectType: string;
    isActive: boolean;
    createdOn: string;
}

const TemplatesPage: React.FC = () => {
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
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <LayoutTemplate className="w-8 h-8 text-blue-600" />
                        WBS Templates
                    </h1>
                    <p className="text-gray-500 mt-1">Manage standard WBS structures for different project types.</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700 shadow-sm transition-all"
                >
                    <Plus className="w-5 h-5 mr-2" /> Create Template
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-400">Loading templates...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {templates.map(tpl => (
                        <div key={tpl.id} className="bg-white border rounded-xl p-5 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-3">
                                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                    <Boxes className="w-6 h-6" />
                                </div>
                                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded font-medium">
                                    {tpl.projectType || 'General'}
                                </span>
                            </div>
                            <h3 className="font-bold text-lg text-gray-800 mb-1">{tpl.templateName}</h3>
                            <p className="text-gray-500 text-sm mb-4 line-clamp-2 h-10">
                                {tpl.description || 'No description provided.'}
                            </p>

                            <div className="flex items-center justify-between border-t pt-4 mt-2">
                                <span className="text-xs text-gray-400">ID: #{tpl.id}</span>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleDelete(tpl.id)}
                                        className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center"
                                        title="Delete Template"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    <Link to={`/dashboard/wbs/templates/${tpl.id}`} className="text-blue-600 text-sm font-medium flex items-center hover:underline">
                                        View Structure <ArrowRight className="w-4 h-4 ml-1" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-70 flex justify-center items-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-[500px] p-6">
                        <h3 className="font-bold text-lg mb-4">New WBS Template</h3>
                        <form onSubmit={handleCreate}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1">Template Name *</label>
                                <input
                                    className="w-full border rounded px-3 py-2"
                                    value={newName} onChange={e => setNewName(e.target.value)} required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-1">Project Type</label>
                                <input
                                    className="w-full border rounded px-3 py-2"
                                    placeholder="e.g. Residential, Infra"
                                    value={newType} onChange={e => setNewType(e.target.value)}
                                />
                            </div>
                            <div className="mb-6">
                                <label className="block text-sm font-medium mb-1">Description</label>
                                <textarea
                                    className="w-full border rounded px-3 py-2 h-24"
                                    value={newDesc} onChange={e => setNewDesc(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 hover:bg-gray-100 rounded">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TemplatesPage;
