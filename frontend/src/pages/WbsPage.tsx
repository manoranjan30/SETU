import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/axios";
import {
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  Layers,
} from "lucide-react";
import clsx from "clsx";
import WbsModal from "../components/wbs/WbsModal";
import TemplateImportModal from "../components/wbs/TemplateImportModal";
import WbsImportModal from "../components/wbs/WbsImportWizard";
import SaveTemplateModal from "../components/wbs/SaveTemplateModal";
import { LayoutTemplate, FileSpreadsheet, Save } from "lucide-react";
import WbsTemplatesTab from "../components/wbs/WbsTemplatesTab";
import { exportUtils } from "../utils/export.utils";
import { resolveRegisteredExportFileName } from "../utils/export.registry";

interface WbsNode {
  id: number;
  wbsCode: string;
  wbsName: string;
  parentId: number | null;
  children?: WbsNode[];
  isControlAccount: boolean;
  responsibleUser?: { username: string };
  responsibleRole?: { name: string };
}

const WbsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [wbsData, setWbsData] = useState<WbsNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<WbsNode | null>(null); // For Edit
  const [parentNode, setParentNode] = useState<WbsNode | null>(null); // For Add Child
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState(false);

  useEffect(() => {
    if (projectId) fetchWbs();
  }, [projectId]);

  // Auto-expand root when data loads for the first time
  useEffect(() => {
    if (wbsData.length > 0 && expandedIds.size === 0) {
      toggleExpand(wbsData[0].id);
    }
  }, [wbsData]);

  const fetchWbs = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/projects/${projectId}/wbs`);
      // Backend returns flat list, we need to build tree
      const tree = buildTree(res.data);
      setWbsData(tree);
      // Auto expand root ONLY if first load
      // (Moved to useEffect)
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const buildTree = (flatList: WbsNode[]): WbsNode[] => {
    const map = new Map<number, WbsNode>();
    const roots: WbsNode[] = [];

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

  const flattenTree = (nodes: WbsNode[], depth = 0): Array<Record<string, unknown>> =>
    nodes.flatMap((node) => {
      const current = {
        wbsCode: node.wbsCode,
        wbsName: node.wbsName,
        parentCode:
          node.parentId != null
            ? (() => {
                const parent = findNodeById(wbsData, node.parentId);
                return parent?.wbsCode || "";
              })()
            : "",
        level: depth + 1,
        isControlAccount: node.isControlAccount ? "TRUE" : "FALSE",
        responsibleRole: node.responsibleRole?.name || "",
        responsibleUser: node.responsibleUser?.username || "",
      };
      return [current, ...flattenTree(node.children || [], depth + 1)];
    });

  const findNodeById = (nodes: WbsNode[], id: number): WbsNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      const found = findNodeById(node.children || [], id);
      if (found) return found;
    }
    return null;
  };

  const exportRows = flattenTree(wbsData);

  const handleExport = (format: "EXCEL" | "CSV") => {
    const fileName = resolveRegisteredExportFileName("wbs.structure", {
      projectId,
    });
    const columns = [
      { key: "wbsCode", label: "WBS Code" },
      { key: "wbsName", label: "WBS Name" },
      { key: "parentCode", label: "Parent WBS Code" },
      { key: "level", label: "Level" },
      { key: "isControlAccount", label: "Control Account" },
      { key: "responsibleRole", label: "Responsible Role" },
      { key: "responsibleUser", label: "Responsible User" },
    ];

    if (format === "EXCEL") {
      exportUtils.toExcel(exportRows, fileName, {
        sheetName: "WBS",
        columns,
      });
      return;
    }

    exportUtils.toCsv(exportRows, fileName, { columns });
  };

  const toggleExpand = (id: number) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedIds(newSet);
  };

  const handleAdd = (parent: WbsNode | null) => {
    setSelectedNode(null);
    setParentNode(parent);
    setIsModalOpen(true);
  };

  const handleEdit = (node: WbsNode) => {
    setSelectedNode(node);
    setParentNode(null); // Parent doesn't change on edit usually
    setIsModalOpen(true);
  };

  const handleRecursiveDelete = async (id: number) => {
    // Step 1: Check for children (or just warn generically about cascade)
    // Since we enabled cascade on backend, ANY node deletion is recursive if it has children.
    // We can check local state `wbsData` to see if `id` has children to tailor the message?
    // Let's just do the requested 3-step strict confirmation.

    // WARNING 1
    if (
      !confirm(
        "WARNING 1/3: Are you sure you want to delete this WBS Node?\n\nIf this node has children, THEY WILL ALSO BE DELETED automatically.",
      )
    )
      return;

    // WARNING 2
    if (
      !confirm(
        "WARNING 2/3: This action is IRREVERSIBLE.\n\nAll associated data (Activities, Child Nodes, Assignments) under this hierarchy will be permanently lost.\n\nAre you absolutely sure?",
      )
    )
      return;

    // WARNING 3 (Verification)
    const input = prompt(
      'WARNING 3/3: Final Confirmation.\n\nPlease type "DELETE" (all caps) to confirm this destructive action.',
    );
    if (input !== "DELETE") {
      alert('Deletion Cancelled. Input did not match "DELETE".');
      return;
    }

    try {
      await api.delete(`/projects/${projectId}/wbs/${id}`);
      fetchWbs();
    } catch (err) {
      console.error(err);
      alert("Failed to delete.");
    }
  };

  // Recursive Tree Renderer
  const renderTree = (nodes: WbsNode[], level: number = 0) => {
    return nodes.map((node) => {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedIds.has(node.id);

      return (
        <div key={node.id} className="select-none">
          <div
            className={clsx(
              "flex items-center py-2 px-2 border-b border-border-subtle hover:bg-surface-base transition-colors",
              node.isControlAccount && "bg-primary-muted/50",
            )}
            style={{ paddingLeft: `${level * 24 + 12}px` }}
          >
            {/* Expand/Collapse */}
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

            {/* WBS Code */}
            <span className="font-mono text-xs font-semibold text-text-muted w-24 mr-4 bg-surface-raised px-1 py-0.5 rounded">
              {node.wbsCode}
            </span>

            {/* Icon & Name */}
            <Layers
              className={clsx(
                "w-4 h-4 mr-2",
                node.isControlAccount ? "text-primary" : "text-text-disabled",
              )}
            />
            <span
              className={clsx(
                "font-medium text-sm flex-1",
                node.isControlAccount
                  ? "text-text-primary"
                  : "text-text-secondary",
              )}
            >
              {node.wbsName}
              {node.isControlAccount && (
                <span className="ml-2 text-[10px] bg-info-muted text-blue-700 px-1.5 py-0.5 rounded-full track-wide font-bold">
                  CA
                </span>
              )}
            </span>

            {/* Responsibility Info */}
            <div className="text-xs text-text-disabled mr-8 flex gap-4">
              {node.responsibleRole && (
                <span>Role: {node.responsibleRole.name}</span>
              )}
              {node.responsibleUser && (
                <span>User: {node.responsibleUser.username}</span>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-1">
              <button
                onClick={() => handleAdd(node)}
                className="p-1 text-success hover:bg-green-100 rounded"
                title="Add Child"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleEdit(node)}
                className="p-1 text-primary hover:bg-info-muted rounded"
                title="Edit"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleRecursiveDelete(node.id)}
                className="p-1 text-error hover:bg-red-100 rounded"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Children */}
          {isExpanded && hasChildren && (
            <div>{renderTree(node.children!, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  const [activeTab, setActiveTab] = useState<"structure" | "templates">(
    "structure",
  );

  return (
    <div className="h-full flex flex-col bg-surface-base">
      {/* Project Header (Small minimized version) */}
      <div className="px-6 py-2 bg-surface-card border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-bold text-text-disabled uppercase tracking-widest">
            Project WBS
          </h2>
          <div className="h-4 w-px bg-gray-200"></div>
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("structure")}
              className={clsx(
                "text-sm font-bold transition-all border-b-2 py-2",
                activeTab === "structure"
                  ? "text-primary border-primary"
                  : "text-text-disabled border-transparent hover:text-text-secondary",
              )}
            >
              WBS Structure
            </button>
            <button
              onClick={() => setActiveTab("templates")}
              className={clsx(
                "text-sm font-bold transition-all border-b-2 py-2",
                activeTab === "templates"
                  ? "text-primary border-primary"
                  : "text-text-disabled border-transparent hover:text-text-secondary",
              )}
            >
              Standard Templates
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === "structure" ? (
          <div className="h-full flex flex-col">
            <div className="px-6 py-4 border-b border-border-default bg-surface-card flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold text-gray-800">
                  Work Breakdown Structure
                </h1>
                <p className="text-sm text-text-muted">
                  Defining execution structure for Project ID: {projectId}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsTemplateModalOpen(true)}
                  className="flex items-center px-3 py-2 bg-surface-card border border-border-strong text-text-secondary rounded-md hover:bg-surface-base text-sm font-medium shadow-sm"
                >
                  <LayoutTemplate className="w-4 h-4 mr-2" />
                  Import Template
                </button>
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="flex items-center px-3 py-2 bg-surface-card border border-border-strong text-text-secondary rounded-md hover:bg-surface-base text-sm font-medium shadow-sm"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Import Data
                </button>
                <button
                  onClick={() => handleExport("CSV")}
                  className="flex items-center px-3 py-2 bg-surface-card border border-border-strong text-text-secondary rounded-md hover:bg-surface-base text-sm font-medium shadow-sm"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export CSV
                </button>
                <button
                  onClick={() => handleExport("EXCEL")}
                  className="flex items-center px-3 py-2 bg-surface-card border border-border-strong text-text-secondary rounded-md hover:bg-surface-base text-sm font-medium shadow-sm"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export Excel
                </button>
                <button
                  onClick={() => setIsSaveTemplateModalOpen(true)}
                  className="flex items-center px-3 py-2 bg-surface-card border border-border-strong text-text-secondary rounded-md hover:bg-surface-base text-sm font-medium shadow-sm"
                  title="Save current structure as a reusable template"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save as Template
                </button>
                <button
                  onClick={() => handleAdd(null)} // Add Root
                  className="flex items-center px-3 py-2 bg-primary text-white rounded-md hover:bg-primary-dark text-sm font-medium shadow-sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Root WBS
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-surface-card p-6">
              {loading ? (
                <div className="text-center text-text-muted mt-10">
                  Loading WBS...
                </div>
              ) : wbsData.length === 0 ? (
                <div className="text-center text-text-disabled mt-20">
                  <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No WBS nodes defined. Click "Add Root WBS" to start.</p>
                </div>
              ) : (
                <div className="border border-border-default rounded-lg shadow-sm">
                  <div className="bg-surface-base px-4 py-2 text-xs font-semibold text-text-muted uppercase flex border-b border-border-default">
                    <span className="w-8"></span>
                    <span className="w-24 mr-4">WBS Code</span>
                    <span className="flex-1">Task Name</span>
                    <span className="w-40">Responsibility</span>
                    <span className="w-20">Actions</span>
                  </div>
                  {renderTree(wbsData)}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full p-6">
            <WbsTemplatesTab />
          </div>
        )}
      </div>

      {isModalOpen && (
        <WbsModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            fetchWbs();
            // If we added a child, make sure parent is expanded
            if (parentNode) {
              setExpandedIds((prev) => {
                const next = new Set(prev);
                next.add(parentNode.id);
                return next;
              });
            }
          }}
          projectId={Number(projectId)}
          parent={parentNode}
          editingNode={selectedNode}
        />
      )}

      {isTemplateModalOpen && (
        <TemplateImportModal
          isOpen={isTemplateModalOpen}
          onClose={() => setIsTemplateModalOpen(false)}
          projectId={Number(projectId)}
          onSuccess={() => {
            setIsTemplateModalOpen(false);
            fetchWbs();
          }}
        />
      )}
      {isImportModalOpen && (
        <WbsImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          projectId={Number(projectId)}
          onSuccess={() => {
            setIsImportModalOpen(false);
            fetchWbs();
          }}
        />
      )}
      {isSaveTemplateModalOpen && (
        <SaveTemplateModal
          isOpen={isSaveTemplateModalOpen}
          onClose={() => setIsSaveTemplateModalOpen(false)}
          projectId={Number(projectId)}
          onSuccess={() => {
            alert("Template Saved Successfully!");
            setIsSaveTemplateModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default WbsPage;
