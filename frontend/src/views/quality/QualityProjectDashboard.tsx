import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    ClipboardCheck,
    FlaskConical,
    Eye,
    CheckSquare,
    Hammer,
    ShieldCheck,
    FileText,
    ArrowLeft
} from 'lucide-react';
import api from '../../api/axios';
import QualityOverview from './subviews/QualityOverview';
import QualityInspection from './subviews/QualityInspection';
import QualityMaterialTest from './subviews/QualityMaterialTest';
import SiteObservationPanel from './subviews/SiteObservationPanel';
import QualityChecklist from './subviews/QualityChecklist';
import QualitySnagList from './subviews/QualitySnagList';
import QualityAudit from './subviews/QualityAudit';
import QualityDocuments from './subviews/QualityDocuments';
import QualityStructureManager from './subviews/QualityStructureManager';

const QualityProjectDashboard = () => {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState<any>(null);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        const fetchProject = async () => {
            if (!projectId) return;
            try {
                const response = await api.get(`/eps/${projectId}`);
                setProject(response.data);
            } catch (error) {
                console.error(error);
            }
        };
        fetchProject();
    }, [projectId]);

    if (!project) return null;

    const tabs = [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'inspections', label: 'Inspections', icon: ClipboardCheck },
        { id: 'materials', label: 'Materials', icon: FlaskConical },
        { id: 'observation-ncr', label: 'Site Observations', icon: Eye },
        { id: 'checklists', label: 'Checklists', icon: CheckSquare },
        { id: 'snags', label: 'Snag List', icon: Hammer },
        { id: 'structure', label: 'Structure', icon: LayoutDashboard },
        { id: 'audits', label: 'Audits', icon: ShieldCheck },
        { id: 'documents', label: 'Documents', icon: FileText },
    ];

    const renderActiveTab = () => {
        const numericProjectId = Number(projectId);
        switch (activeTab) {
            case 'overview': return <QualityOverview projectId={numericProjectId} />;
            case 'inspections': return <QualityInspection projectId={numericProjectId} />;
            case 'materials': return <QualityMaterialTest projectId={numericProjectId} />;
            case 'observation-ncr': return <SiteObservationPanel projectId={numericProjectId} />;
            case 'checklists': return <QualityChecklist projectId={numericProjectId} />;
            case 'snags': return <QualitySnagList projectId={numericProjectId} />;
            case 'structure': return <QualityStructureManager projectId={numericProjectId} />;
            case 'audits': return <QualityAudit projectId={numericProjectId} />;
            case 'documents': return <QualityDocuments projectId={numericProjectId} />;
            default: return <QualityOverview projectId={numericProjectId} />;
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b px-6 py-4">
                <div className="flex items-center gap-4 mb-6">
                    <button
                        onClick={() => navigate('/dashboard/eps')}
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                        <p className="text-sm text-gray-500">Quality Management System</p>
                    </div>
                </div>

                <div className="flex gap-1 overflow-x-auto no-scrollbar">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-full transition-all whitespace-nowrap ${activeTab === tab.id
                                ? 'bg-orange-600 text-white shadow-lg shadow-orange-200'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
                {renderActiveTab()}
            </div>
        </div>
    );
};

export default QualityProjectDashboard;
