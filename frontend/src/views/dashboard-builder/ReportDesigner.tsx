import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Check, Clock } from 'lucide-react';
import { dashboardBuilderApi, type DataSourceMeta } from '../../services/dashboard-builder.service';

type Step = 'basic' | 'columns' | 'filters' | 'schedule';

export default function ReportDesigner() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>('basic');
    const [dataSources, setDataSources] = useState<DataSourceMeta[]>([]);

    // Form State
    const [report, setReport] = useState({
        name: '',
        description: '',
        dataSourceKey: '',
        columns: [] as { key: string; label: string; format?: string; aggregate?: string }[],
        filters: [] as any[],
        schedule: { frequency: 'NEVER', emails: [] as string[] }
    });

    useEffect(() => {
        const load = async () => {
            try {
                const res = await dashboardBuilderApi.getDataSources();
                setDataSources(res.data);

                if (id !== 'new') {
                    // Load existing report
                    // const repRes = await dashboardBuilderApi.getReport(Number(id));
                    // setReport(repRes.data);
                }
            } catch (err) {
                console.error('Failed to load designer data', err);
            }
        };
        load();
    }, [id]);

    const handleSave = async () => {
        if (!report.name || !report.dataSourceKey) return;
        try {
            // Logic to save/update report
            navigate('/dashboard/admin/reports');
        } catch (err) {
            console.error('Save failed', err);
        }
    };

    const selectedSource = dataSources.find(ds => ds.key === report.dataSourceKey);
    const availableFields = selectedSource?.fields || [];

    const handleStepNav = (next: Step) => {
        if (step === 'basic' && (!report.name || !report.dataSourceKey)) return;
        setStep(next);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8fafc' }}>
            {/* Header */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '16px 32px', background: '#fff', borderBottom: '1px solid #e2e8f0',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)', zIndex: 10
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button
                        onClick={() => navigate('/dashboard/admin/reports')}
                        style={{ padding: 8, borderRadius: 8, border: 'none', background: '#f1f5f9', cursor: 'pointer', color: '#64748b' }}
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                            {id === 'new' ? 'New Report Designer' : `Editing: ${report.name}`}
                        </h1>
                        <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
                            {step.toUpperCase()} CONFIGURATION
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                    <button
                        onClick={handleSave}
                        disabled={!report.name || !report.dataSourceKey}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px',
                            borderRadius: 10, background: (report.name && report.dataSourceKey) ? '#2563eb' : '#94a3b8',
                            color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: (report.name && report.dataSourceKey) ? 'pointer' : 'default'
                        }}
                    >
                        <Save size={16} /> Save Report
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Lateral Step Navigator */}
                <div style={{
                    width: 260, background: '#fff', borderRight: '1px solid #e2e8f0',
                    padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 8
                }}>
                    {(['basic', 'columns', 'filters', 'schedule'] as Step[]).map((s, idx) => (
                        <button
                            key={s}
                            onClick={() => handleStepNav(s)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                                borderRadius: 12, border: 'none', cursor: 'pointer',
                                background: step === s ? '#eff6ff' : 'transparent',
                                color: step === s ? '#2563eb' : '#64748b',
                                transition: 'all 0.2s', textAlign: 'left'
                            }}
                        >
                            <div style={{
                                width: 28, height: 28, borderRadius: 8,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: step === s ? '#2563eb' : '#f1f5f9',
                                color: step === s ? '#fff' : '#94a3b8',
                                fontSize: 12, fontWeight: 800
                            }}>
                                {idx + 1}
                            </div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 700 }}>
                                    {s === 'basic' ? 'General Settings' : s === 'columns' ? 'Select Columns' : s === 'filters' ? 'Default Filters' : 'Run Schedule'}
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.7 }}>
                                    {s === 'basic' ? 'DataSource & Info' : s === 'columns' ? 'Format & Order' : s === 'filters' ? 'Pre-run limits' : 'Emails & Frequency'}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Main Config Area */}
                <div style={{ flex: 1, overflow: 'auto', padding: 40 }}>
                    <div style={{ maxWidth: 720, margin: '0 auto' }}>

                        {step === 'basic' && (
                            <div style={{ background: '#fff', borderRadius: 20, padding: 32, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                <h3 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 800, color: '#1e293b' }}>General Settings</h3>
                                <div style={{ marginBottom: 20 }}>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>Report Name</label>
                                    <input
                                        type="text" value={report.name} onChange={e => setReport({ ...report, name: e.target.value })}
                                        placeholder="e.g., Weekly Site Performance Audit"
                                        style={{ width: '100%', padding: '14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 14 }}
                                    />
                                </div>
                                <div style={{ marginBottom: 20 }}>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>Description (Optional)</label>
                                    <textarea
                                        value={report.description} onChange={e => setReport({ ...report, description: e.target.value })}
                                        placeholder="Enter report purpose..."
                                        style={{ width: '100%', padding: '14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 14, minHeight: 80, resize: 'vertical' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>Primary Data Source</label>
                                    <select
                                        value={report.dataSourceKey} onChange={e => setReport({ ...report, dataSourceKey: e.target.value, columns: [] })}
                                        style={{ width: '100%', padding: '14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 14 }}
                                    >
                                        <option value="">Select a source...</option>
                                        {dataSources.map(ds => <option key={ds.key} value={ds.key}>{ds.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}

                        {step === 'columns' && (
                            <div style={{ background: '#fff', borderRadius: 20, padding: 32, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#1e293b' }}>Select Columns</h3>
                                <p style={{ margin: '0 0 24px', fontSize: 13, color: '#94a3b8' }}>Available fields from <b>{selectedSource?.label}</b></p>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 32 }}>
                                    {availableFields.map(f => {
                                        const isSelected = report.columns.some(c => c.key === f.key);
                                        return (
                                            <button
                                                key={f.key}
                                                onClick={() => {
                                                    if (isSelected) setReport({ ...report, columns: report.columns.filter(c => c.key !== f.key) });
                                                    else setReport({ ...report, columns: [...report.columns, { key: f.key, label: f.label || f.key }] });
                                                }}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12,
                                                    border: '1px solid', borderColor: isSelected ? '#2563eb' : '#e2e8f0',
                                                    background: isSelected ? '#eff6ff' : '#fff', textAlign: 'left', cursor: 'pointer'
                                                }}
                                            >
                                                <div style={{ width: 18, height: 18, borderRadius: 4, background: isSelected ? '#2563eb' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {isSelected && <Check size={12} color="#fff" />}
                                                </div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? '#1e40af' : '#475569' }}>{f.label || f.key}</div>
                                            </button>
                                        );
                                    })}
                                </div>

                                <h4 style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', marginBottom: 16 }}>Selected Columns & Ordering</h4>
                                {report.columns.length === 0 ? (
                                    <div style={{ padding: 24, textAlign: 'center', background: '#f8fafc', borderRadius: 12, border: '1px dashed #e2e8f0', color: '#94a3b8' }}>No columns selected.</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {report.columns.map((c, i) => (
                                            <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #f1f5f9' }}>
                                                <span style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', width: 20 }}>{i + 1}</span>
                                                <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#334155' }}>{c.label}</span>
                                                <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>{availableFields.find(f => f.key === c.key)?.type}</span>
                                                <button
                                                    onClick={() => setReport({ ...report, columns: report.columns.filter(col => col.key !== c.key) })}
                                                    style={{ border: 'none', background: 'transparent', padding: 4, cursor: 'pointer', color: '#ef4444' }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {step === 'filters' && (
                            <div style={{ background: '#fff', borderRadius: 20, padding: 32, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                <h3 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 800, color: '#1e293b' }}>Default Filters</h3>
                                <p style={{ background: '#f8fafc', padding: 16, borderRadius: 12, fontSize: 13, color: '#64748b', display: 'flex', gap: 12, border: '1px solid #f1f5f9' }}>
                                    <Clock size={18} /> Default filters will be automatically applied when the report runs on schedule. Users can still change them during manual runs.
                                </p>
                                <button style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, background: '#f1f5f9', color: '#475569', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
                                    <Plus size={16} /> Add Custom Filter
                                </button>
                                <div style={{ padding: '60px 0', textAlign: 'center', color: '#94a3b8' }}>Advanced filters coming soon...</div>
                            </div>
                        )}

                        {step === 'schedule' && (
                            <div style={{ background: '#fff', borderRadius: 20, padding: 32, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                <h3 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 800, color: '#1e293b' }}>Run Schedule</h3>
                                <div style={{ marginBottom: 24 }}>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 12 }}>Frequency</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                                        {['NEVER', 'DAILY', 'WEEKLY', 'MONTHLY'].map(f => (
                                            <button
                                                key={f}
                                                onClick={() => setReport({ ...report, schedule: { ...report.schedule, frequency: f } })}
                                                style={{
                                                    padding: '12px', borderRadius: 10, border: '1px solid',
                                                    borderColor: report.schedule.frequency === f ? '#2563eb' : '#e2e8f0',
                                                    background: report.schedule.frequency === f ? '#eff6ff' : '#fff',
                                                    color: report.schedule.frequency === f ? '#2563eb' : '#64748b',
                                                    fontSize: 12, fontWeight: 700, cursor: 'pointer'
                                                }}
                                            >
                                                {f}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 10 }}>Auto-Email Excel To</label>
                                    <input
                                        type="text"
                                        placeholder="Enter email addresses (comma separated)..."
                                        style={{ width: '100%', padding: '14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 14 }}
                                    />
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
                            <button
                                onClick={() => step === 'basic' ? handleStepNav('basic') : handleStepNav(step === 'columns' ? 'basic' : step === 'filters' ? 'columns' : 'filters')}
                                disabled={step === 'basic'}
                                style={{ padding: '12px 24px', borderRadius: 10, background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', fontWeight: 700, cursor: 'pointer', opacity: step === 'basic' ? 0 : 1 }}
                            >
                                Back
                            </button>
                            <button
                                onClick={() => step === 'basic' ? handleStepNav('columns') : step === 'columns' ? handleStepNav('filters') : step === 'filters' ? handleStepNav('schedule') : handleSave()}
                                style={{ padding: '12px 32px', borderRadius: 10, background: '#0f172a', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                            >
                                {step === 'schedule' ? 'Finish & Save' : 'Continue'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
