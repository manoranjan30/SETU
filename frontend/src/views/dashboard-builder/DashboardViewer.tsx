import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Responsive } from 'react-grid-layout';
import { withWidth } from './components/WithWidth';
import { RefreshCw, LayoutDashboard, Share2, Maximize2, Download } from 'lucide-react';
import { dashboardBuilderApi, type DashboardConfig, type WidgetConfig } from '../../services/dashboard-builder.service';
import WidgetRenderer from './components/WidgetRenderer';
import { exportUtils } from '../../utils/export.utils';
import 'react-grid-layout/css/styles.css';

const ResponsiveGridLayout = withWidth(Responsive);

export default function DashboardViewer() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [dashboard, setDashboard] = useState<DashboardConfig | null>(null);
    const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                let res;
                if (id) {
                    res = await dashboardBuilderApi.getOne(Number(id));
                } else {
                    res = await dashboardBuilderApi.getDefaults();
                    // If no default dashboard is assigned, res.data might be empty or a specific structure
                    // For now, assume it returns the dashboard config
                }

                if (res.data) {
                    setDashboard(res.data);
                    setWidgets(res.data.widgets || []);
                }
            } catch (err) {
                console.error('Failed to load dashboard', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, refreshKey]);

    const handleRefreshAll = () => {
        setRefreshKey(prev => prev + 1);
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                <RefreshCw size={32} className="animate-spin" style={{ marginBottom: 16, opacity: 0.5 }} />
                <p>Loading your dashboard...</p>
            </div>
        );
    }

    if (!dashboard) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 40, textAlign: 'center' }}>
                <LayoutDashboard size={64} color="#e2e8f0" style={{ marginBottom: 24 }} />
                <h2 style={{ color: '#1e293b', marginBottom: 8 }}>No Dashboard Found</h2>
                <p style={{ color: '#64748b', maxWidth: 400, marginBottom: 24 }}>
                    An administrator hasn't assigned a default dashboard to your role yet, or the requested dashboard does not exist.
                </p>
                <button
                    onClick={() => navigate('/')}
                    style={{ padding: '10px 24px', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}
                >
                    Return Home
                </button>
            </div>
        );
    }

    const gridLayout = widgets.map((w, i) => ({
        i: String(w.id || i),
        x: w.gridPosition?.x ?? 0,
        y: w.gridPosition?.y ?? 0,
        w: w.gridPosition?.w ?? 4,
        h: w.gridPosition?.h ?? 3,
        static: true // Viewer mode is always static
    }));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f1f5f9' }}>
            {/* Viewer Header */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '16px 24px', background: '#fff', borderBottom: '1px solid #e2e8f0',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)', zIndex: 10
            }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
                        {dashboard.name}
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                            Last updated: {new Date().toLocaleTimeString()}
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={handleRefreshAll}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
                            borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0',
                            color: '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer'
                        }}
                    >
                        <RefreshCw size={14} /> Refresh
                    </button>
                    <button
                        onClick={() => exportUtils.toPdf()}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
                            borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0',
                            color: '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer'
                        }}
                    >
                        <Download size={14} /> Download PDF
                    </button>
                    <button
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
                            borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0',
                            color: '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer'
                        }}
                    >
                        <Share2 size={14} /> Share
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
                <ResponsiveGridLayout
                    className="layout"
                    layouts={{ lg: gridLayout }}
                    breakpoints={{ lg: 1200, md: 996, sm: 768 }}
                    cols={{ lg: 12, md: 10, sm: 6 }}
                    rowHeight={80}
                    margin={[16, 16]}
                    isDraggable={false}
                    isResizable={false}
                >
                    {widgets.map((widget, i) => (
                        <div key={String(widget.id || i)} style={{
                            background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0',
                            overflow: 'hidden', display: 'flex', flexDirection: 'column',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)'
                        }}>
                            <div style={{
                                padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#334155' }}>
                                    {widget.title}
                                </h3>
                                <button style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
                                    <Maximize2 size={14} />
                                </button>
                            </div>
                            <div style={{ flex: 1, padding: 16, overflow: 'hidden' }}>
                                <WidgetRenderer widget={widget} key={`${widget.id}-${refreshKey}`} />
                            </div>
                        </div>
                    ))}
                </ResponsiveGridLayout>
            </div>
        </div>
    );
}
