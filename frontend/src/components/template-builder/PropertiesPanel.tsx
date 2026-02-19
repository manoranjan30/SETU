import { useState } from 'react';
import { Trash2, Plus, Settings2, Target, Hash, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import type { TemplateZone, TemplateField, ZoneType, ExtractionStrategy, RelativePosition } from '../../types/template.types';

interface PropertiesPanelProps {
    zone: TemplateZone | null;
    onZoneUpdate: (zone: TemplateZone) => void;
    onZoneDelete: (zoneId: string) => void;
}

const ZONE_TYPES: { value: ZoneType; label: string; icon: string }[] = [
    { value: 'header', label: 'Header (Title Fields)', icon: '📋' },
    { value: 'label_value', label: 'Label → Value Pair', icon: '🏷️' },
    { value: 'table', label: 'Table (Rows)', icon: '📊' },
    { value: 'multiline', label: 'Multiline Text', icon: '📝' },
    { value: 'list', label: 'Vertical List', icon: '📑' },
    { value: 'date_field', label: 'Date Field', icon: '📅' },
    { value: 'amount_field', label: 'Amount/Currency', icon: '💰' },
];

const EXTRACTION_STRATEGIES: { value: ExtractionStrategy; label: string; description: string }[] = [
    { value: 'auto', label: 'Auto', description: 'Tries anchor → regex → coordinates' },
    { value: 'anchor', label: 'Anchor', description: 'Find text label, extract nearby' },
    { value: 'regex', label: 'Regex', description: 'Match pattern on page' },
    { value: 'coordinates', label: 'Coordinates', description: 'Fixed position (legacy)' },
];

const RELATIVE_POSITIONS: { value: RelativePosition; label: string }[] = [
    { value: 'right', label: 'Right of anchor' },
    { value: 'below', label: 'Below anchor' },
    { value: 'inline', label: 'Same line' },
    { value: 'above', label: 'Above anchor' },
    { value: 'left', label: 'Left of anchor' },
];

const PropertiesPanel = ({ zone, onZoneUpdate, onZoneDelete }: PropertiesPanelProps) => {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);

    if (!zone) {
        return (
            <div className="h-full flex items-center justify-center bg-white border-l border-gray-200 p-6">
                <div className="text-center text-gray-400">
                    <Settings2 size={32} className="mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Select a zone to edit</p>
                    <p className="text-xs mt-1">or draw a new zone</p>
                </div>
            </div>
        );
    }

    const handleTypeChange = (type: ZoneType) => {
        onZoneUpdate({ ...zone, type });
    };

    const handleStrategyChange = (strategy: ExtractionStrategy) => {
        onZoneUpdate({ ...zone, extractionStrategy: strategy });
    };

    const handleAnchorChange = (field: string, value: string | number) => {
        onZoneUpdate({
            ...zone,
            anchor: {
                anchorText: zone.anchor?.anchorText || '',
                relativePosition: zone.anchor?.relativePosition || 'right',
                ...zone.anchor,
                [field]: value,
            },
        });
    };

    // Field management
    const addField = () => {
        const newField: TemplateField = {
            key: `field_${Date.now()}`,
            label: 'New Field',
            type: 'text',
            required: false,
        };
        onZoneUpdate({ ...zone, fields: [...zone.fields, newField] });
        setEditingFieldIndex(zone.fields.length);
    };

    const updateField = (index: number, updates: Partial<TemplateField>) => {
        const newFields = [...zone.fields];
        newFields[index] = { ...newFields[index], ...updates };
        onZoneUpdate({ ...zone, fields: newFields });
    };

    const deleteField = (index: number) => {
        const newFields = zone.fields.filter((_, i) => i !== index);
        onZoneUpdate({ ...zone, fields: newFields });
        setEditingFieldIndex(null);
    };

    const selectedZoneType = ZONE_TYPES.find(t => t.value === zone.type);

    return (
        <div className="h-full flex flex-col bg-white border-l border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                        <span className="text-lg">{selectedZoneType?.icon || '📋'}</span>
                        Zone Properties
                    </h3>
                    <button
                        onClick={() => onZoneDelete(zone.id)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete Zone"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
                {/* Zone Name */}
                <div className="p-4 border-b border-gray-100">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Zone Name</label>
                    <input
                        type="text"
                        value={zone.name}
                        onChange={(e) => onZoneUpdate({ ...zone, name: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Work Order Header"
                    />
                </div>

                {/* Zone Type */}
                <div className="p-4 border-b border-gray-100">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Zone Type</label>
                    <select
                        value={zone.type}
                        onChange={(e) => handleTypeChange(e.target.value as ZoneType)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        {ZONE_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                        ))}
                    </select>
                </div>

                {/* Extraction Strategy */}
                <div className="p-4 border-b border-gray-100">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Extraction Strategy</label>
                    <div className="grid grid-cols-2 gap-2">
                        {EXTRACTION_STRATEGIES.map(s => (
                            <button
                                key={s.value}
                                onClick={() => handleStrategyChange(s.value)}
                                className={`px-3 py-2 text-xs rounded-lg border transition-colors text-left ${zone.extractionStrategy === s.value
                                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                                        : 'border-gray-200 hover:bg-gray-50'
                                    }`}
                            >
                                <span className="font-medium">{s.label}</span>
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                        {EXTRACTION_STRATEGIES.find(s => s.value === zone.extractionStrategy)?.description}
                    </p>
                </div>

                {/* Anchor Configuration (for anchor strategy) */}
                {(zone.extractionStrategy === 'anchor' || zone.extractionStrategy === 'auto') && (
                    <div className="p-4 border-b border-gray-100 bg-amber-50/50">
                        <label className="flex items-center gap-2 text-xs font-medium text-amber-700 mb-3">
                            <Target size={14} />
                            Anchor Configuration
                        </label>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Anchor Text</label>
                                <input
                                    type="text"
                                    value={zone.anchor?.anchorText || ''}
                                    onChange={(e) => handleAnchorChange('anchorText', e.target.value)}
                                    placeholder="e.g., Work Order No:"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Value Position</label>
                                <select
                                    value={zone.anchor?.relativePosition || 'right'}
                                    onChange={(e) => handleAnchorChange('relativePosition', e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                                >
                                    {RELATIVE_POSITIONS.map(p => (
                                        <option key={p.value} value={p.value}>{p.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Fallback Regex (optional)</label>
                                <input
                                    type="text"
                                    value={zone.anchor?.fallbackRegex || ''}
                                    onChange={(e) => handleAnchorChange('fallbackRegex', e.target.value)}
                                    placeholder="e.g., WO-\d+"
                                    className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Fields Section */}
                <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                        <label className="flex items-center gap-2 text-xs font-medium text-gray-500">
                            <Hash size={14} />
                            Detected Fields ({zone.fields.length})
                        </label>
                        <button
                            onClick={addField}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                        >
                            <Plus size={12} />
                            Add Field
                        </button>
                    </div>

                    {zone.fields.length === 0 ? (
                        <p className="text-xs text-gray-400 py-4 text-center bg-gray-50 rounded">
                            No fields detected. Draw zone over text to auto-detect.
                        </p>
                    ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {zone.fields.map((field, index) => (
                                <div
                                    key={field.key}
                                    className={`border rounded-lg transition-colors ${editingFieldIndex === index
                                            ? 'border-blue-300 bg-blue-50/50'
                                            : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <div
                                        className="flex items-center gap-2 p-2 cursor-pointer"
                                        onClick={() => setEditingFieldIndex(editingFieldIndex === index ? null : index)}
                                    >
                                        <GripVertical size={14} className="text-gray-300" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-700 truncate">{field.label}</p>
                                            <p className="text-xs text-gray-400 font-mono">{field.key}</p>
                                        </div>
                                        <span className="px-1.5 py-0.5 text-xs bg-gray-100 rounded">{field.type}</span>
                                        {editingFieldIndex === index ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </div>

                                    {editingFieldIndex === index && (
                                        <div className="p-3 pt-0 border-t border-gray-100 space-y-2">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-xs text-gray-400 mb-1">Key</label>
                                                    <input
                                                        type="text"
                                                        value={field.key}
                                                        onChange={(e) => updateField(index, { key: e.target.value })}
                                                        className="w-full px-2 py-1 text-xs font-mono border border-gray-200 rounded"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-400 mb-1">Label</label>
                                                    <input
                                                        type="text"
                                                        value={field.label}
                                                        onChange={(e) => updateField(index, { label: e.target.value })}
                                                        className="w-full px-2 py-1 text-xs border border-gray-200 rounded"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-xs text-gray-400 mb-1">Type</label>
                                                    <select
                                                        value={field.type}
                                                        onChange={(e) => updateField(index, { type: e.target.value as any })}
                                                        className="w-full px-2 py-1 text-xs border border-gray-200 rounded"
                                                    >
                                                        <option value="text">Text</option>
                                                        <option value="number">Number</option>
                                                        <option value="date">Date</option>
                                                        <option value="currency">Currency</option>
                                                        <option value="regex">Custom Regex</option>
                                                    </select>
                                                </div>
                                                <div className="flex items-end">
                                                    <label className="flex items-center gap-2 text-xs text-gray-600">
                                                        <input
                                                            type="checkbox"
                                                            checked={field.required}
                                                            onChange={(e) => updateField(index, { required: e.target.checked })}
                                                            className="rounded"
                                                        />
                                                        Required
                                                    </label>
                                                </div>
                                            </div>
                                            {field.type === 'regex' && (
                                                <div>
                                                    <label className="block text-xs text-gray-400 mb-1">Regex Pattern</label>
                                                    <input
                                                        type="text"
                                                        value={field.regex || ''}
                                                        onChange={(e) => updateField(index, { regex: e.target.value })}
                                                        placeholder="e.g., \d{4}-\d{2}-\d{2}"
                                                        className="w-full px-2 py-1 text-xs font-mono border border-gray-200 rounded"
                                                    />
                                                </div>
                                            )}
                                            <button
                                                onClick={() => deleteField(index)}
                                                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                                            >
                                                <Trash2 size={12} />
                                                Delete field
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Bounds (Advanced) */}
                <div className="p-4">
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700"
                    >
                        {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        Advanced: Zone Coordinates
                    </button>
                    {showAdvanced && (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">X</label>
                                <input
                                    type="number"
                                    value={Math.round(zone.bounds.x)}
                                    onChange={(e) => onZoneUpdate({ ...zone, bounds: { ...zone.bounds, x: Number(e.target.value) } })}
                                    className="w-full px-2 py-1 text-xs font-mono border border-gray-200 rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Y</label>
                                <input
                                    type="number"
                                    value={Math.round(zone.bounds.y)}
                                    onChange={(e) => onZoneUpdate({ ...zone, bounds: { ...zone.bounds, y: Number(e.target.value) } })}
                                    className="w-full px-2 py-1 text-xs font-mono border border-gray-200 rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Width</label>
                                <input
                                    type="number"
                                    value={Math.round(zone.bounds.w)}
                                    onChange={(e) => onZoneUpdate({ ...zone, bounds: { ...zone.bounds, w: Number(e.target.value) } })}
                                    className="w-full px-2 py-1 text-xs font-mono border border-gray-200 rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Height</label>
                                <input
                                    type="number"
                                    value={Math.round(zone.bounds.h)}
                                    onChange={(e) => onZoneUpdate({ ...zone, bounds: { ...zone.bounds, h: Number(e.target.value) } })}
                                    className="w-full px-2 py-1 text-xs font-mono border border-gray-200 rounded"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-500 text-center">
                    ✨ Drag zone corners to resize
                </p>
            </div>
        </div>
    );
};

export default PropertiesPanel;
