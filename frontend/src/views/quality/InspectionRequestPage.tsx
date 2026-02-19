import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
    ClipboardCheck, AlertCircle, CheckCircle2, XCircle, Clock,
    ChevronRight, FileText, ShieldAlert, AlertTriangle
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
    previousActivityId?: number;
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
    name: string;
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
    const [loading, setLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0); // Trigger refresh

    // Load EPS Structure
    useEffect(() => {
        if (projectId) {
            api.get(`/eps/project/${projectId}/tree`).then(res => setEpsNodes(res.data));
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
                setActivities(actRes.data);
                setInspections(inspRes.data);
            }).finally(() => setLoading(false));
        } else {
            setActivities([]);
            setInspections([]);
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
            let state: 'LOCKED' | 'READY' | 'PENDING' | 'APPROVED' | 'REJECTED' = 'LOCKED';

            // Check predecessor
            let predecessorDone = true;
            if (act.previousActivityId) {
                const prevInsp = inspMap.get(act.previousActivityId);
                if (!prevInsp || prevInsp.status !== 'APPROVED') {
                    predecessorDone = false;
                }
            }

            if (insp) {
                state = insp.status as any;
            } else {
                if (predecessorDone || act.allowBreak) state = 'READY';
                else state = 'LOCKED';
            }

            return { ...act, inspection: insp, statusState: state, predecessorDone };
        });
    }, [activities, inspections]);

    const handleRaiseRFI = async (activity: QualityActivity) => {
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

    const handleUpdateStatus = async (inspectionId: number, status: 'APPROVED' | 'REJECTED') => {
        if (!confirm(`Mark inspection as ${status}?`)) return;
        try {
            await api.patch(`/quality/inspections/${inspectionId}/status`, {
                status,
                comments: status === 'APPROVED' ? 'Approved via Web' : 'Rejected via Web',
                inspectedBy: 'Admin'
            });
            setRefreshKey(k => k + 1);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to update status');
        }
    };

    // Helper for Status Badge
    const StatusBadge = ({ state }: { state: string }) => {
        switch (state) {
            case 'APPROVED': return <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs font-medium"><CheckCircle2 className="w-3 h-3" /> Approved</span>;
            case 'REJECTED': return <span className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-full text-xs font-medium"><XCircle className="w-3 h-3" /> Rejected</span>;
            case 'PENDING': return <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-full text-xs font-medium"><Clock className="w-3 h-3" /> QC Pending</span>;
            case 'READY': return <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded-full text-xs font-medium">Ready to Request</span>;
            default: return <span className="flex items-center gap-1 text-gray-400 bg-gray-100 px-2 py-1 rounded-full text-xs font-medium">Locked</span>;
        }
    };

    // Recursive EPS Renderer
    const renderTree = (nodes: EpsNode[], depth = 0) => (
        <ul className="space-y-1">
            {nodes.map(node => (
                <li key={node.id}>
                    <div
                        onClick={() => setSelectedNodeId(node.id)}
                        className={`flex items-center px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors ${selectedNodeId === node.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                        style={{ paddingLeft: `${depth * 12 + 8}px` }}
                    >
                        {node.children?.length ? <ChevronRight className="w-3 h-3 mr-1 text-gray-400" /> : <span className="w-4" />}
                        {node.name}
                    </div>
                    {node.children && renderTree(node.children, depth + 1)}
                </li>
            ))}
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

                                                {item.statusState === 'PENDING' && item.inspection && (
                                                    <>
                                                        <button
                                                            onClick={() => handleUpdateStatus(item.inspection!.id, 'APPROVED')}
                                                            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-all"
                                                        >
                                                            <CheckCircle2 className="w-4 h-4" />
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() => handleUpdateStatus(item.inspection!.id, 'REJECTED')}
                                                            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-all"
                                                        >
                                                            <XCircle className="w-4 h-4" />
                                                            Reject
                                                        </button>
                                                    </>
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
