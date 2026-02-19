import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { FileText, Plus, Download, Upload, Trash2, Edit2, Search } from 'lucide-react';
import type { PdfTemplate } from '../../types/template.types';

interface TemplateListProps {
    onEdit: (template: PdfTemplate) => void;
    onCreateNew: () => void;
}

const TemplateList = ({ onEdit, onCreateNew }: TemplateListProps) => {
    const [templates, setTemplates] = useState<PdfTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const response = await api.get('/pdf-templates');
            setTemplates(response.data);
        } catch (error) {
            console.error('Failed to fetch templates:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this template?')) return;
        try {
            await api.delete(`/pdf-templates/${id}`);
            setTemplates(prev => prev.filter(t => t.id !== id));
        } catch (error) {
            console.error('Failed to delete template:', error);
        }
    };

    const handleExport = async (template: PdfTemplate) => {
        try {
            const response = await api.get(`/pdf-templates/${template.id}/export`);
            const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${template.name.replace(/\s+/g, '_').toLowerCase()}.setu-template.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export template:', error);
        }
    };

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const templateData = JSON.parse(text);
            await api.post('/pdf-templates/import', { templateData });
            fetchTemplates();
        } catch (error) {
            console.error('Failed to import template:', error);
            alert('Failed to import template. Please check the file format.');
        }
        event.target.value = '';
    };

    const filteredTemplates = templates.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const categories = ['all', 'work_order', 'invoice', 'boq', 'custom'];

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading templates...</div>;
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-blue-600" />
                    <h2 className="text-xl font-bold text-gray-800">PDF Templates</h2>
                </div>
                <div className="flex gap-2">
                    <label className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer transition-colors">
                        <Upload size={16} />
                        Import
                        <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                    </label>
                    <button
                        onClick={onCreateNew}
                        className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus size={16} />
                        New Template
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4 mb-6">
                <div className="relative flex-1 max-w-md">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search templates..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
                <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                    {categories.map(cat => (
                        <option key={cat} value={cat}>
                            {cat === 'all' ? 'All Categories' : cat.replace('_', ' ').toUpperCase()}
                        </option>
                    ))}
                </select>
            </div>

            {/* Template Grid */}
            {filteredTemplates.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                    <FileText size={48} className="mx-auto mb-4 opacity-30" />
                    <p>No templates found. Create your first template!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTemplates.map(template => (
                        <div
                            key={template.id}
                            className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-gray-800 truncate">{template.name}</h3>
                                    <span className="inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded mt-1">
                                        {template.category.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>
                            {template.description && (
                                <p className="text-sm text-gray-500 mb-4 line-clamp-2">{template.description}</p>
                            )}
                            <div className="text-xs text-gray-400 mb-4">
                                Updated: {new Date(template.updatedAt).toLocaleDateString()}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => onEdit(template)}
                                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                >
                                    <Edit2 size={14} />
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleExport(template)}
                                    className="px-3 py-2 text-sm bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                                    title="Export as JSON"
                                >
                                    <Download size={14} />
                                </button>
                                <button
                                    onClick={() => handleDelete(template.id)}
                                    className="px-3 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                    title="Delete"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TemplateList;
