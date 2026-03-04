import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Responsive } from 'react-grid-layout';
import { withWidth } from './components/WithWidth';
import { Save, ArrowLeft, Plus, Trash2, GripVertical } from 'lucide-react';
import { dashboardBuilderApi, type DashboardConfig, type WidgetConfig, type DataSourceMeta } from '../../services/dashboard-builder.service';
import WidgetRenderer from './components/WidgetRenderer';
import AddWidgetPanel from './components/AddWidgetPanel';
import WidgetConfigPanel from './components/WidgetConfigPanel';
import 'react-grid-layout/css/styles.css';

const ResponsiveGridLayout = withWidth(Responsive);

const WIDGET_DEFAULTS: Record<string, { w: number; h: number; minW: number; minH: number }> = {
    KPI: { w: 3, h: 2, minW: 2, minH: 2 },
    COUNTER: { w: 2, h: 2, minW: 2, minH: 2 },
    PROGRESS_RING: { w: 2, h: 3, minW: 2, minH: 2 },
    BAR: { w: 6, h: 4, minW: 3, minH: 3 },
    STACKED_BAR: { w: 6, h: 4, minW: 3, minH: 3 },
    LINE: { w: 8, h: 4, minW: 4, minH: 3 },
    AREA: { w: 8, h: 4, minW: 4, minH: 3 },
    PIE: { w: 4, h: 4, minW: 3, minH: 3 },
    DONUT: { w: 4, h: 4, minW: 3, minH: 3 },
    TABLE: { w: 12, h: 5, minW: 6, minH: 3 },
    GAUGE: { w: 3, h: 3, minW: 2, minH: 2 },
    SCURVE: { w: 12, h: 5, minW: 6, minH: 4 },
    GANTT: { w: 12, h: 5, minW: 8, minH: 4 },
    HEATMAP: { w: 6, h: 4, minW: 4, minH: 3 },
    SCATTER: { w: 6, h: 4, minW: 4, minH: 3 },
    RADAR: { w: 4, h: 4, minW: 3, minH: 3 },
    TREEMAP: { w: 6, h: 4, minW: 4, minH: 3 },
    FUNNEL: { w: 4, h: 5, minW: 3, minH: 3 },
    TIMELINE: { w: 12, h: 4, minW: 8, minH: 3 },
};

