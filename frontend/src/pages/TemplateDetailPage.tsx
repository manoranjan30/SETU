import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/axios";
import {
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  Layers,
  ArrowLeft,
} from "lucide-react";
import clsx from "clsx";
// We need a simpler Modal for Template Nodes (Code + Name + ControlAccount)
// Reuse WbsModal? WbsModal is tied to `projectId`.
// Let's create a small inline modal or a dedicated `TemplateNodeModal`.

interface WbsTemplateNode {
  id: number;
  wbsCode: string;
  wbsName: string;
  parentId: number | null;
  children?: WbsTemplateNode[];
  isControlAccount: boolean;
}

const TemplateDetailPage: React.FC = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const [wbsData, setWbsData] = useState<WbsTemplateNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<WbsTemplateNode | null>(
    null,
  ); // For Edit
  const [parentNode, setParentNode] = useState<WbsTemplateNode | null>(null); // For Add Child

  // Form State
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formIsCA, setFormIsCA] = useState(false);

  useEffect(() => {
    if (templateId) fetchNodes();
  }, [templateId]);

  const fetchNodes = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/wbs/templates/${templateId}/nodes`);
      const tree = buildTree(res.data);
      setWbsData(tree);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const buildTree = (flatList: WbsTemplateNode[]): WbsTemplateNode[] => {
    const map = new Map<number, WbsTemplateNode>();
    const roots: WbsTemplateNode[] = [];

    flatList.forEach((node) => {
      map.set(node.id, { ...node, children: [] });
    });

    flatList.forEach((node) => {
      const mappedNode = map.get(node.id)!;
      if (node.parentId) {
        const parent = map.get(node.parentId);
        if (parent) {
          parent.children?.push(mappedNode);
        }
      } else {
        roots.push(mappedNode);
      }
    });
    return roots;
  };

  const toggleExpand = (id: number) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedIds(newSet);
  };

  const openCreate = (parent: WbsTemplateNode | null) => {
    setSelectedNode(null);
    setParentNode(parent);
    setFormCode("");
    setFormName("");
    setFormIsCA(false);
    setIsModalOpen(true);
  };

  /*
    const openEdit = (node: WbsTemplateNode) => {
        setSelectedNode(node);
        setParentNode(null); 
        setFormCode(node.wbsCode);
        setFormName(node.wbsName);
        setFormIsCA(node.isControlAccount);
        setIsModalOpen(true);
    };
    */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedNode) {
        // Edit (Not implemented fully in backend yet? We added delete/create. Did we add Update?)
        // Wait, I only added `create` and `delete` to Service.
        // Let's assume Delete + Recreate for structure changes, but for simple name/code edit we need Update.
        // Assuming I missed Update? I checked `wbs-template.dto.ts` I added Create/Update DTOs.
        // I checked `wbs.service.ts` I added create, get, delete.
        // I DID NOT add `updateTemplateNode`.
        // For MVP, user can Delete and Create.
        // Or I should quickly add Update?
        // I added DTO `UpdateWbsTemplateNodeDto`.
        // I will Add logic for Update real quick in next step. For now UI assumes it exists (or I skip Edit).
        alert("Update not implemented yet. Please Delete and Re-create.");
        // TODO: Implement Update
      } else {
        // Create
        await api.post(`/wbs/templates/nodes`, {
          templateId: Number(templateId),
          parentId: parentNode?.id || null,
          wbsCode: formCode,
          wbsName: formName,
          isControlAccount: formIsCA,
        });
      }
      setIsModalOpen(false);
      fetchNodes();
      if (parentNode) {
        setExpandedIds((prev) => new Set(prev).add(parentNode.id));
      }
    } catch (err) {
      alert("Failed to save");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure?")) return;
    try {
      await api.delete(`/wbs/templates/nodes/${id}`);
      fetchNodes();
    } catch (err) {
      alert("Failed to delete");
    }
  };

  const renderTree = (nodes: WbsTemplateNode[], level: number = 0) => {
    return nodes.map((node) => {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedIds.has(node.id);

      return (
        <div key={node.id} className="select-none">
          <div
            className={clsx(
              "flex items-center py-2 px-2 border-b border-border-subtle hover:bg-surface-base transition-colors",
            )}
            style={{ paddingLeft: `${level * 24 + 12}px` }}
          >
            <button
              onClick={() => toggleExpand(node.id)}
              className={clsx(
                "p-1 mr-2 rounded text-text-disabled hover:text-text-secondary",
                !hasChildren && "opacity-0 cursor-default",
              )}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            <span className="font-mono text-xs font-semibold text-text-muted w-24 mr-4 bg-surface-raised px-1 py-0.5 rounded">
              {node.wbsCode}
            </span>

            <Layers
              className={clsx(
                "w-4 h-4 mr-2",
                node.isControlAccount ? "text-primary" : "text-text-disabled",
              )}
            />
            <span className="font-medium text-sm flex-1 text-text-secondary">
              {node.wbsName}
              {node.isControlAccount && (
                <span className="ml-2 text-[10px] bg-info-muted text-blue-700 px-1.5 py-0.5 rounded-full font-bold">
                  CA
                </span>
              )}
            </span>

            <div className="flex gap-1">
              <button
                onClick={() => openCreate(node)}
                className="p-1 text-success hover:bg-green-100 rounded"
                title="Add Child"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(node.id)}
                className="p-1 text-error hover:bg-red-100 rounded"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {isExpanded && hasChildren && (
            <div>{renderTree(node.children!, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link
            to="/wbs/templates"
            className="text-text-muted text-sm hover:underline mb-1 flex items-center"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Templates
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">
            Edit Template Structure
          </h1>
          <p className="text-sm text-text-muted">Template ID: {templateId}</p>
        </div>
        <button
          onClick={() => openCreate(null)}
          className="bg-primary text-white px-4 py-2 rounded-lg flex items-center hover:bg-primary-dark shadow-sm"
        >
          <Plus className="w-5 h-5 mr-2" /> Add Root Node
        </button>
      </div>

      <div className="bg-surface-card border rounded-xl overflow-hidden shadow-sm flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-text-disabled">Loading...</div>
        ) : wbsData.length === 0 ? (
          <div className="p-12 text-center text-text-disabled">
            <p>No nodes defined for this template.</p>
          </div>
        ) : (
          <div className="p-4">
            <div className="bg-surface-base px-4 py-2 text-xs font-semibold text-text-muted uppercase flex border-b border-border-default">
              <span className="w-8"></span>
              <span className="w-24 mr-4">Code</span>
              <span className="flex-1">Name</span>
              <span className="w-20">Actions</span>
            </div>
            {renderTree(wbsData)}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-70 flex justify-center items-center z-50">
          <div className="bg-surface-card rounded-lg shadow-xl w-[400px] p-6">
            <h3 className="font-bold text-lg mb-4">
              {selectedNode ? "Edit Node" : "Add Node"}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">
                  WBS Code (e.g. 1.1)
                </label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>
              <div className="mb-6 flex items-center">
                <input
                  type="checkbox"
                  id="isCA"
                  className="rounded border-border-strong text-primary focus:ring-primary"
                  checked={formIsCA}
                  onChange={(e) => setFormIsCA(e.target.checked)}
                />
                <label
                  htmlFor="isCA"
                  className="ml-2 text-sm text-text-secondary"
                >
                  Is Control Account?
                </label>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 hover:bg-surface-raised rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateDetailPage;
