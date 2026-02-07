import React, { useState, useEffect } from 'react';
// Force update for docker build
import { useParams } from 'react-router-dom';
import { Network, FileText, ChevronRight, ChevronDown, Calendar, ArrowRight } from 'lucide-react';
import api from '../../../api/axios';

// Reuse Tree Component Logic or simpler custom recursive list
// Let's implement a clean custom side-nav for Asset Tree

interface EpsNode {
    id: number;
    name: string;
    type: string;
    children?: EpsNode[];
}

interface Activity {
    id: number;
    activityCode: string;
    activityName: string;
    startDateMSP?: string;
    finishDateMSP?: string;
    startDatePlanned?: string;
    finishDatePlanned?: string;
    startDateActual?: string;
    finishDateActual?: string;
    status: string;
    masterActivity?: {
        id: number;
        activityName: string;
        startDateMSP?: string;
        finishDateMSP?: string;
        startDatePlanned?: string;
        finishDatePlanned?: string;
        startDateActual?: string;
        finishDateActual?: string;
    };
    wbsNode?: {
        wbsName: string;
    };
}

const DistributedSchedulePanel: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const [assetTree, setAssetTree] = useState<EpsNode[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
    const [selectedNodeName, setSelectedNodeName] = useState<string>('');
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loadingTree, setLoadingTree] = useState(true);
    const [loadingActivities, setLoadingActivities] = useState(false);

    useEffect(() => {
        if (projectId) {
            fetchTree();
        }
    }, [projectId]);

    // useEffect(() => {
    //     if (selectedNodeId) {
    //         fetchActivities(selectedNodeId);
    //     }
    // }, [selectedNodeId]);

    const fetchTree = async () => {
        setLoadingTree(true);
        try {
            const res = await api.get('/eps'); // We get full tree, need to filter for Current Project Children
            // Same logic as Matrix: Find current Project and show its children
            const nodes = Array.isArray(res.data) ? res.data : [];
            const epsMap = new Map();
            nodes.forEach((n: any) => { n.children = []; epsMap.set(n.id, n); });
            nodes.forEach((n: any) => {
                if (n.parentId && epsMap.has(n.parentId)) {
                    epsMap.get(n.parentId).children.push(n);
                }
            });
            const projectNode = epsMap.get(Number(projectId));

            if (projectNode && projectNode.children) {
                setAssetTree(projectNode.children);
            } else {
                setAssetTree([]);
            }
        } catch (err) {
            console.error("Failed to fetch asset tree", err);
        } finally {
            setLoadingTree(false);
        }
    };

    // Helper: Collect all descendant node IDs (including self)
    const getDescendantIds = (node: EpsNode): number[] => {
        let ids = [node.id];
        if (node.children) {
            node.children.forEach(child => {
                ids = [...ids, ...getDescendantIds(child)];
            });
        }
        return ids;
    };

    const fetchActivities = async (node: EpsNode) => {
        setLoadingActivities(true);
        try {
            // Fetch recursively for all descendants
            // Since backend might not support recursion on /wbs/activities, we do it client-side for now
            // or we use the matrix Logic? 
            // Better: Let's assume the backend 'Project' for a Parent EPS does NOT contain the child activities automatically.
            // We fetch for all descendants and aggregate.
            const targetIds = getDescendantIds(node);

            // Optimization: If too many, maybe we should ask backend to support ?recursive=true
            // For now, let's limit to say 20 requests or just do it.
            // Actually, `Promise.all` for 50 floors might be bad.
            // Let's try to just pass the node.id and assume the backend *should* handle it, 
            // but if the user says it's not showing, it means it's not.
            // ALTERNATIVE: Use the distribution-matrix endpoint? No, that returns IDs.
            // Let's implement client-side aggregation for now (simplest without touching backend).

            const requests = targetIds.map(id => api.get(`/projects/${id}/wbs/activities`).catch(() => ({ data: [] })));
            const responses = await Promise.all(requests);

            const allActivities = responses.flatMap(r => r.data);

            // Deduplicate by ID just in case
            const uniqueActivities = Array.from(new Map(allActivities.map((a: any) => [a.id, a])).values()) as Activity[];

            setActivities(uniqueActivities);
        } catch (err) {
            console.error("Failed to fetch distributed activities", err);
            setActivities([]);
        } finally {
            setLoadingActivities(false);
        }
    };

    // Recursive Tree Item
    const TreeItem = ({ node, level = 0 }: { node: EpsNode, level?: number }) => {
        const [expanded, setExpanded] = useState(false);
        const hasChildren = node.children && node.children.length > 0;
        const isSelected = node.id === selectedNodeId;

        return (
            <div className="select-none">
                <div
                    className={`flex items-center px-4 py-2 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                    style={{ paddingLeft: `${level * 16 + 12}px` }}
                    onClick={() => {
                        setSelectedNodeId(node.id);
                        setSelectedNodeName(node.name);
                        fetchActivities(node);
                    }}
                >
                    <span
                        className="mr-2 p-1 rounded hover:bg-gray-200 text-gray-400"
                        onClick={(e) => {
                            e.stopPropagation();
                            setExpanded(!expanded);
                        }}
                    >
                        {hasChildren ? (
                            expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                        ) : <span className="w-3.5 h-3.5 inline-block" />}
                    </span>
                    <span className="truncate text-sm">{node.name}</span>
                    <span className="ml-auto text-[10px] uppercase text-gray-400 border border-gray-100 px-1 rounded bg-white">
                        {node.type}
                    </span>
                </div>
                {expanded && hasChildren && node.children?.map(child => (
                    <TreeItem key={child.id} node={child} level={level + 1} />
                ))}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center bg-gray-50/50">
                <div>
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        Distributed Schedule Viewer
                        <span className="text-xs font-normal text-white px-2 py-1 bg-green-600 rounded-full">Monitoring</span>
                    </h2>
                    <p className="text-xs text-gray-500">Select a Block or Tower to view its specific execution schedule.</p>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel: Asset Tree */}
                <div className="w-1/4 min-w-[250px] border-r border-gray-200 overflow-y-auto bg-gray-50/30">
                    <div className="p-3 text-xs font-bold text-gray-400 uppercase tracking-wider mx-2 mb-2 border-b border-gray-100">
                        Asset Hierarchy
                    </div>
                    {loadingTree ? (
                        <div className="p-4 text-center text-gray-400 text-sm">Loading Assets...</div>
                    ) : assetTree.length === 0 ? (
                        <div className="p-4 text-center text-gray-400 text-sm">No Blocks/Towers found.</div>
                    ) : (
                        <div>
                            {assetTree.map(node => (
                                <TreeItem key={node.id} node={node} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Right Panel: Schedule List */}
                <div className="flex-1 overflow-y-auto bg-white p-4">
                    {!selectedNodeId ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <Network size={48} className="mb-4 text-gray-200" />
                            <p>Select an asset from the left to view its schedule.</p>
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                    <FileText className="text-blue-600" size={24} />
                                    {selectedNodeName}
                                    <span className="text-sm font-normal text-gray-400 ml-2">({activities.length} Activities)</span>
                                </h3>
                            </div>

                            {loadingActivities ? (
                                <div className="p-8 text-center text-gray-500">Loading Schedule...</div>
                            ) : activities.length === 0 ? (
                                <div className="p-8 text-center bg-gray-50 rounded border border-dashed border-gray-300">
                                    <p className="text-gray-500 mb-2">No activities distributed to this asset yet.</p>
                                    <p className="text-xs text-gray-400">Go to "Distribution Matrix" to link activities here.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {activities.map(act => (
                                        <div key={act.id} className="p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow bg-white group">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h4 className={`font-semibold ${(!act.startDateActual && !act.masterActivity?.startDateActual) ? 'text-gray-500' : 'text-gray-800'}`}>
                                                        {act.activityName}
                                                    </h4>
                                                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                                        <span className="font-mono bg-gray-100 px-1 rounded">{act.activityCode}</span>
                                                        {act.wbsNode && <span>in <span className="font-medium">{act.wbsNode.wbsName}</span></span>}
                                                    </div>
                                                </div>

                                                {/* Status Badge */}
                                                {(() => {
                                                    // Derive Status from Dates (with Master Fallback)
                                                    const start = act.startDateActual || act.masterActivity?.startDateActual;
                                                    const finish = act.finishDateActual || act.masterActivity?.finishDateActual;

                                                    let statusLabel = 'NOT STARTED';
                                                    let statusClass = 'bg-gray-100 text-gray-400 border-gray-200';

                                                    if (finish) {
                                                        statusLabel = 'COMPLETED';
                                                        statusClass = 'bg-green-100 text-green-700 border-green-200';
                                                    } else if (start) {
                                                        statusLabel = 'IN PROGRESS';
                                                        statusClass = 'bg-orange-100 text-orange-700 border-orange-200';
                                                    }

                                                    return (
                                                        <div className={`px-2 py-1 rounded-full text-[10px] font-bold border ${statusClass}`}>
                                                            {statusLabel}
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            {/* Master Link & Dates */}
                                            <div className={`mt-3 text-sm grid grid-cols-1 md:grid-cols-2 gap-4 ${(!act.startDateActual && !act.masterActivity?.startDateActual) ? 'opacity-60 grayscale' : ''}`}>
                                                <div className="space-y-2">
                                                    <div className="bg-gray-50 p-2 rounded border border-gray-100">
                                                        <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Planned (MSP)</div>
                                                        <div className="flex items-center gap-2 text-gray-700">
                                                            <Calendar size={14} />
                                                            <span className="font-medium">
                                                                {(() => {
                                                                    const start = act.startDateMSP || act.masterActivity?.startDateMSP || act.startDatePlanned || act.masterActivity?.startDatePlanned;
                                                                    return start ? new Date(start).toLocaleDateString() : '-';
                                                                })()}
                                                            </span>
                                                            <ArrowRight size={14} className="text-gray-300" />
                                                            <span className="font-medium">
                                                                {(() => {
                                                                    const finish = act.finishDateMSP || act.masterActivity?.finishDateMSP || act.finishDatePlanned || act.masterActivity?.finishDatePlanned;
                                                                    return finish ? new Date(finish).toLocaleDateString() : '-';
                                                                })()}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="bg-gray-50 p-2 rounded border border-gray-100">
                                                        <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Actuals</div>
                                                        <div className="flex items-center gap-2 text-gray-700">
                                                            <Calendar size={14} className="text-blue-500" />
                                                            <span className={act.startDateActual || act.masterActivity?.startDateActual ? "text-gray-900" : "text-gray-400 italic"}>
                                                                {(() => {
                                                                    const date = act.startDateActual || act.masterActivity?.startDateActual;
                                                                    return date ? new Date(date).toLocaleDateString() : 'Not Started';
                                                                })()}
                                                            </span>
                                                            <ArrowRight size={14} className="text-gray-300" />
                                                            <span className={act.finishDateActual || act.masterActivity?.finishDateActual ? "text-gray-900" : "text-gray-400 italic"}>
                                                                {(() => {
                                                                    const date = act.finishDateActual || act.masterActivity?.finishDateActual;
                                                                    return date ? new Date(date).toLocaleDateString() : 'In Progress';
                                                                })()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    {/* Delay Logic */}
                                                    {(() => {
                                                        const pFinish = act.finishDateMSP || act.masterActivity?.finishDateMSP || act.finishDatePlanned || act.masterActivity?.finishDatePlanned;
                                                        if (!pFinish) return null;

                                                        const plannedFinish = new Date(pFinish).getTime();
                                                        // Use Master Actual if Local Actual missing
                                                        const actualFinishDate = act.finishDateActual || act.masterActivity?.finishDateActual;
                                                        const actualFinish = actualFinishDate ? new Date(actualFinishDate).getTime() : null;

                                                        let delay = 0;
                                                        let label = "On Track";
                                                        let color = "text-green-600 bg-green-50 border-green-100";

                                                        if (actualFinish) {
                                                            const diffTime = actualFinish - plannedFinish;
                                                            delay = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                                        } else {
                                                            const today = new Date().getTime();
                                                            if (plannedFinish < today) {
                                                                const diffTime = today - plannedFinish;
                                                                delay = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                                            }
                                                        }

                                                        if (delay > 0) {
                                                            label = `${delay} Days Delayed`;
                                                            color = "text-red-600 bg-red-50 border-red-100";
                                                        } else if (delay < 0) {
                                                            label = `${Math.abs(delay)} Days Ahead`;
                                                            color = "text-green-600 bg-green-50 border-green-100";
                                                        }

                                                        return (
                                                            <div className={`p-2 rounded border ${color} flex items-center justify-between`}>
                                                                <div className="text-[10px] uppercase font-bold opacity-70">Schedule Variance</div>
                                                                <div className="font-bold text-sm">{label}</div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {act.masterActivity && (
                                                        <div className="bg-blue-50/50 p-2 rounded border border-blue-100">
                                                            <div className="text-[10px] text-blue-400 uppercase font-bold mb-1">Linked Master Activity</div>
                                                            <div className="text-blue-800 font-medium truncate" title={act.masterActivity.activityName}>
                                                                {act.masterActivity.activityName}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DistributedSchedulePanel;