export default function DashboardDesigner() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [dashboard, setDashboard] = useState<DashboardConfig | null>(null);
    const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
    const [dataSources, setDataSources] = useState<DataSourceMeta[]>([]);
    const [showAddPanel, setShowAddPanel] = useState(false);
    const [selectedWidgetId, setSelectedWidgetId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const [dbRes, dsRes] = await Promise.all([
                    dashboardBuilderApi.getOne(Number(id)),
                    dashboardBuilderApi.getDataSources(),
                ]);
                setDashboard(dbRes.data);
                setWidgets(dbRes.data.widgets || []);
                setDataSources(dsRes.data);
            } catch (err) {
                console.error('Failed to load dashboard', err);
            }
        };
        if (id) load();
    }, [id]);

    const handleLayoutChange = useCallback((layout: any[]) => {
        setWidgets((prev) =>
            prev.map((w) => {
                const layoutItem = layout.find((l: any) => l.i === String(w.id || w.sortOrder));
                if (layoutItem) {
                    return {
                        ...w,
                        gridPosition: { x: layoutItem.x, y: layoutItem.y, w: layoutItem.w, h: layoutItem.h },
                    };
                }
                return w;
            }),
        );
        setDirty(true);
    }, []);

    const handleSave = async () => {
        if (!dashboard?.id) return;
        setSaving(true);
        try {
            // Save layout config
            await dashboardBuilderApi.update(dashboard.id, {
                layoutConfig: { cols: 12, rowHeight: 80 },
            });

            // Save each widget position
            for (const w of widgets) {
                if (w.id) {
                    await dashboardBuilderApi.updateWidget(w.id, {
                        gridPosition: w.gridPosition,
                        queryConfig: w.queryConfig,
                        displayConfig: w.displayConfig,
                    });
                }
            }

            setDirty(false);
        } catch (err) {
            console.error('Save failed', err);
        } finally {
            setSaving(false);
        }
    };

    const handleAddWidget = async (widgetType: string, dataSourceKey: string, title: string) => {
        if (!dashboard?.id) return;
        const defaults = WIDGET_DEFAULTS[widgetType] || { w: 4, h: 3, minW: 2, minH: 2 };
        try {
            const res = await dashboardBuilderApi.addWidget(dashboard.id, {
                widgetType,
                title,
                dataSourceKey,
                queryConfig: {},
                displayConfig: {},
                gridPosition: { x: 0, y: Infinity, w: defaults.w, h: defaults.h },
                refreshIntervalSec: 0,
                sortOrder: widgets.length,
            });
            setWidgets((prev) => [...prev, res.data]);
            setShowAddPanel(false);
        } catch (err) {
            console.error('Failed to add widget', err);
        }
    };

    const handleRemoveWidget = async (widgetId: number) => {
        try {
            await dashboardBuilderApi.removeWidget(widgetId);
            setWidgets((prev) => prev.filter((w) => w.id !== widgetId));
            if (selectedWidgetId === widgetId) setSelectedWidgetId(null);
        } catch (err) {
            console.error('Failed to remove widget', err);
        }
    };

    const handleUpdateWidget = (widgetId: number, updates: Partial<WidgetConfig>) => {
        setWidgets((prev) =>
            prev.map((w) => (w.id === widgetId ? { ...w, ...updates } : w))
        );
        setDirty(true);
    };

    const selectedWidget = widgets.find(w => w.id === selectedWidgetId);
    const selectedDataSource = dataSources.find(ds => ds.key === selectedWidget?.dataSourceKey);

    const gridLayout = widgets.map((w, i) => ({
        i: String(w.id || i),
        x: w.gridPosition?.x ?? 0,
        y: w.gridPosition?.y ?? 0,
        w: w.gridPosition?.w ?? 4,
        h: w.gridPosition?.h ?? 3,
        minW: WIDGET_DEFAULTS[w.widgetType]?.minW ?? 2,
        minH: WIDGET_DEFAULTS[w.widgetType]?.minH ?? 2,
    }));

    if (!dashboard) {
        return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading dashboard...</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8fafc' }}>
            {/* Top Toolbar */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 20px', background: '#fff', borderBottom: '1px solid #e2e8f0',
                position: 'sticky', top: 0, zIndex: 50,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                        onClick={() => navigate('/dashboard/admin/dashboard-builder')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
                            border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff',
                            cursor: 'pointer', color: '#64748b', fontSize: 13, fontWeight: 500,
                        }}
                    >
                        <ArrowLeft size={16} /> Back
                    </button>
                    <div>
                        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
                            {dashboard.name}
                        </h2>
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>
                            {widgets.length} widget{widgets.length !== 1 ? 's' : ''} • {dashboard.scope}
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => setShowAddPanel(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                            border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff',
                            cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#475569',
                        }}
                    >
                        <Plus size={16} /> Add Widget
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !dirty}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px',
                            border: 'none', borderRadius: 8, background: dirty ? '#2563eb' : '#94a3b8',
                            color: '#fff', cursor: dirty ? 'pointer' : 'default',
                            fontWeight: 600, fontSize: 13, opacity: saving ? 0.7 : 1,
                        }}
                    >
                        <Save size={16} /> {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>

            {/* Grid Area */}
            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
                {widgets.length === 0 ? (
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', minHeight: 400, background: '#fff',
                        borderRadius: 16, border: '2px dashed #e2e8f0', textAlign: 'center',
                    }}>
                        <Plus size={48} color="#cbd5e1" style={{ marginBottom: 16 }} />
                        <h3 style={{ color: '#475569', margin: '0 0 8px', fontWeight: 600 }}>
                            Start Building Your Dashboard
                        </h3>
                        <p style={{ color: '#94a3b8', margin: '0 0 16px', maxWidth: 360 }}>
                            Click "Add Widget" to pick a chart type and data source, then drag and resize to arrange your layout
                        </p>
                        <button
                            onClick={() => setShowAddPanel(true)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px',
                                border: 'none', borderRadius: 8, background: '#2563eb', color: '#fff',
                                cursor: 'pointer', fontWeight: 600,
                            }}
                        >
                            <Plus size={16} /> Add Your First Widget
                        </button>
                    </div>
                ) : (
                    <ResponsiveGridLayout
                        className="layout"
                        layouts={{ lg: gridLayout }}
                        breakpoints={{ lg: 1200, md: 996, sm: 768 }}
                        cols={{ lg: 12, md: 10, sm: 6 }}
                        rowHeight={80}
                        margin={[16, 16]}
                        compactType="vertical"
                        isDraggable
                        isResizable
                        draggableHandle=".widget-drag-handle"
                        onLayoutChange={(layout: any[]) => handleLayoutChange(layout)}
                    >
                        {widgets.map((widget, i) => (
                            <div key={String(widget.id || i)} style={{
                                background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
                                overflow: 'hidden', display: 'flex', flexDirection: 'column',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                            }}>
                                {/* Widget Header */}
                                <div style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '8px 12px', borderBottom: '1px solid #f1f5f9',
                                    background: '#fafbfc', minHeight: 36,
                                }}>
                                    <div className="widget-drag-handle" style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        cursor: 'grab', flex: 1,
                                    }}>
                                        <GripVertical size={14} color="#94a3b8" />
                                        <span style={{
                                            fontSize: 13, fontWeight: 600, color: '#334155',
                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                        }}>
                                            {widget.title}
                                        </span>
                                        <span style={{
                                            fontSize: 10, padding: '1px 6px', borderRadius: 4,
                                            background: '#e2e8f0', color: '#64748b', fontWeight: 500,
                                        }}>
                                            {widget.widgetType}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <button
                                            onClick={() => widget.id && setSelectedWidgetId(widget.id)}
                                            style={{
                                                padding: 4, border: 'none', borderRadius: 4, background: 'transparent',
                                                cursor: 'pointer', color: selectedWidgetId === widget.id ? '#2563eb' : '#94a3b8',
                                                display: 'flex',
                                            }}
                                            title="Configure widget"
                                        >
                                            <Plus size={14} style={{ transform: 'rotate(45deg)' }} />
                                        </button>
                                        <button
                                            onClick={() => widget.id && handleRemoveWidget(widget.id)}
                                            style={{
                                                padding: 4, border: 'none', borderRadius: 4, background: 'transparent',
                                                cursor: 'pointer', color: '#94a3b8', display: 'flex',
                                            }}
                                            title="Remove widget"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                {/* Widget Body */}
                                <div style={{ flex: 1, padding: 12, overflow: 'hidden' }}>
                                    <WidgetRenderer widget={widget} isDesignMode />
                                </div>
                            </div>
                        ))}
                    </ResponsiveGridLayout>
                )}
            </div>

            {/* Add Widget Panel */}
            {showAddPanel && (
                <AddWidgetPanel
                    dataSources={dataSources}
                    onAdd={handleAddWidget}
                    onClose={() => setShowAddPanel(false)}
                />
            )}

            {/* Widget Config Panel */}
            {selectedWidget && (
                <WidgetConfigPanel
                    widget={selectedWidget}
                    dataSource={selectedDataSource}
                    onUpdate={(updates) => selectedWidget.id && handleUpdateWidget(selectedWidget.id, updates)}
                    onClose={() => setSelectedWidgetId(null)}
                />
            )}
        </div>
    );
}
