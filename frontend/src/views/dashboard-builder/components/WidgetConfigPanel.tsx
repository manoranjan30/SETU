import { useState } from 'react';
import { X } from 'lucide-react';
import { type WidgetConfig, type DataSourceMeta } from '../../../services/dashboard-builder.service';

interface Props {
    widget: WidgetConfig;
    dataSource: DataSourceMeta | undefined;
    onUpdate: (updates: Partial<WidgetConfig>) => void;
    onClose: () => void;
}

export default function WidgetConfigPanel({ widget, dataSource, onUpdate, onClose }: Props) {
    const [title, setTitle] = useState(widget.title);
    const [refreshInterval, setRefreshInterval] = useState(widget.refreshIntervalSec);
    const [queryConfig, setQueryConfig] = useState(widget.queryConfig || {});
    const [displayConfig, setDisplayConfig] = useState(widget.displayConfig || {});

    // Save on every change or on explicit save?
    // Let's do granular updates to provide real-time preview in the designer

    const updateField = (section: 'queryConfig' | 'displayConfig', key: string, value: any) => {
        const current = section === 'queryConfig' ? queryConfig : displayConfig;
        const setter = section === 'queryConfig' ? setQueryConfig : setDisplayConfig;

        const next = { ...current, [key]: value };
        setter(next);
        onUpdate({ [section]: next });
    };

    const handleTitleChange = (val: string) => {
        setTitle(val);
        onUpdate({ title: val });
    };

    const fields = dataSource?.fields || [];

    return (
        <div style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: 340,
            background: '#fff', borderLeft: '1px solid #e2e8f0', zIndex: 100,
            display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 12px rgba(0,0,0,0.05)'
        }}>
            {/* Panel Header */}
            <div style={{
                padding: '16px 20px', borderBottom: '1px solid #f1f5f9',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: '#f8fafc'
            }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Widget Options</h3>
                    <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>{widget.widgetType}</span>
                </div>
                <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
                    <X size={20} />
                </button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
                {/* Basic Settings */}
                <div style={{ marginBottom: 24 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Title</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}
                    />
                </div>

                <div style={{ marginBottom: 24 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Auto Refresh (Seconds)</label>
                    <select
                        value={refreshInterval}
                        onChange={(e) => {
                            const val = Number(e.target.value);
                            setRefreshInterval(val);
                            onUpdate({ refreshIntervalSec: val });
                        }}
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}
                    >
                        <option value={0}>Disabled</option>
                        <option value={30}>30 Seconds</option>
                        <option value={60}>1 Minute</option>
                        <option value={300}>5 Minutes</option>
                        <option value={900}>15 Minutes</option>
                    </select>
                </div>

                {/* Data Mapping - AXES / Series */}
                {(['BAR', 'LINE', 'AREA', 'PIE', 'DONUT', 'SCATTER'].includes(widget.widgetType)) && (
                    <div style={{ marginBottom: 24 }}>
                        <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', borderTop: '1px solid #f1f5f9', paddingTop: 16, marginBottom: 16 }}>Data Mapping</h4>

                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Label Column (X-Axis)</label>
                            <select
                                value={queryConfig.labelField || ''}
                                onChange={(e) => updateField('queryConfig', 'labelField', e.target.value)}
                                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}
                            >
                                <option value="">Select Field...</option>
                                {fields.map(f => <option key={f.key} value={f.key}>{f.label || f.key}</option>)}
                            </select>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Value Column(s) (Y-Axis)</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {fields.filter(f => f.type === 'number').map(f => (
                                    <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#475569', padding: '4px 8px', background: '#f8fafc', borderRadius: 6, cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={(queryConfig.valueFields || []).includes(f.key)}
                                            onChange={(e) => {
                                                const current = queryConfig.valueFields || [];
                                                const next = e.target.checked
                                                    ? [...current, f.key]
                                                    : current.filter((k: string) => k !== f.key);
                                                updateField('queryConfig', 'valueFields', next);
                                            }}
                                        />
                                        {f.label || f.key}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Display Styling */}
                <div style={{ marginBottom: 24 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', borderTop: '1px solid #f1f5f9', paddingTop: 16, marginBottom: 16 }}>Appearance</h4>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#475569', marginBottom: 12, cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={displayConfig.showLegend !== false}
                            onChange={(e) => updateField('displayConfig', 'showLegend', e.target.checked)}
                        />
                        Show Legend
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#475569', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={displayConfig.showGrid !== false}
                            onChange={(e) => updateField('displayConfig', 'showGrid', e.target.checked)}
                        />
                        Show Grid Lines
                    </label>
                </div>
            </div>

            {/* Panel Footer */}
            <div style={{ padding: 16, borderTop: '1px solid #f1f5f9' }}>
                <button
                    onClick={onClose}
                    style={{
                        width: '100%', padding: '10px', borderRadius: 8,
                        background: '#1e293b', color: '#fff', fontWeight: 600,
                        border: 'none', cursor: 'pointer'
                    }}
                >
                    Done
                </button>
            </div>
        </div>
    );
}
