import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Calendar, Clock, Lock, Copy, FileText, ArrowRight, Trash2, Download, Upload, RefreshCcw } from 'lucide-react';
import api from '../../../api/axios';
import RevisionImportModal from './RevisionImportModal';

interface ScheduleVersion {
    id: number;
    versionCode: string;
    versionType: 'BASELINE' | 'REVISED' | 'WORKING';
    isActive: boolean;
    isLocked: boolean;
    createdOn: string;
    createdBy: string;
    remarks: string;
    sequenceNumber: number;
}

const WorkingScheduleList: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const [versions, setVersions] = useState<ScheduleVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);

    // Import Modal State
    const [importSource, setImportSource] = useState<ScheduleVersion | null>(null);

    const [newVersion, setNewVersion] = useState({
        code: '',
        type: 'REVISED',
        sourceVersionId: null as number | null,
        remarks: ''
    });

    useEffect(() => {
        if (projectId) fetchVersions();
    }, [projectId]);

    const fetchVersions = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/planning/${projectId}/versions`);
            setVersions(res.data);

            // Auto-generate next code
            const revCount = res.data.filter((v: any) => v.versionType === 'REVISED').length;
            setNewVersion(prev => ({ ...prev, code: `R${revCount + 1}` }));

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newVersion.code) return;
        try {
            await api.post(`/planning/${projectId}/versions`, newVersion);
            setShowCreate(false);
            fetchVersions();
        } catch (err) {
            alert('Failed to create version');
        }
    };

    const handleExport = async (version: ScheduleVersion) => {
        try {
            const res = await api.get(`planning/versions/${version.id}/export`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Schedule_${version.versionCode}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Export failed', err);
            alert('Failed to export version');
        }
    };

    // Compare Modal State
    const [compareSource, setCompareSource] = useState<ScheduleVersion | null>(null);
    const [compareTargetId, setCompareTargetId] = useState<number | null>(null);

    const handleCompare = () => {
        if (compareSource && compareTargetId) {
            navigate(`/dashboard/projects/${projectId}/planning/compare?v1=${compareTargetId}&v2=${compareSource.id}`);
            setCompareSource(null);
        }
    }

    const handleRecalculate = async (version: ScheduleVersion) => {
        if (!confirm('Recalculate Schedule CPM dates based on predecessors?')) return;
        try {
            await api.post(`/planning/versions/${version.id}/recalculate`);
            alert('Schedule Recalculated Successfully');
            fetchVersions();
        } catch (err) {
            console.error(err);
            alert('Recalculation failed');
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            {/* ... Existing header ... */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Working Schedules</h1>
                    <p className="text-gray-500 mt-1">Manage Baselines, Revisions, and Recovery Plans derived from Master Schedule.</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
                >
                    <Plus size={18} />
                    New Revision (Clone)
                </button>
            </div>

            {/* Compare Version Modal */}
            {compareSource && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-xl shadow-2xl w-96 animate-in zoom-in-95">
                        <h3 className="font-bold text-gray-800 mb-4 text-lg">Compare Version</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Comparing <span className="font-bold">{compareSource.versionCode}</span> against:
                        </p>
                        <select
                            className="w-full border p-2 rounded mb-4"
                            onChange={e => setCompareTargetId(Number(e.target.value))}
                            defaultValue=""
                        >
                            <option value="" disabled>Select Baseline / Version</option>
                            {versions.filter(v => v.id !== compareSource.id).map(v => (
                                <option key={v.id} value={v.id}>{v.versionCode} ({v.versionType})</option>
                            ))}
                        </select>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setCompareSource(null)} className="px-3 py-1 text-gray-500">Cancel</button>
                            <button
                                onClick={handleCompare}
                                disabled={!compareTargetId}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                                Compare
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ... Existing Create Dialog ... */}
            {showCreate && (
                <div className="mb-8 bg-blue-50 border border-blue-100 p-6 rounded-xl animate-in fade-in slide-in-from-top-4">
                    <h3 className="font-bold text-blue-900 mb-4 flex items-center gap-2">
                        <Copy size={18} />
                        Create New Schedule Version (Manual Clone)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-semibold text-blue-700 mb-1">Version Code</label>
                            <input
                                type="text"
                                value={newVersion.code}
                                onChange={e => setNewVersion({ ...newVersion, code: e.target.value })}
                                className="w-full border-blue-200 rounded p-2 focus:ring-2 focus:ring-blue-300 outline-none"
                                placeholder="e.g. R1"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-blue-700 mb-1">Type</label>
                            <select
                                value={newVersion.type}
                                onChange={e => setNewVersion({ ...newVersion, type: e.target.value })}
                                className="w-full border-blue-200 rounded p-2 focus:ring-2 focus:ring-blue-300 outline-none"
                            >
                                <option value="REVISED">Revised Schedule</option>
                                <option value="BASELINE">Baseline</option>
                                <option value="WORKING">Working Copy</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-blue-700 mb-1">Base Source</label>
                            <select
                                value={newVersion.sourceVersionId || ''}
                                onChange={e => setNewVersion({ ...newVersion, sourceVersionId: e.target.value ? Number(e.target.value) : null })}
                                className="w-full border-blue-200 rounded p-2 focus:ring-2 focus:ring-blue-300 outline-none"
                            >
                                <option value="">Master Schedule (Original)</option>
                                <option value="" disabled>--- Revisions ---</option>
                                {versions.map(v => (
                                    <option key={v.id} value={v.id}>{v.versionCode}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-500 hover:bg-white rounded">Cancel</button>
                        <button onClick={handleCreate} className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Create Version</button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4">
                {/* Master Schedule Card */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between group hover:border-blue-300 transition-all">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gray-100 rounded-lg text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                            <FileText size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800 text-lg">Master Schedule</h3>
                            <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                <span className="flex items-center gap-1"><Clock size={14} /> Live Source</span>
                                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-medium">READ ONLY</span>
                            </div>
                        </div>
                    </div>
                    <button className="px-4 py-2 text-gray-400 hover:text-blue-600 font-medium text-sm flex items-center gap-1">
                        View Details <ArrowRight size={16} />
                    </button>
                </div>

                {loading ? (
                    <div className="text-center py-10 text-gray-400">Loading versions...</div>
                ) : versions.map(version => (
                    <div key={version.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between hover:shadow-md transition-all">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-lg ${version.versionType === 'BASELINE' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                                <Calendar size={24} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-gray-800 text-lg">{version.versionCode}</h3>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${version.versionType === 'BASELINE' ? 'bg-amber-100 text-amber-700' :
                                        version.versionType === 'REVISED' ? 'bg-purple-100 text-purple-700' :
                                            'bg-blue-100 text-blue-700'
                                        }`}>
                                        {version.versionType}
                                    </span>
                                    {version.sequenceNumber > 0 && (
                                        <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded textxs font-mono">
                                            Seq: {version.sequenceNumber}
                                        </span>
                                    )}
                                    {version.isLocked && <Lock size={14} className="text-gray-400" />}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                    <span className="flex items-center gap-1">Created by {version.createdBy}</span>
                                    <span className="text-gray-300">•</span>
                                    <span>{new Date(version.createdOn).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex bg-gray-50 rounded-lg p-1 mr-2 border border-gray-100">
                                <button
                                    onClick={() => handleExport(version)}
                                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-white rounded transition-all"
                                    title="Export to Excel"
                                >
                                    <Download size={16} />
                                </button>
                                <button
                                    onClick={() => setImportSource(version)}
                                    className="p-2 text-gray-600 hover:text-green-600 hover:bg-white rounded transition-all"
                                    title="Create Next Revision (Import)"
                                >
                                    <Upload size={16} />
                                </button>
                                <button
                                    onClick={() => handleRecalculate(version)}
                                    className="p-2 text-gray-600 hover:text-orange-600 hover:bg-white rounded transition-all"
                                    title="Recalculate CPM"
                                >
                                    <RefreshCcw size={16} />
                                </button>
                            </div>

                            <button
                                onClick={() => setCompareSource(version)}
                                className="px-3 py-2 bg-white border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 font-medium text-sm shadow-sm"
                            >
                                Compare
                            </button>

                            <button
                                onClick={() => navigate(`/dashboard/projects/${projectId}/planning?view=gantt_version&versionId=${version.id}`)}
                                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:border-blue-400 hover:text-blue-600 font-medium text-sm flex items-center gap-2 shadow-sm"
                            >
                                Open <ArrowRight size={16} />
                            </button>
                            <button
                                onClick={async () => {
                                    if (confirm(`Are you sure you want to delete version ${version.versionCode}?`)) {
                                        try {
                                            await api.delete(`/planning/${projectId}/versions/${version.id}`);
                                            fetchVersions();
                                        } catch (e) {
                                            const msg = (e as any).response?.data?.message || 'Failed to delete';
                                            alert(msg);
                                        }
                                    }
                                }}
                                className="px-2 py-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg flex items-center shadow-sm border border-transparent hover:border-red-200"
                                title="Delete Version"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}

                {!loading && versions.length === 0 && (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                        <p className="text-gray-500 mb-2">No revisions created yet.</p>
                        <button onClick={() => setShowCreate(true)} className="text-blue-600 hover:underline font-medium">Create your first Baseline or Revision</button>
                    </div>
                )}
            </div>

            <RevisionImportModal
                isOpen={!!importSource}
                onClose={() => setImportSource(null)}
                projectId={projectId || ''}
                sourceVersion={importSource}
                onSuccess={() => {
                    fetchVersions();
                    // Optionally navigate to new version?
                }}
            />
        </div>
    );
};

export default WorkingScheduleList;
