import { useState, useEffect } from 'react';
import { Plus, Trash2, X, Search, CheckSquare, List, GripVertical, Settings2, Image } from 'lucide-react';
import api from '../../../api/axios';

interface Props {
    projectId: number;
}

const QualityChecklist: React.FC<Props> = ({ projectId }) => {
    const [templates, setTemplates] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const defaultStage = {
        name: 'Stage 1',
        sequence: 0,
        isHoldPoint: false,
        items: [
            { itemText: '', type: 'YES_NO', isMandatory: false, photoRequired: false, sequence: 0 }
        ]
    };

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        stages: [{ ...defaultStage }]
    });

    const fetchTemplates = async () => {
        try {
            const response = await api.get(`/quality/checklist-templates/project/${projectId}`);
            setTemplates(response.data);
        } catch (error) {
            console.error('Failed to fetch templates:', error);
        }
    };

    const handleMigrate = async () => {
        if (!confirm('Run migration to convert legacy checklists to new templates?')) return;
        try {
            await api.post(`/quality/checklist-templates/project/${projectId}/migrate`);
            fetchTemplates();
        } catch (error) {
            console.error('Migration failed:', error);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, [projectId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post(`/quality/checklist-templates/project/${projectId}`, formData);
            setIsModalOpen(false);
            resetForm();
            fetchTemplates();
        } catch (error) {
            console.error('Failed to save template:', error);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this template?')) return;
        try {
            await api.delete(`/quality/checklist-templates/${id}`);
            fetchTemplates();
        } catch (error) {
            console.error(error);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            stages: [{ ...defaultStage }]
        });
    };

    const addStage = () => {
        setFormData(prev => ({
            ...prev,
            stages: [
                ...prev.stages,
                { name: `Stage ${prev.stages.length + 1}`, sequence: prev.stages.length, isHoldPoint: false, items: [] }
            ]
        }));
    };

    const removeStage = (sIndex: number) => {
        const newStages = [...formData.stages];
        newStages.splice(sIndex, 1);
        setFormData(prev => ({ ...prev, stages: newStages }));
    };

    const updateStage = (sIndex: number, field: string, value: any) => {
        const newStages = [...formData.stages];
        newStages[sIndex] = { ...newStages[sIndex], [field]: value };
        setFormData(prev => ({ ...prev, stages: newStages }));
    };

    const addItem = (sIndex: number) => {
        const newStages = [...formData.stages];
        newStages[sIndex].items.push({ itemText: '', type: 'YES_NO', isMandatory: false, photoRequired: false, sequence: newStages[sIndex].items.length });
        setFormData(prev => ({ ...prev, stages: newStages }));
    };

    const removeItem = (sIndex: number, iIndex: number) => {
        const newStages = [...formData.stages];
        newStages[sIndex].items.splice(iIndex, 1);
        setFormData(prev => ({ ...prev, stages: newStages }));
    };

    const updateItem = (sIndex: number, iIndex: number, field: string, value: any) => {
        const newStages = [...formData.stages];
        newStages[sIndex].items[iIndex] = { ...newStages[sIndex].items[iIndex], [field]: value };
        setFormData(prev => ({ ...prev, stages: newStages }));
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4 bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100 w-96 focus-within:ring-2 focus-within:ring-orange-500 transition-all">
                    <Search className="w-5 h-5 text-gray-400" />
                    <input type="text" placeholder="Search checklist templates..." className="bg-transparent border-none focus:ring-0 text-sm w-full p-0" />
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleMigrate}
                        className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-200 transition-all font-medium"
                    >
                        <Settings2 className="w-4 h-4" />
                        Migrate Legacy
                    </button>
                    <button
                        onClick={() => { resetForm(); setIsModalOpen(true); }}
                        className="flex items-center gap-2 bg-orange-600 text-white px-6 py-2.5 rounded-xl hover:bg-orange-700 transition-all shadow-lg shadow-orange-200"
                    >
                        <Plus className="w-5 h-5" />
                        <span className="font-bold">New Template</span>
                    </button>
                </div>
            </div>

            {/* Template List */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {templates.map((template) => (
                    <div key={template.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-all group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                                    <List className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900 text-lg">{template.name}</h4>
                                    <p className="text-sm text-gray-500">{template.description || 'No description'}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleDelete(template.id)} className="p-2 hover:bg-red-50 rounded-xl text-red-600 transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>

                        <div className="mt-6 space-y-3">
                            {template.stages?.map((stage: any, idx: number) => (
                                <div key={stage.id || idx} className="flex flex-col bg-gray-50 rounded-xl p-3 border border-gray-100">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                            {stage.name}
                                        </span>
                                        <span className="text-xs font-bold bg-white px-2 py-1 rounded shadow-sm text-gray-500">
                                            {stage.items?.length || 0} Items
                                        </span>
                                    </div>
                                    <div className="pl-4 border-l-2 border-indigo-100 ml-1 space-y-1">
                                        {stage.items?.slice(0, 2).map((item: any, i: number) => (
                                            <div key={item.id || i} className="text-xs text-gray-600 flex items-center gap-2 truncate">
                                                <CheckSquare className="w-3 h-3 text-gray-400" />
                                                {item.itemText}
                                            </div>
                                        ))}
                                        {stage.items?.length > 2 && (
                                            <div className="text-xs font-medium text-indigo-500 pl-5 pt-1">
                                                + {stage.items.length - 2} more items...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {templates.length === 0 && (
                    <div className="col-span-full py-12 text-center text-gray-500">
                        <CheckSquare className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-1">No Templates Found</h3>
                        <p>Create a new template or migrate legacy checklists to get started.</p>
                    </div>
                )}
            </div>

            {/* Template Builder Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-full flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

                        {/* Header */}
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                                    <Settings2 className="w-6 h-6 text-orange-600" />
                                    Interactive Template Builder
                                </h2>
                                <p className="text-sm text-gray-500 mt-1">Design multi-stage quality inspections with mandatory hold points.</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 bg-white hover:bg-gray-100 border border-gray-200 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 custom-scrollbar">
                            <form id="templateForm" onSubmit={handleSubmit} className="space-y-8 max-w-4xl mx-auto">

                                {/* Template Details */}
                                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                                    <h3 className="text-lg font-bold text-gray-900 border-b pb-3">1. Template Details</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Template Name</label>
                                            <input
                                                type="text" required
                                                placeholder="e.g., Pre-concreting Columns"
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Description / Scope</label>
                                            <input
                                                type="text"
                                                placeholder="Optional details..."
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
                                                value={formData.description}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Stages Builder */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-bold text-gray-900">2. Stages & Items</h3>
                                        <button type="button" onClick={addStage} className="flex items-center gap-2 text-sm font-bold text-orange-600 hover:text-orange-700 bg-orange-50 px-4 py-2 rounded-lg">
                                            <Plus className="w-4 h-4" /> Add Stage
                                        </button>
                                    </div>

                                    <div className="space-y-6">
                                        {formData.stages.map((stage, sIndex) => (
                                            <div key={sIndex} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                                                {/* Stage Header */}
                                                <div className="bg-gray-100/80 px-4 py-3 border-b border-gray-200 flex flex-wrap items-center gap-4">
                                                    <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />
                                                    <input
                                                        type="text" required
                                                        placeholder="Stage Name (e.g. Pre-pour)"
                                                        className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-bold w-48 focus:ring-2 focus:ring-indigo-500"
                                                        value={stage.name}
                                                        onChange={(e) => updateStage(sIndex, 'name', e.target.value)}
                                                    />
                                                    <label className="flex items-center gap-2 text-sm text-gray-700 ml-auto bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:bg-gray-50">
                                                        <input
                                                            type="checkbox"
                                                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                                            checked={stage.isHoldPoint}
                                                            onChange={(e) => updateStage(sIndex, 'isHoldPoint', e.target.checked)}
                                                        />
                                                        <span className="font-medium text-red-600">Mandatory Hold Point</span>
                                                    </label>
                                                    <button type="button" onClick={() => removeStage(sIndex)} className="p-1.5 text-gray-400 hover:bg-gray-200 hover:text-red-500 rounded-lg transition-colors">
                                                        <X className="w-5 h-5" />
                                                    </button>
                                                </div>

                                                {/* Items List */}
                                                <div className="p-4 space-y-3">
                                                    {stage.items.map((item, iIndex) => (
                                                        <div key={iIndex} className="flex items-start gap-4 p-3 bg-gray-50/50 rounded-xl border border-dotted border-gray-300 group hover:border-gray-400 transition-colors">
                                                            <div className="flex-1 space-y-3">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="flex-1">
                                                                        <input
                                                                            type="text" required
                                                                            placeholder="Checklist Item Description..."
                                                                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                                                                            value={item.itemText}
                                                                            onChange={(e) => updateItem(sIndex, iIndex, 'itemText', e.target.value)}
                                                                        />
                                                                    </div>
                                                                    <select
                                                                        className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-indigo-500 w-36"
                                                                        value={item.type}
                                                                        onChange={(e) => updateItem(sIndex, iIndex, 'type', e.target.value)}
                                                                    >
                                                                        <option value="YES_NO">Pass / Fail</option>
                                                                        <option value="TEXT">Text Input</option>
                                                                        <option value="NUMERIC">Numeric</option>
                                                                        <option value="PHOTO_ONLY">Photo Evidence</option>
                                                                    </select>
                                                                </div>

                                                                {/* Item Meta Switches */}
                                                                <div className="flex items-center gap-6 pl-1">
                                                                    <label className="flex items-center gap-2 cursor-pointer group/switch">
                                                                        <div className="relative">
                                                                            <input type="checkbox" className="sr-only" checked={item.isMandatory} onChange={(e) => updateItem(sIndex, iIndex, 'isMandatory', e.target.checked)} />
                                                                            <div className={`block w-8 h-4 rounded-full transition-colors ${item.isMandatory ? 'bg-indigo-500' : 'bg-gray-300'}`}></div>
                                                                            <div className={`dot absolute left-1 top-1 bg-white w-2 h-2 rounded-full transition-transform ${item.isMandatory ? 'transform translate-x-4' : ''}`}></div>
                                                                        </div>
                                                                        <span className="text-xs font-semibold text-gray-500 group-hover/switch:text-gray-700">Required</span>
                                                                    </label>

                                                                    <label className="flex items-center gap-2 cursor-pointer group/switch">
                                                                        <div className="relative">
                                                                            <input type="checkbox" className="sr-only" checked={item.photoRequired} onChange={(e) => updateItem(sIndex, iIndex, 'photoRequired', e.target.checked)} />
                                                                            <div className={`block w-8 h-4 rounded-full transition-colors ${item.photoRequired ? 'bg-orange-500' : 'bg-gray-300'}`}></div>
                                                                            <div className={`dot absolute left-1 top-1 bg-white w-2 h-2 rounded-full transition-transform ${item.photoRequired ? 'transform translate-x-4' : ''}`}></div>
                                                                        </div>
                                                                        <span className="text-xs font-semibold text-gray-500 group-hover/switch:text-gray-700 flex items-center gap-1">
                                                                            <Image className="w-3 h-3" /> Photo Proof Req.
                                                                        </span>
                                                                    </label>
                                                                </div>
                                                            </div>

                                                            <button type="button" onClick={() => removeItem(sIndex, iIndex)} className="mt-2 p-1.5 text-gray-400 hover:bg-white hover:text-red-500 rounded-lg border border-transparent hover:border-red-200 transition-all opacity-0 group-hover:opacity-100 shadow-sm">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ))}

                                                    <button type="button" onClick={() => addItem(sIndex)} className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 font-medium text-sm hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex justify-center items-center gap-2 mt-2">
                                                        <Plus className="w-4 h-4" /> Add Item
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                </div>
                            </form>
                        </div>

                        {/* Footer */}
                        <div className="p-5 border-t bg-white flex justify-end gap-3 rounded-b-3xl">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-all">
                                Cancel
                            </button>
                            <button form="templateForm" type="submit" className="px-8 py-2.5 rounded-xl font-bold bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-orange-200/50 transition-all flex items-center gap-2">
                                <CheckSquare className="w-5 h-5" />
                                Save & Publish Template
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};

export default QualityChecklist;
