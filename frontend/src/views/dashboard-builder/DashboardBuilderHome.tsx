import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Copy, Edit, Trash2, LayoutDashboard, ShieldCheck, LayoutTemplate } from 'lucide-react';
import { dashboardBuilderApi, type DashboardConfig, type DashboardTemplate } from '../../services/dashboard-builder.service';
import AssignmentManager from './components/AssignmentManager';
import TemplateGallery from './components/TemplateGallery';

export default function DashboardBuilderHome() {
    const [dashboards, setDashboards] = useState<DashboardConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newScope, setNewScope] = useState<'PROJECT' | 'GLOBAL'>('PROJECT');
    const [activeTab, setActiveTab] = useState<'dashboards' | 'assignments' | 'templates'>('dashboards');
    const navigate = useNavigate();

    const load = async () => {
        try {
            setLoading(true);
            const res = await dashboardBuilderApi.getAll();
            setDashboards(res.data);
        } catch (err) {
            console.error('Failed to load dashboards', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleCreate = async () => {
        if (!newName.trim()) return;
        try {
            const res = await dashboardBuilderApi.create({
                name: newName.trim(),
                scope: newScope,
                isActive: true,
                layoutConfig: { cols: 12, rowHeight: 80 },
            });
            setShowCreate(false);
            setNewName('');
            navigate(`/dashboard/admin/dashboard-builder/${res.data.id}/edit`);
        } catch (err) {
            console.error('Failed to create dashboard', err);
        }
    };

    const handleClone = async (id: number) => {
        try {
            await dashboardBuilderApi.clone(id);
            load();
        } catch (err) {
            console.error('Clone failed', err);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this dashboard?')) return;
        try {
            await dashboardBuilderApi.remove(id);
            load();
        } catch (err) {
            console.error('Delete failed', err);
        }
    };

    const handleApplyTemplate = async (tpl: DashboardTemplate) => {
        try {
            const res = await dashboardBuilderApi.applyTemplate(tpl.id);
            navigate(`/dashboard/admin/dashboard-builder/${res.data.id}/edit`);
        } catch (err) {
            console.error('Failed to apply template', err);
        }
    };

    return (
        <div style={{ padding: '24px' }}>
            {/* Header */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '24px',
            }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                        <LayoutDashboard size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                        Dashboard Builder
                    </h1>
                    <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '14px' }}>
                        Create and manage custom dashboards for your organization
                    </p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 20px', background: '#2563eb', color: '#fff',
                        border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                        fontSize: '14px', transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#1d4ed8')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#2563eb')}
                >
                    <Plus size={18} /> New Dashboard
                </button>
            </div>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid #e2e8f0', marginBottom: 24 }}>
                <button
                    onClick={() => setActiveTab('dashboards')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '12px 4px',
                        border: 'none', background: 'transparent', cursor: 'pointer',
                        fontSize: 14, fontWeight: 700, color: activeTab === 'dashboards' ? '#2563eb' : '#64748b',
                        borderBottom: `2px solid ${activeTab === 'dashboards' ? '#2563eb' : 'transparent'}`,
                        transition: 'all 0.2s'
                    }}
                >
                    <LayoutDashboard size={18} /> Dashboards
                </button>
                <button
                    onClick={() => setActiveTab('assignments')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '12px 4px',
                        border: 'none', background: 'transparent', cursor: 'pointer',
                        fontSize: 14, fontWeight: 700, color: activeTab === 'assignments' ? '#2563eb' : '#64748b',
                        borderBottom: `2px solid ${activeTab === 'assignments' ? '#2563eb' : 'transparent'}`,
                        transition: 'all 0.2s'
                    }}
                >
                    <ShieldCheck size={18} /> Assignments
                </button>
                <button
                    onClick={() => setActiveTab('templates')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '12px 4px',
                        border: 'none', background: 'transparent', cursor: 'pointer',
                        fontSize: 14, fontWeight: 700, color: activeTab === 'templates' ? '#2563eb' : '#64748b',
                        borderBottom: `2px solid ${activeTab === 'templates' ? '#2563eb' : 'transparent'}`,
                        transition: 'all 0.2s'
                    }}
                >
                    <LayoutTemplate size={18} /> Templates
                </button>
            </div>

            {activeTab === 'assignments' && <AssignmentManager dashboards={dashboards} />}
            {activeTab === 'templates' && <TemplateGallery onApply={handleApplyTemplate} />}
            {activeTab === 'dashboards' && (
                <>
                    {/* Create Modal */}
                    {showCreate && (
                        <div style={{
                            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                        }}>
                            <div style={{
                                background: '#fff', borderRadius: 12, padding: 32, width: 440,
                                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                            }}>
                                <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700 }}>Create Dashboard</h2>
                                <div style={{ marginBottom: 16 }}>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                                        Dashboard Name
                                    </label>
                                    <input
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        placeholder="e.g., Construction Overview"
                                        style={{
                                            width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0',
                                            borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
                                        }}
                                        autoFocus
                                    />
                                </div>
                                <div style={{ marginBottom: 24 }}>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                                        Scope
                                    </label>
                                    <div style={{ display: 'flex', gap: 12 }}>
                                        {(['PROJECT', 'GLOBAL'] as const).map((s) => (
                                            <button
                                                key={s}
                                                onClick={() => setNewScope(s)}
                                                style={{
                                                    flex: 1, padding: '10px 16px', borderRadius: 8, cursor: 'pointer',
                                                    border: newScope === s ? '2px solid #2563eb' : '1px solid #e2e8f0',
                                                    background: newScope === s ? '#eff6ff' : '#fff',
                                                    color: newScope === s ? '#2563eb' : '#64748b',
                                                    fontWeight: 600, fontSize: 13,
                                                }}
                                            >
                                                {s === 'PROJECT' ? '📁 Project-Scoped' : '🌍 Global'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={() => { setShowCreate(false); setNewName(''); }}
                                        style={{
                                            padding: '10px 20px', border: '1px solid #e2e8f0', borderRadius: 8,
                                            background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#64748b',
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleCreate}
                                        disabled={!newName.trim()}
                                        style={{
                                            padding: '10px 24px', border: 'none', borderRadius: 8, background: '#2563eb',
                                            color: '#fff', cursor: 'pointer', fontWeight: 600,
                                            opacity: newName.trim() ? 1 : 0.5,
                                        }}
                                    >
                                        Create & Design
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Dashboard Cards Grid */}
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>Loading...</div>
                    ) : dashboards.length === 0 ? (
                        <div style={{
                            textAlign: 'center', padding: '80px 40px', background: '#f8fafc',
                            borderRadius: 16, border: '2px dashed #e2e8f0',
                        }}>
                            <LayoutDashboard size={48} color="#94a3b8" style={{ marginBottom: 16 }} />
                            <h3 style={{ color: '#475569', margin: '0 0 8px' }}>No Dashboards Yet</h3>
                            <p style={{ color: '#94a3b8', margin: 0 }}>
                                Create your first dashboard to start building visual analytics
                            </p>
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                            gap: 20,
                        }}>
                            {dashboards.map((db) => (
                                <div
                                    key={db.id}
                                    style={{
                                        background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
                                        padding: 20, transition: 'box-shadow 0.2s, transform 0.2s',
                                        cursor: 'pointer',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.1)';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.boxShadow = 'none';
                                        e.currentTarget.style.transform = 'none';
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ flex: 1 }}>
                                            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
                                                {db.name}
                                            </h3>
                                            <span style={{
                                                display: 'inline-block', padding: '2px 8px', borderRadius: 12,
                                                fontSize: 11, fontWeight: 600, letterSpacing: '0.5px',
                                                background: db.scope === 'GLOBAL' ? '#dbeafe' : '#f0fdf4',
                                                color: db.scope === 'GLOBAL' ? '#1d4ed8' : '#15803d',
                                            }}>
                                                {db.scope}
                                            </span>
                                        </div>
                                    </div>
                                    {db.description && (
                                        <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 13 }}>
                                            {db.description}
                                        </p>
                                    )}
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        marginTop: 16, paddingTop: 12, borderTop: '1px solid #f1f5f9',
                                    }}>
                                        <span style={{ fontSize: 12, color: '#94a3b8' }}>
                                            {db.widgets?.length || 0} widget{(db.widgets?.length || 0) !== 1 ? 's' : ''}
                                        </span>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/admin/dashboard-builder/${db.id}/edit`); }}
                                                title="Edit"
                                                style={{
                                                    padding: 6, border: 'none', borderRadius: 6, background: '#f1f5f9',
                                                    cursor: 'pointer', color: '#475569', display: 'flex',
                                                }}
                                            >
                                                <Edit size={15} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleClone(db.id!); }}
                                                title="Clone"
                                                style={{
                                                    padding: 6, border: 'none', borderRadius: 6, background: '#f1f5f9',
                                                    cursor: 'pointer', color: '#475569', display: 'flex',
                                                }}
                                            >
                                                <Copy size={15} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDelete(db.id!); }}
                                                title="Delete"
                                                style={{
                                                    padding: 6, border: 'none', borderRadius: 6, background: '#fef2f2',
                                                    cursor: 'pointer', color: '#dc2626', display: 'flex',
                                                }}
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )
            }
        </div >
    );
}
