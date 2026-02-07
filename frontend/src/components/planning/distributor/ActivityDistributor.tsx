import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, CheckSquare, Square, Copy, ArrowRight } from 'lucide-react';
import api from '../../../api/axios';
import { useParams } from 'react-router-dom';

const ActivityDistributor: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const [sourceWbs, setSourceWbs] = useState<any[]>([]); // Need WBS Tree logic
    const [targetEps, setTargetEps] = useState<any[]>([]);
    const [selectedActivities, setSelectedActivities] = useState<Set<number>>(new Set());
    const [selectedTargets, setSelectedTargets] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [result, setResult] = useState<{ created: number, skipped: number } | null>(null);

    useEffect(() => {
        if (projectId) {
            fetchData();
        }
    }, [projectId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Source Schedule (Reuse existing Gantt/WBS API or create specific tree?)
            // We need a WBS tree with activities.
            const wbsRes = await api.get(`/projects/${projectId}/wbs`);
            const actRes = await api.get(`/projects/${projectId}/wbs/activities`);

            // Build Tree
            const nodes = wbsRes.data;
            const activities = actRes.data;

            // Merge activities into nodes
            const nodeMap = new Map();
            nodes.forEach((n: any) => {
                n.children = [];
                n.type = 'NODE';
                nodeMap.set(n.id, n);
            });
            const rootNodes: any[] = [];

            nodes.forEach((n: any) => {
                if (n.parentId && nodeMap.has(n.parentId)) {
                    nodeMap.get(n.parentId).children.push(n);
                } else {
                    rootNodes.push(n);
                }
            });

            // Attach activities
            activities.forEach((a: any) => {
                if (nodeMap.has(a.wbsNodeId || a.wbsNode?.id)) {
                    // Check if wbsNode object or ID
                    const wbsId = a.wbsNodeId || a.wbsNode?.id;
                    nodeMap.get(wbsId).children.push({ ...a, type: 'ACTIVITY' });
                }
            });

            setSourceWbs(rootNodes);

            // Fetch Target EPS (Siblings? Or All Projects?)
            // Ideally we want to distribute to "Blocks/Towers" which are "Projects" in this EPS system.
            // Let's fetch EPS tree.
            const epsRes = await api.get('/eps');

            // Filter out current project? Or keep it?
            // And maybe flatten or show hierarchy?
            // Let's show hierarchy but only selectable "PROJECT" type nodes.
            setTargetEps(epsRes.data);

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const toggleActivity = (id: number) => {
        const next = new Set(selectedActivities);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedActivities(next);
    };

    const toggleTarget = (id: number) => {
        const next = new Set(selectedTargets);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedTargets(next);
    };

    const handleDistribute = async () => {
        if (selectedActivities.size === 0 || selectedTargets.size === 0) return;
        setProcessing(true);
        try {
            const res = await api.post('/planning/distribute-schedule', {
                activityIds: Array.from(selectedActivities),
                targetEpsIds: Array.from(selectedTargets)
            });
            setResult(res.data);
            // reset selection?
            setSelectedActivities(new Set());
            setSelectedTargets(new Set());
        } catch (err) {
            console.error(err);
            alert('Failed to distribute schedule');
        } finally {
            setProcessing(false);
        }
    };

    const TreeNode = ({ node, level = 0 }: { node: any, level?: number }) => {
        const isActivity = node.type === 'ACTIVITY';
        const [expanded, setExpanded] = useState(true);

        return (
            <div className="select-none">
                <div
                    className={`flex items-center hover:bg-gray-50 py-1 ${isActivity ? 'ml-6' : ''}`}
                    style={{ paddingLeft: `${level * 16}px` }}
                >
                    {!isActivity && (
                        <button onClick={() => setExpanded(!expanded)} className="mr-1 text-gray-400">
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                    )}

                    {isActivity ? (
                        <button onClick={() => toggleActivity(node.id)} className={`mr-2 ${selectedActivities.has(node.id) ? 'text-blue-600' : 'text-gray-300'}`}>
                            {selectedActivities.has(node.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                    ) : (
                        <span className="mr-2 text-gray-400"><Square size={16} className="opacity-0" /></span> // Placeholder alignment
                    )}

                    <div className="flex-1">
                        <span className={`text-sm ${isActivity ? 'text-gray-700' : 'text-gray-900 font-semibold'}`}>
                            {isActivity ? node.activityName : node.wbsName}
                        </span>
                        {isActivity && <span className="ml-2 text-xs text-gray-400 font-mono">{node.activityCode}</span>}
                    </div>
                </div>
                {expanded && node.children && (
                    <div>
                        {node.children.map((c: any) => <TreeNode key={c.id + (c.type || 'NODE')} node={c} level={level + 1} />)}
                    </div>
                )}
            </div>
        );
    };

    const TargetNode = ({ node, level = 0 }: { node: any, level?: number }) => {
        const [expanded, setExpanded] = useState(true);
        // Only allow selecting if it IS a project (EPS Node Type logic needed? Schema says Type enum).
        // Let's assume we can push to any node for now, but usually leaves.
        // const canSelect = true; // Logic to disable non-projects?

        if (node.id === Number(projectId)) return null; // Skip self

        return (
            <div>
                <div
                    className="flex items-center hover:bg-gray-50 py-1"
                    style={{ paddingLeft: `${level * 16}px` }}
                >
                    {node.children && node.children.length > 0 && (
                        <button onClick={() => setExpanded(!expanded)} className="mr-1 text-gray-400">
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                    )}

                    <button onClick={() => toggleTarget(node.id)} className={`mr-2 ${selectedTargets.has(node.id) ? 'text-green-600' : 'text-gray-300'}`}>
                        {selectedTargets.has(node.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>

                    <div className="flex-1">
                        <span className="text-sm text-gray-800">{node.name}</span>
                        <span className="ml-2 text-xs text-gray-400 uppercase">{node.type}</span>
                    </div>
                </div>
                {expanded && node.children && (
                    <div>
                        {node.children.map((c: any) => <TargetNode key={c.id} node={c} level={level + 1} />)}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div>
                    <h2 className="text-lg font-bold text-gray-800">Schedule Distributor</h2>
                    <p className="text-xs text-gray-500">Clone master activities to other EPS nodes (Towers/Blocks).</p>
                </div>
                <div className="flex items-center gap-4">
                    {result && (
                        <span className={`text-sm ${result.created > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                            Done: {result.created} Created, {result.skipped} Skipped
                        </span>
                    )}
                    <button
                        onClick={handleDistribute}
                        disabled={selectedActivities.size === 0 || selectedTargets.size === 0 || processing}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
                            ${selectedActivities.size > 0 && selectedTargets.size > 0
                                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                    >
                        {processing ? 'Processing...' : (
                            <>
                                <Copy size={16} />
                                Distribute ({selectedActivities.size} to {selectedTargets.size})
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex flex-1 overflow-hidden">
                {/* Source */}
                <div className="flex-1 border-r border-gray-200 flex flex-col min-w-[300px]">
                    <div className="p-2 bg-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Source: Master Schedule
                    </div>
                    <div className="flex-1 overflow-auto p-2">
                        {loading && <div className="p-4 text-center text-gray-400">Loading schedule...</div>}
                        {sourceWbs.map(node => <TreeNode key={node.id} node={node} />)}
                    </div>
                </div>

                {/* Arrow */}
                <div className="w-12 bg-gray-50 flex items-center justify-center border-r border-gray-200">
                    <ArrowRight className="text-gray-300" />
                </div>

                {/* Target */}
                <div className="flex-1 flex flex-col min-w-[300px]">
                    <div className="p-2 bg-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Target: EPS Nodes
                    </div>
                    <div className="flex-1 overflow-auto p-2">
                        {targetEps.map(node => <TargetNode key={node.id} node={node} />)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ActivityDistributor;
