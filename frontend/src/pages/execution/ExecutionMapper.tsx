import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import {
  executionService,
  type ExecutionContext,
} from "../../services/execution.service";
import { boqService, type BoqItem } from "../../services/boq.service";
import {
  ArrowLeft,
  Link as LinkIcon,
  Layers,
  Calendar,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

// Types for Schedule Tree
interface WbsNode {
  id: number;
  name: string;
  code: string;
  parentId?: number;
  children: WbsNode[];
  activities: Activity[];
}

interface Activity {
  id: number;
  activityId: string;
  name: string;
  wbsId: number;
}

const ExecutionMapper = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // Data State
  const [wbsTree, setWbsTree] = useState<WbsNode[]>([]);
  const [boqItems, setBoqItems] = useState<BoqItem[]>([]);
  const [contexts, setContexts] = useState<ExecutionContext[]>([]);

  // UI State
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  // Modal Form State
  const [selectedBoqId, setSelectedBoqId] = useState<number | "">("");
  const [allocQty, setAllocQty] = useState<number>(0);

  useEffect(() => {
    if (projectId) startFetch();
  }, [projectId]);

  const startFetch = async () => {
    setLoading(true);
    try {
      const [schedRes, wbsRes, boqRes, contextRes] = await Promise.all([
        api.get(`/projects/${projectId}/schedule`),
        api.get(`/projects/${projectId}/wbs`),
        boqService.getBoqItems(Number(projectId)),
        executionService.getByProject(Number(projectId)),
      ]);

      // Build Tree
      const nodes = Array.isArray(wbsRes.data) ? wbsRes.data : [];
      const activities =
        schedRes.data?.activities && Array.isArray(schedRes.data.activities)
          ? schedRes.data.activities
          : [];

      const tree = buildWbsTree(nodes, activities);
      setWbsTree(tree);

      // Auto-expand root
      if (tree.length > 0) setExpanded({ [tree[0].id]: true });

      setBoqItems(Array.isArray(boqRes) ? boqRes : []);
      setContexts(Array.isArray(contextRes) ? contextRes : []);
    } catch (error) {
      console.error("Fetch error", error);
      alert("Failed to load project data");
    } finally {
      setLoading(false);
    }
  };

  const buildWbsTree = (nodes: any[], activities: any[]): WbsNode[] => {
    const map = new Map<number, WbsNode>();
    nodes.forEach((n) => map.set(n.id, { ...n, children: [], activities: [] }));

    const roots: WbsNode[] = [];

    // Assign Activities
    activities.forEach((a) => {
      const node = map.get(a.wbsNodeId); // Assuming wbsNodeId from backend
      if (node) node.activities.push(a);
    });

    // Build Hierarchy
    nodes.forEach((n) => {
      const node = map.get(n.id)!;
      if (n.parentId) {
        map.get(n.parentId)?.children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  };

  const toggleExpand = (id: number) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateMapping = async () => {
    if (!selectedActivity || !selectedBoqId || !projectId) return;

    // Find BOQ to get Default Quantity (optional, or manual input)
    const boq = boqItems.find((b) => b.id === Number(selectedBoqId));
    if (!boq) return;

    try {
      await executionService.create({
        projectId: Number(projectId),
        epsNodeId: boq.epsNode.id, // Inherit EPS from BOQ? Or Activity? Strategy: BOQ's EPS is the location.
        boqElementId: Number(selectedBoqId),
        activityId: selectedActivity.id,
        plannedQuantity: allocQty,
      });

      // Refresh Contexts
      const updatedContexts = await executionService.getByProject(
        Number(projectId),
      );
      setContexts(updatedContexts);
      setIsModalOpen(false);
      setAllocQty(0);
      setSelectedBoqId("");
    } catch (error) {
      alert("Failed to map BOQ");
    }
  };

  // Filter contexts for selected activity
  const activeMappings = Array.isArray(contexts)
    ? contexts.filter((c) => c.activity?.id === selectedActivity?.id)
    : [];

  // Tree Renderer
  const renderNode = (node: WbsNode) => (
    <div key={node.id} className="ml-4">
      <div
        className="flex items-center py-1 hover:bg-surface-base rounded cursor-pointer"
        onClick={() => toggleExpand(node.id)}
      >
        <span className="mr-1 text-text-muted">
          {node.children.length > 0 ? (
            expanded[node.id] ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )
          ) : (
            <span className="w-3.5" />
          )}
        </span>
        <Layers size={14} className="text-primary mr-2" />
        <span className="text-sm font-medium text-text-secondary">
          {node.code} - {node.name}
        </span>
      </div>

      {expanded[node.id] && (
        <div className="border-l border-border-default ml-2 pl-2">
          {node.activities.map((act) => (
            <div
              key={act.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedActivity(act);
              }}
              className={`flex items-center py-1 px-2 rounded cursor-pointer mt-1 ${selectedActivity?.id === act.id ? "bg-primary-muted border border-blue-200" : "hover:bg-surface-base"}`}
            >
              <Calendar size={14} className="text-success mr-2" />
              <div className="text-sm">
                <span className="font-mono text-text-muted text-xs mr-2">
                  {act.activityId}
                </span>
                <span className="text-gray-800">{act.name}</span>
              </div>
            </div>
          ))}
          {node.children.map((child) => renderNode(child))}
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-surface-card">
      {/* Header */}
      <div className="p-4 border-b border-border-default flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-surface-raised rounded-full"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold text-gray-800">Execution Mapper</h1>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Schedule Tree */}
        <div className="w-1/3 border-r border-border-default flex flex-col">
          <div className="p-3 bg-surface-base border-b border-border-default font-semibold text-sm text-text-secondary">
            Select Activity
          </div>
          <div className="flex-1 overflow-auto p-4">
            {loading ? <div>Loading...</div> : wbsTree.map(renderNode)}
          </div>
        </div>

        {/* Right: Mappings */}
        <div className="flex-1 flex flex-col bg-surface-base">
          {selectedActivity ? (
            <>
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">
                      {selectedActivity.name}
                    </h2>
                    <p className="text-sm text-text-muted font-mono">
                      {selectedActivity.activityId}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-primary text-white px-4 py-2 rounded shadow hover:bg-primary-dark flex items-center gap-2"
                  >
                    <LinkIcon size={16} />
                    Map BOQ Item
                  </button>
                </div>

                <h3 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wider">
                  Linked Scope (BOQ)
                </h3>

                {activeMappings.length === 0 ? (
                  <div className="text-center p-10 bg-surface-card rounded border border-dashed border-border-strong text-text-muted">
                    No BOQ items linked to this activity yet.
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {activeMappings.map((ctx) => (
                      <div
                        key={ctx.id}
                        className="bg-surface-card p-4 rounded shadow-sm border border-border-default"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-semibold text-gray-800">
                              {ctx.boqElement.boqName}
                            </div>
                            <div className="text-xs text-text-muted font-mono mt-1">
                              {ctx.boqElement.boqCode} • {ctx.epsNode.name}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">
                              Qty: {ctx.plannedQuantity}{" "}
                              {ctx.boqElement.unitOfMeasure}
                            </div>
                            <div
                              className={`text-xs font-bold ${ctx.status === "COMPLETED" ? "text-success" : "text-orange-600"}`}
                            >
                              {ctx.status}
                            </div>
                          </div>
                        </div>
                        {/* Progress Bar */}
                        <div className="mt-3 relative h-2 bg-surface-raised rounded-full overflow-hidden">
                          <div
                            className="absolute top-0 left-0 h-full bg-primary transition-all duration-300"
                            style={{
                              width: `${Math.min(100, ctx.percentComplete)}%`,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-text-muted mt-1">
                          <span>Actual: {ctx.actualQuantity}</span>
                          <span>{ctx.percentComplete.toFixed(1)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-text-disabled">
              Select an activity from the left tree to view/edit mappings.
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-surface-overlay flex items-center justify-center z-50">
          <div className="bg-surface-card rounded-lg shadow-xl w-96 p-6">
            <h3 className="text-lg font-bold mb-4">Map BOQ Item</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Select BOQ Item
                </label>
                <select
                  className="w-full border border-border-strong rounded p-2 text-sm"
                  value={selectedBoqId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedBoqId(id);
                    // Auto-fill quantity if possible
                    const boq = boqItems.find((b) => b.id === id);
                    if (boq)
                      setAllocQty(
                        (boq.totalQuantity ?? boq.qty ?? 0) -
                          (boq.consumedQuantity ?? 0),
                      );
                  }}
                >
                  <option value="">-- Select BOQ --</option>
                  {boqItems.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.boqCode} - {b.boqName || b.description} (
                      {(b.totalQuantity ?? b.qty ?? 0) -
                        (b.consumedQuantity ?? 0)}{" "}
                      left)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Allocated Quantity
                </label>
                <input
                  type="number"
                  className="w-full border border-border-strong rounded p-2"
                  value={allocQty}
                  onChange={(e) => setAllocQty(Number(e.target.value))}
                />
                <p className="text-xs text-text-muted mt-1">
                  Determines the weight of this activity.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-text-secondary hover:bg-surface-raised rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMapping}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
              >
                Map Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutionMapper;
