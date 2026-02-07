import React, { useState, useEffect } from 'react';
import { MatrixHeader, flattenHeaderTree } from './MatrixHeader';
import { MatrixFilterSidebar } from './MatrixFilterSidebar'; // Import Sidebar
import { ChevronRight, ChevronDown, Square, CheckSquare, Loader, Filter } from 'lucide-react'; // Import Filter Icon
import api from '../../../api/axios';
import { useParams } from 'react-router-dom';

interface MatrixData {
    [masterActivityId: string]: number[]; // EPS Node IDs
}

const ScheduleDistributionMatrix: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const [sourceWbs, setSourceWbs] = useState<any[]>([]);
    const [targetEpsRoot, setTargetEpsRoot] = useState<any[]>([]); // Root EPS Nodes (Blocks)

    // Header State
    const [headerRows, setHeaderRows] = useState<any[][]>([]);
    const [leafColumns, setLeafColumns] = useState<any[]>([]);
    const [expandedHeaders, setExpandedHeaders] = useState<number[]>([]);

    // Filter State
    const [showFilter, setShowFilter] = useState(false);
    const [hiddenNodeIds, setHiddenNodeIds] = useState<number[]>([]);

    // Row Expansion State (Lifted up)
    const [expandedRows, setExpandedRows] = useState<number[]>([]);

    const [matrix, setMatrix] = useState<MatrixData>({});
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<Record<string, boolean>>({});
    const [restrictToFloor, setRestrictToFloor] = useState(true);

    useEffect(() => {
        if (projectId) {
            fetchStructure();
            fetchMatrix();
        }
    }, [projectId]);

    const handleNodeVisibilityToggle = (nodeId: number, visible: boolean) => {
        setHiddenNodeIds((prev: number[]) => {
            if (visible) return prev.filter(id => id !== nodeId);
            return [...prev, nodeId];
        });
    };

    // Recalculate Grid when Expansion Changes OR Filter Changes
    useEffect(() => {
        if (targetEpsRoot.length > 0) {

            // 1. Filter Tree based on hiddenNodeIds
            // Helper to recursively filter the tree
            const filterTree = (nodes: any[]): any[] => {
                return nodes
                    .filter((n: any) => !hiddenNodeIds.includes(n.id)) // removed map().filter() chain for simplicity
                    .map((n: any) => {
                        // Clone node to avoid mutating state directly (shallow clone of node)
                        const newNode = { ...n };
                        if (newNode.children) {
                            newNode.children = filterTree(newNode.children);
                        }
                        return newNode;
                    });
            };

            const filteredRoots = filterTree(targetEpsRoot);

            if (filteredRoots.length === 0) {
                setHeaderRows([]);
                setLeafColumns([]);
                return;
            }

            // Apply Stop Type to header generation
            const stopType = restrictToFloor ? 'FLOOR' : undefined;
            const rows = flattenHeaderTree(filteredRoots, expandedHeaders, stopType);
            setHeaderRows(rows);

            // Calculate Visible Columns (The actual grid columns)
            // We want to show whatever the user has expanded down to.
            // If Block A is collapsed, it is a column.
            // If Expanded, its children are columns.
            const visibleColumns: any[] = [];

            const collectVisible = (nodes: any[]) => {
                nodes.forEach((node: any) => {
                    const isExpanded = expandedHeaders.includes(node.id);
                    const hasChildren = node.children && node.children.length > 0;

                    // Restrict expansion beyond Floor level if enabled
                    // Check against Type insensitive
                    const isFloor = node.type && node.type.toUpperCase() === 'FLOOR';
                    const isRestricted = restrictToFloor && isFloor;

                    if (!hasChildren || !isExpanded || isRestricted) {
                        visibleColumns.push(node);
                    } else {
                        collectVisible(node.children);
                    }
                });
            };
            collectVisible(filteredRoots);
            setLeafColumns(visibleColumns);
        }
    }, [targetEpsRoot, expandedHeaders, restrictToFloor, hiddenNodeIds]);

    const fetchStructure = async () => {
        setLoading(true);
        try {
            const [wbsRes, actRes, epsRes] = await Promise.all([
                api.get(`/projects/${projectId}/wbs`),
                api.get(`/projects/${projectId}/wbs/activities`),
                api.get('/eps')
            ]);

            // 1. Build Source Tree (WBS)
            const nodes = wbsRes.data;
            const activities = actRes.data;

            const nodeMap = new Map();
            nodes.forEach((n: any) => { n.children = []; n.type = 'NODE'; nodeMap.set(n.id, n); });
            const rootNodes: any[] = [];
            nodes.forEach((n: any) => {
                if (n.parentId && nodeMap.has(n.parentId)) {
                    nodeMap.get(n.parentId).children.push(n);
                } else {
                    rootNodes.push(n);
                }
            });
            activities.forEach((a: any) => {
                const wbsId = a.wbsNodeId || a.wbsNode?.id;
                if (nodeMap.has(wbsId)) nodeMap.get(wbsId).children.push({ ...a, type: 'ACTIVITY' });
            });
            setSourceWbs(rootNodes);

            // Auto-expand WBS roots initially
            // Check if we already have expandedRows to avoid reset
            setExpandedRows(prev => prev.length === 0 ? rootNodes.map((n: any) => n.id) : prev);

            // 2. Build Target Tree (EPS)
            const epsNodes = Array.isArray(epsRes.data) ? epsRes.data : [];
            const epsMap = new Map();
            epsNodes.forEach((n: any) => { n.children = []; epsMap.set(n.id, n); });
            epsNodes.forEach((n: any) => {
                if (n.parentId && epsMap.has(n.parentId)) {
                    epsMap.get(n.parentId).children.push(n);
                }
            });

            // Force Recursive Natural Sort
            const naturalSort = (nodes: any[]) => {
                nodes.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
                nodes.forEach(n => {
                    if (n.children && n.children.length > 0) {
                        naturalSort(n.children);
                    }
                });
            };

            // Apply sort to all nodes who have children
            epsNodes.forEach((n: any) => {
                if (n.children && n.children.length > 0) {
                    naturalSort(n.children);
                }
            });

            // Find the Current Project Node
            const projectNode = epsMap.get(Number(projectId));
            let relevantRoots: any[] = [];
            if (projectNode && projectNode.children) {
                relevantRoots = projectNode.children;
            }
            // Auto expand first level EPS
            setExpandedHeaders(relevantRoots.map((n: any) => n.id));
            setTargetEpsRoot(relevantRoots);

        } catch (err) {
            console.error("Failed to load structure", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMatrix = async () => {
        try {
            const matrixRes = await api.get(`/planning/${projectId}/distribution-matrix`);
            setMatrix(matrixRes.data);
        } catch (err) {
            console.error("Failed to load matrix", err);
        }
    };

    const handleHeaderToggle = (type: 'expand' | 'collapse', nodeId: number) => {
        setExpandedHeaders(prev => {
            if (type === 'expand') return [...prev, nodeId];
            return prev.filter(id => id !== nodeId);
        });
    };

    // WBS Toggle
    const handleRowToggle = (nodeId: number) => {
        setExpandedRows(prev => {
            if (prev.includes(nodeId)) return prev.filter(id => id !== nodeId);
            return [...prev, nodeId];
        });
    };

    const handleColumnSelect = (nodeId: number) => {
        const isExpanded = expandedHeaders.includes(nodeId);
        handleHeaderToggle(isExpanded ? 'collapse' : 'expand', nodeId);
    };

    // ---------------------------------------------------------
    // RECURSIVE LINKING LOGIC
    // ---------------------------------------------------------

    // Helper: Get ALL Activity IDs under a WBS Node
    const getDescendantActivityIds = (node: any): number[] => {
        let ids: number[] = [];
        if (node.type === 'ACTIVITY') {
            ids.push(node.id);
        }
        if (node.children) {
            node.children.forEach((child: any) => {
                ids = [...ids, ...getDescendantActivityIds(child)];
            });
        }
        return ids;
    };

    // Helper: Get ALL Leaf EPS IDs under an EPS Node
    // We treat 'Leaves' as the actual distribution targets (Floors/Units)
    const getDescendantEpsIds = (node: any): number[] => {
        let ids: number[] = [];
        if (!node.children || node.children.length === 0) {
            ids.push(node.id);
        } else {
            node.children.forEach((child: any) => {
                ids = [...ids, ...getDescendantEpsIds(child)];
            });
        }
        return ids;
    };

    const handleToggle = async (rowNode: any, targetNode: any, currentStatus: boolean) => {
        const key = `${rowNode.id}-${targetNode.id}`;
        if (processing[key]) return;

        // 1. Resolve Activities
        const activityIds = getDescendantActivityIds(rowNode);
        if (activityIds.length === 0) return;

        // 2. Resolve Targets
        const targetEpsIds = getDescendantEpsIds(targetNode);
        if (targetEpsIds.length === 0) return;

        // 3. Confirm if massive
        const totalLinks = activityIds.length * targetEpsIds.length;
        if (totalLinks > 10) {
            const confirmMsg = `Top-Down Linking:\n\nSource: ${rowNode.activityName || rowNode.wbsName} (${activityIds.length} activities)\nTarget: ${targetNode.name} (${targetEpsIds.length} locations)\n\nThis will create ${totalLinks} links. Proceed?`;
            if (!window.confirm(confirmMsg)) return;
        }

        setProcessing(prev => ({ ...prev, [key]: true }));
        try {
            if (!currentStatus) {
                // Link
                await api.post('/planning/distribute-schedule', {
                    activityIds: activityIds,
                    targetEpsIds: targetEpsIds
                });
            } else {
                // Unlink
                await api.post('/planning/undistribute-schedule', {
                    activityIds: activityIds,
                    targetEpsIds: targetEpsIds
                });
            }

            // Refresh ONLY Matrix Data (Silent Refresh)
            await fetchMatrix();

        } catch (err) {
            console.error(err);
            alert("Action failed");
        } finally {
            setProcessing(prev => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }
    };

    // Recursive Row Renderer
    const Row = ({ node, level = 0 }: { node: any, level?: number }) => {
        const isActivity = node.type === 'ACTIVITY';
        const isExpanded = expandedRows.includes(node.id);
        const paddingLeft = level * 20 + 12;

        return (
            <>
                <tr className={`hover:bg-blue-50 transition-colors group border-b border-gray-100 ${isActivity ? 'bg-white' : 'bg-gray-50/50'}`}>
                    {/* WBS Name Column */}
                    <td className="sticky left-0 z-20 border-r border-gray-200 p-0 shadow-[2px_0_5px_rgba(0,0,0,0.05)] bg-inherit align-middle">
                        <div className="flex items-center h-10 pr-2 border-l-4 border-transparent hover:border-blue-400 transition-colors" style={{ paddingLeft }}>
                            {!isActivity && (
                                <button onClick={() => handleRowToggle(node.id)} className="mr-2 text-gray-400 hover:text-gray-700 transition-transform">
                                    {isExpanded ? <ChevronDown size={14} strokeWidth={2.5} /> : <ChevronRight size={14} strokeWidth={2.5} />}
                                </button>
                            )}
                            {isActivity ? (
                                <div className="flex flex-col truncate">
                                    <span className="text-sm text-gray-700 truncate font-medium" title={node.activityName}>{node.activityName}</span>
                                </div>
                            ) : (
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide truncate" title={node.wbsName}>{node.wbsName}</span>
                            )}
                        </div>
                    </td>

                    {/* Columns for Visible Targets */}
                    {leafColumns.map(target => {
                        // Check recursive distribution Status
                        // We need to know if this cell is "Full", "Partial", or "Empty"
                        // Expensive to calculate perfectly?
                        const checkRecursively = (n: any): boolean => {
                            if (n.type === 'ACTIVITY') {
                                // Is this activity linked to ANY descendant of the target column?
                                // If target is a leaf, checking matrix[id].includes(target.id) is enough.
                                // If target is a parent, we need to check if matrix[id] intersects with target's descendants.
                                const targetIds = getDescendantEpsIds(target);
                                return targetIds.some(tid => matrix[n.id]?.includes(tid));
                            }
                            // If WBS Parent, check if ANY child is linked
                            if (n.children) return n.children.some(checkRecursively);
                            return false;
                        };

                        const isDistributed = checkRecursively(node);
                        const isProcessing = processing[`${node.id}-${target.id}`];

                        // Style differs for Parent vs Activity
                        const btnClass = isDistributed
                            ? 'bg-blue-50/50 hover:bg-green-50 group-hover:bg-blue-100'
                            : 'text-gray-200 hover:text-gray-400 group-hover:bg-white';

                        return (
                            <td key={target.id} className="border-r border-gray-100 p-0 text-center min-w-[100px] align-middle">
                                <button
                                    onClick={() => handleToggle(node, target, isDistributed)}
                                    className={`w-full h-10 flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-100 ${btnClass}`}
                                    disabled={isProcessing}
                                    title={isDistributed ? "Partially/Fully Linked" : "Click to Link Tree"}
                                >
                                    {isProcessing ? (
                                        <Loader size={16} className="animate-spin text-blue-500" />
                                    ) : isDistributed ? (
                                        <CheckSquare size={18} className="text-blue-600 drop-shadow-sm" fill="currentColor" fillOpacity={isActivity ? 0.1 : 0.05} />
                                    ) : (
                                        <Square size={18} strokeWidth={1.5} className="group-hover:text-gray-300" />
                                    )}
                                </button>
                            </td>
                        );
                    })}
                </tr>
                {/* Children rows */}
                {isExpanded && node.children && node.children.map((c: any) => (
                    <Row key={c.id + (c.type || 'NODE')} node={c} level={level + 1} />
                ))}
            </>
        );
    };

    return (
        <div className="flex flex-col h-full w-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative min-h-0">
            <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center z-20 flex-shrink-0">
                <div>
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        Schedule Mapper
                        <span className="text-xs font-normal text-white px-2 py-1 bg-blue-600 rounded-full">Hierarchical</span>
                    </h2>
                    <p className="text-xs text-gray-500">
                        <b>Top-Down Linking:</b> Click the intersection of a Parent WBS and Parent Block to link ALL sub-activities to ALL sub-floors.
                    </p>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                    <button
                        onClick={() => setShowFilter(!showFilter)}
                        className={`flex items-center gap-2 px-3 py-1 rounded border transition-colors ${showFilter ? 'bg-blue-100 border-blue-200 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                    >
                        <Filter size={14} />
                        Filter View
                    </button>
                    <label className="flex items-center gap-2 cursor-pointer bg-blue-50 px-3 py-1 rounded border border-blue-100 hover:bg-blue-100 transition-colors">
                        <input
                            type="checkbox"
                            checked={restrictToFloor}
                            onChange={(e) => setRestrictToFloor(e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="font-medium text-blue-800 text-xs">Restrict to Floor Level</span>
                    </label>
                    <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1"><CheckSquare size={14} className="text-blue-600" /> Linked</span>
                        <span className="flex items-center gap-1"><Square size={14} className="text-gray-300" /> Unlinked</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto relative bg-gray-50/50 min-h-0 flex">
                {/* Filter Sidebar overlay or side-by-side */}
                {showFilter && (
                    <MatrixFilterSidebar
                        nodes={targetEpsRoot}
                        hiddenNodeIds={hiddenNodeIds}
                        onToggleNode={handleNodeVisibilityToggle}
                        onClose={() => setShowFilter(false)}
                    />
                )}

                {loading && (
                    <div className="absolute inset-0 bg-white/80 z-50 flex items-center justify-center">
                        <div className="flex flex-col items-center">
                            <Loader className="animate-spin text-blue-600 mb-2" />
                            <span className="text-gray-500 font-medium">Loading Hierarchy...</span>
                        </div>
                    </div>
                )}

                {!loading && targetEpsRoot.length > 0 && sourceWbs.length > 0 && (
                    <table className="min-w-full border-separate border-spacing-0 bg-white">
                        <thead className="sticky top-0 z-30 bg-gray-50 shadow-sm">
                            {headerRows.map((row, rowIndex) => (
                                <tr key={rowIndex}>
                                    {rowIndex === 0 && (
                                        <th
                                            rowSpan={headerRows.length}
                                            className="sticky left-0 z-40 bg-gray-100 border-r border-b border-gray-300 p-3 text-left w-[300px] min-w-[300px] shadow-[2px_0_5px_rgba(0,0,0,0.05)] align-bottom"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Master Schedule</span>
                                                <span className="text-[10px] text-gray-400 bg-gray-200 px-1 rounded">{sourceWbs.length} Roots</span>
                                            </div>
                                        </th>
                                    )}
                                    {row.map(node => (
                                        <MatrixHeader
                                            key={node.id}
                                            node={node}
                                            depth={rowIndex}
                                            onToggle={handleHeaderToggle}
                                            onSelect={handleColumnSelect}
                                            expandedNodes={expandedHeaders}
                                            isLocked={restrictToFloor && node.type && node.type.toUpperCase() === 'FLOOR'}
                                        />
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {sourceWbs.map(node => <Row key={node.id} node={node} />)}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default ScheduleDistributionMatrix;