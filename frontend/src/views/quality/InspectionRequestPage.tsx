import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
    ClipboardCheck, AlertCircle, Clock,
    ChevronRight, FileText, ShieldAlert, AlertTriangle,
    MessageSquareWarning, CheckCircle2, Camera, X
} from 'lucide-react';
import api from '../../api/axios';

// Reuse types or define local interfaces if shared types file not available
interface QualityActivity {
    id: number;
    sequence: number;
    activityName: string;
    description: string;
    holdPoint: boolean;
    witnessPoint: boolean;
    allowBreak: boolean;
    status: string;
    previousActivityId?: number;
    incomingEdges?: { sourceId: number; source: Partial<QualityActivity> }[];
}

interface ActivityObservation {
    id: string;
    observationText: string;
    type?: string;
    remarks?: string;
    photos?: string[];
    closureText?: string;
    closureEvidence?: string[];
    status: 'PENDING' | 'RECTIFIED' | 'CLOSED';
    createdAt: string;
}

interface QualityInspection {
    id: number;
    activityId: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED';
    requestDate: string;
    inspectionDate?: string;
    comments?: string;
    inspectedBy?: string;
}

interface ActivityList {
    id: number;
    name: string;
    epsNodeId: number;
}

interface EpsNode {
    id: number;
    label: string;
    nodeType?: string;
    children?: EpsNode[];
}

