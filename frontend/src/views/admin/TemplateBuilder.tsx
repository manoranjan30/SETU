import { useState } from 'react';
import axios from 'axios';
import TemplateList from '../../components/template-builder/TemplateList';
import TemplateEditor from '../../components/template-builder/TemplateEditor';
import type { PdfTemplate } from '../../types/template.types';

type ViewMode = 'list' | 'editor';

const TemplateBuilder = () => {
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [editingTemplate, setEditingTemplate] = useState<PdfTemplate | null>(null);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

    const handleCreateNew = () => {
        setEditingTemplate(null);
        setViewMode('editor');
    };

    const handleEdit = (template: PdfTemplate) => {
        setEditingTemplate(template);
        setViewMode('editor');
    };

    const handleSave = async (templateData: Partial<PdfTemplate>) => {
        try {
            if (templateData.id) {
                // Update existing
                await axios.put(`${API_URL}/api/pdf-templates/${templateData.id}`, {
                    name: templateData.name,
                    category: templateData.category,
                    description: templateData.description,
                    templateJson: templateData.templateJson,
                });
            } else {
                // Create new
                await axios.post(`${API_URL}/api/pdf-templates`, {
                    name: templateData.name,
                    category: templateData.category || 'custom',
                    description: templateData.description || '',
                    templateJson: templateData.templateJson || { zones: [], extractionMode: 'all_pages' },
                });
            }
            setViewMode('list');
            setEditingTemplate(null);
        } catch (error: any) {
            console.error('Save failed:', error);
            const message = error.response?.data?.message || error.message || 'Unknown error';
            throw new Error(`Failed to save template: ${message}`);
        }
    };

    const handleCancel = () => {
        setViewMode('list');
        setEditingTemplate(null);
    };

    return (
        <div className="h-full flex flex-col">
            {viewMode === 'list' && (
                <TemplateList onEdit={handleEdit} onCreateNew={handleCreateNew} />
            )}
            {viewMode === 'editor' && (
                <TemplateEditor
                    template={editingTemplate}
                    onSave={handleSave}
                    onCancel={handleCancel}
                />
            )}
        </div>
    );
};

export default TemplateBuilder;
