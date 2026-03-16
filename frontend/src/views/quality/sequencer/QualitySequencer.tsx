import { useCallback, useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Edge,
  type Node,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "react-hot-toast";
import { ArrowLeft, Save, List, Network } from "lucide-react";
import { qualityService } from "../../../services/quality.service";
import { QualityActivityNode } from "./QualityActivityNode";
import Sidebar from "./Sidebar";
import type { UpdateGraphDto } from "../../../types/quality";

const nodeTypes: any = {
  activityNode: QualityActivityNode,
};

function SequencerContent() {
  const { listId, projectId } = useParams<{
    listId: string;
    projectId: string;
  }>();
  const navigate = useNavigate();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { screenToFlowPosition } = useReactFlow();

  // Load initial graph
  useEffect(() => {
    if (!listId) return;

    const loadGraph = async () => {
      try {
        const data = await qualityService.getSequence(Number(listId));
        const safeNodes = data.nodes.map((n: any) => ({
          ...n,
          type: "activityNode",
          data: { ...n.data, id: n.id },
        }));
        setNodes(safeNodes);
        setEdges(data.edges || []);
      } catch (error) {
        console.error("Failed to load sequence", error);
        toast.error("Failed to load sequence graph");
      } finally {
        setLoading(false);
      }
    };

    loadGraph();
  }, [listId]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  const onConnect: OnConnect = useCallback((params) => {
    if (params.source === params.target) return;

    setEdges((eds) =>
      addEdge(
        {
          ...params,
          type: "default",
          animated: false,
          style: { stroke: "#ef4444", strokeWidth: 2 },
          data: { constraintType: "HARD" },
        },
        eds,
      ),
    );
  }, []);

  const onEdgeClick = (_event: React.MouseEvent, edge: Edge) => {
    const currentType = (edge.data?.constraintType as string) || "HARD";
    const newType = currentType === "HARD" ? "SOFT" : "HARD";

    setEdges((eds) =>
      eds.map((e) => {
        if (e.id === edge.id) {
          return {
            ...e,
            animated: newType === "SOFT",
            style: {
              ...e.style,
              stroke: newType === "HARD" ? "#ef4444" : "#eab308",
            },
            data: { ...e.data, constraintType: newType },
          };
        }
        return e;
      }),
    );

    toast.success(`Changed to ${newType} Constraint`);
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      if (typeof type === "undefined" || !type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const name = window.prompt("Enter Activity Name:");
      if (!name) return;

      try {
        const newActivity = await qualityService.createActivity(
          Number(listId),
          { activityName: name },
        );

        const newNode: Node = {
          id: String(newActivity.id),
          type,
          position,
          data: {
            label: name,
            sequence: newActivity.sequence,
            description: newActivity.description,
          },
        };

        setNodes((nds) => nds.concat(newNode));
        toast.success("Activity added!");
      } catch (error) {
        console.error(error);
        toast.error("Failed to create activity");
      }
    },
    [screenToFlowPosition, listId],
  );

  const onSave = async () => {
    if (!listId) return;
    setSaving(true);

    const payload: UpdateGraphDto = {
      nodes: nodes.map((n) => ({
        id: Number(n.id),
        position: n.position,
      })),
      edges: edges.map((e) => ({
        sourceId: Number(e.source),
        targetId: Number(e.target),
        constraintType: (e.data?.constraintType as "HARD" | "SOFT") || "HARD",
        lagMinutes: (e.data?.lagMinutes as number) || 0,
      })),
    };

    try {
      await qualityService.saveSequence(Number(listId), payload);
      toast.success("Sequence saved successfully!");
    } catch (error: any) {
      console.error("Save failed", error);
      toast.error(error.response?.data?.message || "Failed to save sequence");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="p-10 text-center flex items-center justify-center h-full">
        Loading sequencer...
      </div>
    );

  return (
    <div className="dndflow h-screen w-full flex flex-col">
      <div className="bg-surface-card border-b px-6 py-3 flex justify-between items-center z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-text-muted" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              Quality Workflow Editor
            </h1>
            <p className="text-xs text-text-muted">
              Drag connections to define inspection sequence
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex bg-surface-raised p-1 rounded-lg">
            <button
              onClick={() =>
                navigate(
                  `/dashboard/projects/${projectId}/quality/activity-lists/${listId}/activities`,
                )
              }
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md text-text-muted hover:text-text-secondary hover:bg-gray-200 transition-colors"
            >
              <List className="w-4 h-4" /> Activity Editor
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md shadow bg-surface-card text-indigo-700">
              <Network className="w-4 h-4" /> Workflow Editor
            </button>
          </div>
          <button
            onClick={onSave}
            disabled={saving}
            className="bg-primary hover:bg-primary-dark disabled:opacity-70 text-white px-4 py-2 rounded shadow-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Workflow"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden" ref={reactFlowWrapper}>
        <Sidebar />
        <div className="flex-1 bg-surface-base relative h-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeClick={onEdgeClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            fitView
            className="bg-surface-base"
          >
            <Controls />
            <Background color="#ccc" gap={20} />
          </ReactFlow>

          <div className="absolute top-4 right-4 bg-surface-card/95 backdrop-blur shadow-lg p-4 rounded-xl text-sm border border-border-default w-64 select-none pointer-events-none">
            <h3 className="font-bold mb-3 text-slate-800 border-b pb-2">
              Constraints Legend
            </h3>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-1 bg-error rounded-full"></div>
              <span className="font-medium text-text-secondary">
                Hard (Unbreakable)
              </span>
            </div>
            <div className="text-xs text-text-muted mb-3 ml-11">
              Successor is BLOCKED until predecessor is approved.
            </div>

            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-1 bg-yellow-500 rounded-full border border-dashed border-yellow-600"></div>
              <span className="font-medium text-text-secondary">
                Soft (Warning)
              </span>
            </div>
            <div className="text-xs text-text-muted ml-11">
              Shows warning but allows bypass with a reason.
            </div>

            <div className="mt-4 pt-3 border-t text-xs text-text-disabled italic">
              * Click on a connection line to toggle constraint type.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QualitySequencer() {
  return (
    <ReactFlowProvider>
      <SequencerContent />
    </ReactFlowProvider>
  );
}
