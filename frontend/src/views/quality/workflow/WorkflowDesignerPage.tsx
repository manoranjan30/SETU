import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ReactFlow,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    MarkerType,
    type Connection,
    type Edge,
    type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Save, Plus, Settings } from 'lucide-react';
import api from '../../../api/axios';

// Custom Node component
import WorkflowNode from './WorkflowNode';
import NodePropertiesPanel from './NodePropertiesPanel';

const nodeTypes = {
    approvalNode: WorkflowNode,
};

const WorkflowDesignerPage: React.FC = () => {
    const { projectId } = useParams();
    const navigate = useNavigate();

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);

    useEffect(() => {
        fetchWorkflow();
    }, [projectId]);

    const fetchWorkflow = async () => {
        try {
            setIsLoading(true);
            const res = await api.get(`/quality/workflow-templates?projectId=${projectId}`);
            if (res.data) {
                // Map backend entities to React Flow nodes/edges
                const mappedNodes = res.data.nodes.map((n: any) => ({
                    id: n.id.toString(), // or clientId if we mapped it back
                    type: 'approvalNode',
                    position: n.position || { x: Math.random() * 200, y: Math.random() * 200 },
                    data: { ...n } as Record<string, unknown>,
                }));

                const mappedEdges = res.data.edges.map((e: any) => ({
                    id: `e-${e.sourceNodeId}-${e.targetNodeId}`,
                    source: e.sourceNodeId.toString(),
                    target: e.targetNodeId.toString(),
                    type: 'smoothstep',
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                    },
                }));

                setNodes(mappedNodes);
                setEdges(mappedEdges);
            }
        } catch (error: any) {
            if (error.response?.status !== 404) {
                console.error('Failed to load workflow template:', error);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const onConnect = useCallback((params: Connection | Edge) => {
        setEdges((eds: Edge[]) => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed }, type: 'smoothstep' }, eds));
    }, [setEdges]);

    const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
        setSelectedNode(node);
    }, []);

    const onPaneClick = useCallback(() => {
        setSelectedNode(null);
    }, []);

    const addNode = () => {
        const newNodeId = `node_${Date.now()}`;
        const newNode: Node = {
            id: newNodeId,
            type: 'approvalNode',
            position: { x: 250, y: 150 },
            data: {
                label: `New Step ${nodes.length + 1}`,
                stepType: 'APPROVE',
                assignmentMode: 'USER',
                stepOrder: nodes.length + 1,
                isOptional: false,
                canDelegate: false,
                allowRaiseRFI: false,
                allowStageApprove: false,
                allowFinalApprove: false,
                allowReject: false,
                allowObservation: false,
            },
        };
        setNodes((nds: Node[]) => nds.concat(newNode));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload = {
                projectId: projectId,
                name: `Global Quality Workflow`,
                nodes: nodes.map((n: Node) => ({
                    clientId: n.id,
                    position: n.position,
                    ...n.data,
                })),
                edges: edges.map((e: Edge) => ({
                    sourceClientId: e.source,
                    targetClientId: e.target,
                })),
            };

            await api.post(`/quality/workflow-templates`, payload);
            alert('Workflow saved successfully!');
            fetchWorkflow(); // Refresh IDs
        } catch (error) {
            console.error('Failed to save workflow:', error);
            alert('Failed to save workflow. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleNodeUpdate = (id: string, updatedData: any) => {
        setNodes((nds: Node[]) =>
            nds.map((node: Node) => {
                if (node.id === id) {
                    node.data = { ...node.data, ...updatedData };
                }
                return node;
            })
        );
        if (selectedNode && selectedNode.id === id) {
            setSelectedNode((prev: any) => ({ ...prev, data: { ...prev.data, ...updatedData } }));
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => navigate(`/dashboard/projects/${projectId}/quality/activity-lists`)}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5 text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-xl font-semibold text-gray-800">Global Approval Pipeline</h1>
                        <p className="text-sm text-gray-500">Define the project-wide QC approval sequence</p>
                    </div>
                </div>
                <div className="flex space-x-3">
                    <button
                        onClick={addNode}
                        className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        <span>Add Step</span>
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center space-x-2 bg-[#0E0E0E] text-white px-4 py-2 rounded-md hover:bg-black transition-colors disabled:opacity-50"
                    >
                        <Save className="h-4 w-4" />
                        <span>{isSaving ? 'Saving...' : 'Save Workflow'}</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Canvas */}
                <div className="flex-1 h-full relative">
                    {isLoading ? (
                        <div className="flex h-full items-center justify-center">Loading workflow...</div>
                    ) : (
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            onNodeClick={onNodeClick}
                            onPaneClick={onPaneClick}
                            nodeTypes={nodeTypes}
                            fitView
                            attributionPosition="bottom-left"
                        >
                            <Background gap={16} />
                            <Controls />
                        </ReactFlow>
                    )}
                </div>

                {/* Properties Panel */}
                {selectedNode ? (
                    <div className="w-80 border-l bg-white flex flex-col shadow-lg z-10">
                        <NodePropertiesPanel
                            node={selectedNode}
                            onChange={(updatedData: any) => handleNodeUpdate(selectedNode.id, updatedData)}
                            projectId={Number(projectId)}
                        />
                    </div>
                ) : (
                    <div className="w-80 border-l bg-gray-50 flex flex-col items-center justify-center text-gray-400 p-8 text-center shadow-inner z-10">
                        <Settings className="h-12 w-12 mb-4 opacity-50" />
                        <p>Select a node to edit its properties and permissions.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorkflowDesignerPage;
