import { useState, useEffect } from 'react';
import { Check, Info, LayoutTemplate, Briefcase, TrendingUp, AlertCircle, ShoppingCart, Crown } from 'lucide-react';
import { dashboardBuilderApi, type DashboardTemplate } from '../../../services/dashboard-builder.service';

interface Props {
    onApply: (template: DashboardTemplate) => void;
}

const SYSTEM_TEMPLATES: DashboardTemplate[] = [
    {
        id: -5,
        name: 'Company Command Center',
        category: 'Executive',
        description: 'Beautiful multi-widget executive board for all projects: site progress, cash flow, quality rating, and quality progress.',
        isSystemTemplate: true
    },
    {
        id: -1,
        name: 'Construction Overview',
        category: 'Operations',
        description: 'Comprehensive dashboard for project managers covering progress, issues, and budget tracking.',
        isSystemTemplate: true
    },
    {
        id: -2,
        name: 'Quality Control Metrics',
        category: 'Quality',
        description: 'Track QA/QC approvals, site observations, and defect rates over time.',
        isSystemTemplate: true
    },
    {
        id: -3,
        name: 'Procurement Strategy & Status',
        category: 'Procurement',
        description: 'Overview of purchase orders, supplier performance, and inventory levels.',
        isSystemTemplate: true
    },
    {
        id: -4,
        name: 'Financial Health & Budgeting',
        category: 'Management',
        description: 'Executive view of cashflow, budgets vs actuals, and P&L charts.',
        isSystemTemplate: true
    }
];

export default function TemplateGallery({ onApply }: Props) {
    const [templates, setTemplates] = useState<DashboardTemplate[]>(SYSTEM_TEMPLATES);
    const [selectedTemplate, setSelectedTemplate] = useState<DashboardTemplate | null>(null);

    // Later: Fetch custom saved templates from backend
    useEffect(() => {
        const loadCustomTemplates = async () => {
            try {
                const res = await dashboardBuilderApi.getTemplates();
                if (res.data && res.data.length > 0) {
                    setTemplates([...SYSTEM_TEMPLATES, ...res.data]);
                }
            } catch (err) {
                console.error('Failed to load custom templates', err);
            }
        };
        loadCustomTemplates();
    }, []);

    const categories = Array.from(new Set(templates.map(t => t.category)));
    console.log('Available categories:', categories);

    const getIcon = (category: string) => {
        switch (category) {
            case 'Executive': return <Crown size={20} color="#7c3aed" />;
            case 'Operations': return <Briefcase size={20} color="#2563eb" />;
            case 'Quality': return <AlertCircle size={20} color="#dc2626" />;
            case 'Procurement': return <ShoppingCart size={20} color="#10b981" />;
            case 'Management': return <TrendingUp size={20} color="#f59e0b" />;
            default: return <LayoutTemplate size={20} color="#64748b" />;
        }
    };

    const handleTemplateClick = async () => {
        if (!selectedTemplate) return;
        
        onApply(selectedTemplate);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '0 0 24px' }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Template Gallery</h3>
                <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>Select a pre-built template to accelerate your dashboard creation</p>
            </div>

            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 20, flex: 1, overflow: 'auto'
            }}>
                {templates.map((tpl) => (
                    <div
                        key={tpl.id}
                        onClick={() => setSelectedTemplate(tpl)}
                        style={{
                            background: '#fff', borderRadius: 16, border: '1px solid',
                            borderColor: selectedTemplate?.id === tpl.id ? '#2563eb' : '#e2e8f0',
                            padding: 24, cursor: 'pointer', transition: 'all 0.2s',
                            display: 'flex', flexDirection: 'column', position: 'relative',
                            boxShadow: selectedTemplate?.id === tpl.id ? '0 10px 15px -3px rgba(37, 99, 235, 0.1)' : 'none'
                        }}
                    >
                        {selectedTemplate?.id === tpl.id && (
                            <div style={{
                                position: 'absolute', top: 12, right: 12,
                                background: '#2563eb', color: '#fff', borderRadius: '50%',
                                width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Check size={12} />
                            </div>
                        )}

                        <div style={{
                            width: 44, height: 44, borderRadius: 12, background: '#f8fafc',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
                            border: '1px solid #f1f5f9'
                        }}>
                            {getIcon(tpl.category)}
                        </div>

                        <div style={{
                            fontSize: 11, fontWeight: 800, color: '#94a3b8',
                            textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.5px'
                        }}>
                            {tpl.category}
                        </div>

                        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
                            {tpl.name}
                        </h4>

                        <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.5, flex: 1 }}>
                            {tpl.description}
                        </p>

                        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f8fafc', display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 11, fontWeight: 600 }}>
                            <Info size={14} />
                            {tpl.isSystemTemplate ? 'CORE SYSTEM TEMPLATE' : 'USER GENERATED'}
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ marginTop: 32, padding: '20px 0', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button
                    disabled={!selectedTemplate}
                    onClick={handleTemplateClick}
                    style={{
                        padding: '12px 32px', borderRadius: 8, background: selectedTemplate ? '#2563eb' : '#94a3b8',
                        color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: selectedTemplate ? 'pointer' : 'default',
                        transition: 'background 0.2s'
                    }}
                >
                    Create From Template
                </button>
            </div>
        </div>
    );
}