export default function InspectionRequestPage() {
    const { projectId } = useParams();
    const [epsNodes, setEpsNodes] = useState<EpsNode[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
    const [lists, setLists] = useState<ActivityList[]>([]);
    const [selectedListId, setSelectedListId] = useState<number | null>(null);
    const [activities, setActivities] = useState<QualityActivity[]>([]);
    const [inspections, setInspections] = useState<QualityInspection[]>([]);
    const [observationsMap, setObservationsMap] = useState<Record<number, ActivityObservation[]>>({});
    const [loading, setLoading] = useState(false);
    const [resolvingId, setResolvingId] = useState<string | null>(null);
    const [closureTexts, setClosureTexts] = useState<Record<string, string>>({});
    const [closurePhotos, setClosurePhotos] = useState<Record<string, string[]>>({});
    const [uploading, setUploading] = useState<string | null>(null); // obsId being uploaded for
    const [refreshKey, setRefreshKey] = useState(0); // Trigger refresh
    const [expandedNodes, setExpandedNodes] = useState<Record<number, boolean>>({});

    // Helper for correct image URLs
    const getFileUrl = (path: string) => {
        if (!path) return '';
        if (path.startsWith('http')) return path;
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        return `${baseUrl}${path}`;
    };

    // Load EPS Structure
    useEffect(() => {
        if (projectId) {
            // Corrected endpoint from /eps/project/:id/tree to /eps/:id/tree
            api.get(`/eps/${projectId}/tree`).then(res => setEpsNodes(res.data));
        }
    }, [projectId]);

    // Load Lists when Node selected
    useEffect(() => {
        if (projectId && selectedNodeId) {
            api.get('/quality/activity-lists', {
                params: { projectId, epsNodeId: selectedNodeId }
            }).then(res => {
                setLists(res.data);
                if (res.data.length > 0) setSelectedListId(res.data[0].id);
                else setSelectedListId(null);
            });
        }
    }, [projectId, selectedNodeId]);

    // Load Activities & Inspections
    useEffect(() => {
        if (selectedListId && selectedNodeId) {
            setLoading(true);
            Promise.all([
                api.get(`/quality/activity-lists/${selectedListId}/activities`),
                api.get('/quality/inspections', {
                    params: { projectId, epsNodeId: selectedNodeId, listId: selectedListId }
                })
            ]).then(([actRes, inspRes]) => {
                const acts = actRes.data as QualityActivity[];
                setActivities(acts);
                setInspections(inspRes.data);

                // Fetch observations for activities in PENDING_OBSERVATION
                const obsPromises = acts
                    .filter(a => a.status === 'PENDING_OBSERVATION')
                    .map(a => api.get(`/quality/activities/${a.id}/observations`).then(res => ({ id: a.id, obs: res.data })));

                Promise.all(obsPromises).then(results => {
                    const oMap: Record<number, ActivityObservation[]> = {};
                    results.forEach(r => { oMap[r.id] = r.obs; });
                    setObservationsMap(oMap);
                }).catch(err => console.error('Failed to load observations', err));

            }).finally(() => setLoading(false));
        } else {
            setActivities([]);
            setInspections([]);
            setObservationsMap({});
        }
    }, [selectedListId, selectedNodeId, projectId, refreshKey]);

    // Logic to determine status of each activity
    const activityRows = useMemo(() => {
        // Map inspections by activityId (get latest)
        const inspMap = new Map<number, QualityInspection>();
        // Inspections are ordered by date desc from backend, so first one is latest
        inspections.forEach(i => {
            if (!inspMap.has(i.activityId)) inspMap.set(i.activityId, i);
        });

        // Compute status
        return activities.map(act => {
            const insp = inspMap.get(act.id);
            let state: 'LOCKED' | 'READY' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PENDING_OBSERVATION' = 'LOCKED';

            // Check predecessors (Multi-dependency support)
            let predecessorDone = true;

            // Check edges if available
            if (act.incomingEdges && act.incomingEdges.length > 0) {
                for (const edge of act.incomingEdges) {
                    const prevInsp = inspMap.get(edge.sourceId);
                    if (!prevInsp || prevInsp.status !== 'APPROVED') {
                        predecessorDone = false;
                        break;
                    }
                }
            }
            // Fallback for legacy data/cache
            else if (act.previousActivityId) {
                const prevInsp = inspMap.get(act.previousActivityId);
                if (!prevInsp || prevInsp.status !== 'APPROVED') {
                    predecessorDone = false;
                }
            }

            if (act.status === 'PENDING_OBSERVATION') {
                state = 'PENDING_OBSERVATION' as any;
            } else if (insp) {
                state = insp.status as any;
            } else {
                if (predecessorDone || act.allowBreak) state = 'READY';
                else state = 'LOCKED';
            }

            return { ...act, inspection: insp, statusState: state, predecessorDone };
        });
    }, [activities, inspections]);

    const findNodeById = (nodes: EpsNode[], id: number): EpsNode | null => {
        for (const node of nodes) {
            if (node.id === id) return node;
            if (node.children) {
                const found = findNodeById(node.children, id);
                if (found) return found;
            }
        }
        return null;
    };

    const handleRaiseRFI = async (activity: QualityActivity) => {
        if (!selectedNodeId) return;

        const node = findNodeById(epsNodes, selectedNodeId);
        if (node && node.nodeType && !['FLOOR', 'UNIT', 'ROOM'].includes(node.nodeType)) {
            alert('RFIs can only be raised at the FLOOR, UNIT, or ROOM level. Please drill down to a more specific location.');
            return;
        }

        if (!confirm(`Raise Request for Inspection for "${activity.activityName}"?`)) return;
        try {
            await api.post('/quality/inspections', {
                projectId: Number(projectId),
                epsNodeId: selectedNodeId,
                listId: selectedListId,
                activityId: activity.id,
                comments: 'Requested via Web',
            });
            setRefreshKey(k => k + 1);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to raise RFI');
        }
    };

    const handleFileUpload = async (obsId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(obsId);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post('/files/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setClosurePhotos(prev => ({
                ...prev,
                [obsId]: [...(prev[obsId] || []), res.data.url]
            }));
        } catch (err: any) {
            alert(err.response?.data?.message || 'Upload failed');
        } finally {
            setUploading(null);
        }
    };

    const handleResolveObservation = async (activityId: number, obsId: string) => {
        const text = closureTexts[obsId];
        if (!text || !text.trim()) {
            alert('Please enter your rectification details and evidence note before submitting.');
            return;
        }
        setResolvingId(obsId);
        try {
            await api.patch(`/quality/activities/${activityId}/observation/${obsId}/resolve`, {
                closureText: text,
                closureEvidence: closurePhotos[obsId] || []
            });
            alert('Observation marked as rectified and sent back to QC.');
            setRefreshKey(k => k + 1);
            // Clear inputs for this observation
            setClosureTexts(prev => {
                const n = { ...prev };
                delete n[obsId];
                return n;
            });
            setClosurePhotos(prev => {
                const n = { ...prev };
                delete n[obsId];
                return n;
            });
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to resolve observation.');
        } finally {
            setResolvingId(null);
        }
    };

    // Helper for Status Badge
    const StatusBadge = ({ state }: { state: string }) => {
        switch (state) {
            case 'APPROVED': return <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs font-medium">Approved</span>;
            case 'REJECTED': return <span className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-full text-xs font-medium">Rejected</span>;
            case 'PENDING': return <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-full text-xs font-medium"><Clock className="w-3 h-3" /> QC Pending</span>;
            case 'PENDING_OBSERVATION': return <span className="flex items-center gap-1 text-rose-600 bg-rose-50 px-2 py-1 rounded-full text-xs font-medium ring-1 ring-rose-200"><MessageSquareWarning className="w-3 h-3" /> Fix Observation</span>;
            case 'READY': return <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded-full text-xs font-medium">Ready to Request</span>;
            default: return <span className="flex items-center gap-1 text-gray-400 bg-gray-100 px-2 py-1 rounded-full text-xs font-medium">Locked</span>;
        }
    };

    // Recursive EPS Renderer
    const renderTree = (nodes: EpsNode[], depth = 0) => (
        <ul className="space-y-1">
            {nodes.map(node => {
                const isExpanded = !!expandedNodes[node.id];
                return (
                    <li key={node.id}>
                        <div
                            onClick={() => setSelectedNodeId(node.id)}
                            className={`flex items-center px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors ${selectedNodeId === node.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                            style={{ paddingLeft: `${depth * 12 + 8}px` }}
                        >
                            {node.children?.length ? (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedNodes(prev => ({ ...prev, [node.id]: !prev[node.id] }));
                                    }}
                                    className="p-1 hover:bg-gray-200 rounded mr-1"
                                >
                                    <ChevronRight className={`w-3 h-3 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                </button>
                            ) : <span className="w-5 mr-1" />}
                            {node.label}
                        </div>
                        {node.children && isExpanded && renderTree(node.children, depth + 1)}
                    </li>
                );
            })}
        </ul>
    );

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-10">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-indigo-600" />
                        Site Inspections
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Manage Requests for Inspection (RFI) and Quality Checklists</p>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar: Location & List Selector */}
                <aside className="w-80 bg-white border-r flex flex-col">
                    <div className="p-4 border-b bg-gray-50/50">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">1. Select Location</h3>
                        <div className="h-[40vh] overflow-y-auto border rounded-lg bg-white p-2">
                            {/* Simple Tree View */}
                            {epsNodes.length ? renderTree(epsNodes) : <div className="p-4 text-sm text-gray-400 text-center">Loading Data...</div>}
                        </div>
                    </div>

                    <div className="p-4 flex-1 overflow-y-auto">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">2. Select Checklist</h3>
                        {selectedNodeId ? (
                            <div className="space-y-2">
                                {lists.length === 0 && <p className="text-sm text-gray-400 italic">No checklists found for this location.</p>}
                                {lists.map(list => (
                                    <button
                                        key={list.id}
                                        onClick={() => setSelectedListId(list.id)}
                                        className={`w-full text-left px-3 py-3 rounded-lg border transition-all ${selectedListId === list.id ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500/20' : 'border-gray-200 hover:border-indigo-300 hover:shadow-sm'}`}
                                    >
                                        <div className="font-medium text-gray-900 text-sm">{list.name}</div>
                                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                            <FileText className="w-3 h-3" /> Select to View
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center p-8 border-2 border-dashed border-gray-200 rounded-lg">
                                <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                <p className="text-sm text-gray-500">Please select a location above</p>
                            </div>
                        )}
                    </div>
                </aside>

                {/* Main Content: Checklist Items */}
                <main className="flex-1 overflow-y-auto p-8 relative">
                    {!selectedListId ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <ClipboardCheck className="w-16 h-16 mb-4 text-gray-200" />
                            <h3 className="text-lg font-medium text-gray-900 mb-1">No Checklist Selected</h3>
                            <p className="max-w-sm text-center">Select a location and a checklist from the sidebar to view sequence and raise RFIs.</p>
                        </div>
                    ) : (
                        <div className="max-w-4xl mx-auto">
                            <div className="flex justify-between items-end mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">{lists.find(l => l.id === selectedListId)?.name}</h2>
                                    <p className="text-gray-500 mt-1 flex items-center gap-2">
                                        <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono text-gray-600">SEQ-101</span>
                                        Execution Sequence
                                    </p>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-gray-500">Overall Progress</div>
                                    <div className="text-2xl font-bold text-indigo-600">
                                        {Math.round((activities.filter(a => activityRows.find(r => r.id === a.id)?.statusState === 'APPROVED').length / (activities.length || 1)) * 100)}%
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white shadow-sm border rounded-xl overflow-hidden divide-y divide-gray-100">
                                {activityRows.length === 0 && !loading && (
                                    <div className="p-8 text-center text-gray-500">No activities found in this list.</div>
                                )}

                                {activityRows.map((item, idx) => (
                                    <div key={item.id} className={`p-4 transition-colors ${item.statusState === 'LOCKED' ? 'bg-gray-50/50 opacity-60' : 'bg-white hover:bg-gray-50'}`}>
                                        <div className="flex items-start gap-4">
                                            {/* Sequence Number */}
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${item.statusState === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                {idx + 1}
                                            </div>

                                            {/* Matches */}
                                            <div className="flex-1 min-w-0 pt-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-medium text-gray-900 truncate">{item.activityName}</h3>
                                                    <StatusBadge state={item.statusState} />
                                                    {item.holdPoint && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-700 rounded border border-red-200 uppercase tracking-wide">HP</span>}
                                                    {item.witnessPoint && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded border border-yellow-200 uppercase tracking-wide">WP</span>}
                                                </div>

                                                {item.description && <p className="text-sm text-gray-500 mb-2">{item.description}</p>}

                                                {/* Predecessor Info if Locked */}
                                                {item.statusState === 'LOCKED' && !item.predecessorDone && (
                                                    <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded w-fit mt-1">
                                                        <AlertTriangle className="w-3 h-3" />
                                                        <span>Waiting for predecessor completion</span>
                                                    </div>
                                                )}

                                                {/* Inspection Details */}
                                                {item.inspection && (
                                                    <div className="mt-3 text-sm bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                                            <div className="text-gray-500">Request Date: <span className="text-gray-900 font-medium">{item.inspection.requestDate}</span></div>
                                                            {item.inspection.inspectionDate && <div className="text-gray-500">Inspection Date: <span className="text-gray-900 font-medium">{item.inspection.inspectionDate}</span></div>}
                                                            {item.inspection.comments && <div className="col-span-2 text-gray-500 border-t pt-2 mt-1">Comments: <span className="text-gray-700 italic">"{item.inspection.comments}"</span></div>}
                                                        </div>
                                                    </div>
                                                )}
                                                {/* Observations Area */}
                                                {item.statusState === 'PENDING_OBSERVATION' && observationsMap[item.id] && (
                                                    <div className="mt-3 space-y-4">
                                                        {observationsMap[item.id].filter(o => o.status === 'PENDING').map(obs => (
                                                            <div key={obs.id} className="bg-rose-50 border border-rose-200 rounded-lg p-4 shadow-sm">
                                                                <div className="flex items-start gap-3">
                                                                    <MessageSquareWarning className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                                                                    <div className="flex-1">
                                                                        <div className="flex justify-between items-start mb-1">
                                                                            <h4 className="text-sm font-bold text-rose-900">QC Observation Logged: {obs.type ? `[${obs.type}]` : ''}</h4>
                                                                            <span className="text-xs text-rose-500 font-medium">{new Date(obs.createdAt).toLocaleDateString()}</span>
                                                                        </div>
                                                                        <p className="text-sm text-rose-800 bg-white/50 p-2 rounded border border-rose-100 italic">"{obs.observationText}"</p>

                                                                        {obs.photos && obs.photos.length > 0 && (
                                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                                {obs.photos.map((url, pIdx) => (
                                                                                    <a key={pIdx} href={getFileUrl(url)} target="_blank" rel="noreferrer" className="w-16 h-16 rounded-md border border-rose-200 overflow-hidden hover:opacity-80 transition-opacity">
                                                                                        <img src={getFileUrl(url)} alt="Observation" className="w-full h-full object-cover" />
                                                                                    </a>
                                                                                ))}
                                                                            </div>
                                                                        )}

                                                                        <div className="mt-4 pt-3 border-t border-rose-200/60">
                                                                            <label className="block text-xs font-bold text-rose-900 mb-1.5 uppercase tracking-wider">Rectification Evidence</label>

                                                                            <div className="flex flex-wrap gap-2 mb-3">
                                                                                {(closurePhotos[obs.id] || []).map((url, pIdx) => (
                                                                                    <div key={pIdx} className="relative w-16 h-16 group">
                                                                                        <img src={getFileUrl(url)} alt="Rectification" className="w-full h-full object-cover rounded border border-rose-200" />
                                                                                        <button
                                                                                            onClick={() => setClosurePhotos(prev => ({
                                                                                                ...prev,
                                                                                                [obs.id]: prev[obs.id].filter((_, i) => i !== pIdx)
                                                                                            }))}
                                                                                            className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                        >
                                                                                            <X className="w-3 h-3" />
                                                                                        </button>
                                                                                    </div>
                                                                                ))}
                                                                                <label className={`w-16 h-16 flex flex-col items-center justify-center border border-dashed border-rose-300 rounded bg-white hover:bg-rose-100 transition-all cursor-pointer ${uploading === obs.id ? 'opacity-50 pointer-events-none' : ''}`}>
                                                                                    <Camera className="w-5 h-5 text-rose-400" />
                                                                                    <span className="text-[8px] text-rose-500 mt-0.5 font-bold uppercase">{uploading === obs.id ? '...' : 'Photo'}</span>
                                                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(obs.id, e)} />
                                                                                </label>
                                                                            </div>

                                                                            <textarea
                                                                                className="w-full border-rose-200 rounded-md p-2.5 text-sm bg-white focus:ring-2 focus:ring-rose-500 focus:border-rose-500 min-h-[80px]"
                                                                                placeholder="Describe how this issue was fixed..."
                                                                                value={closureTexts[obs.id] || ''}
                                                                                onChange={(e) => setClosureTexts(prev => ({ ...prev, [obs.id]: e.target.value }))}
                                                                            />
                                                                            <div className="mt-3 flex justify-end gap-2">
                                                                                <button
                                                                                    onClick={() => handleResolveObservation(item.id, obs.id)}
                                                                                    disabled={resolvingId === obs.id || !closureTexts[obs.id]?.trim() || uploading === obs.id}
                                                                                    className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-sm font-semibold shadow-sm transition-all disabled:opacity-50"
                                                                                >
                                                                                    <CheckCircle2 className="w-4 h-4" />
                                                                                    {resolvingId === obs.id ? 'Submitting...' : 'Submit Rectification'}
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="shrink-0 pt-1 flex items-center gap-2">
                                                {(item.statusState === 'READY' || item.statusState === 'REJECTED') && (
                                                    <button
                                                        onClick={() => handleRaiseRFI(item)}
                                                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-all"
                                                    >
                                                        <ShieldAlert className="w-4 h-4" />
                                                        Raise RFI
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
