import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  MapPin,
  Building2,
  Layers,
} from "lucide-react";
import api from "../../api/axios";

interface EpsNode {
  id: number;
  name: string;
  label?: string;
  type: string;
  children?: EpsNode[];
}

interface EpsLocationPickerProps {
  projectId: number;
  value: number | null;
  onChange: (nodeId: number, nodeLabel: string) => void;
  placeholder?: string;
}

const EpsLocationPicker: React.FC<EpsLocationPickerProps> = ({
  projectId,
  value,
  onChange,
  placeholder = "Select Location...",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [treeData, setTreeData] = useState<EpsNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const [selectedLabel, setSelectedLabel] = useState<string>("");

  const searchTerm = searchQuery.trim().toLowerCase();

  useEffect(() => {
    if (isOpen && treeData.length === 0) {
      fetchTree();
    }
  }, [isOpen, projectId]);

  const fetchTree = async () => {
    setLoading(true);
    try {
      const resp = await api.get(`/eps/${projectId}/tree`);
      if (resp.data && resp.data.length > 0) {
        const projectRoot = resp.data[0];
        if (projectRoot.children) {
          setTreeData(projectRoot.children);
          const newExpanded = new Set<number>();
          projectRoot.children.forEach((n: EpsNode) => newExpanded.add(n.id));
          setExpandedNodes(newExpanded);
        }
      }
    } catch (error) {
      console.error("Failed to fetch EPS tree:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (value && treeData.length > 0 && !selectedLabel) {
      const path = findPath(treeData, value);
      if (path.length > 0) {
        setSelectedLabel(path.map((n) => n.name).join(" > "));
      }
    }
  }, [value, treeData, selectedLabel]);

  const findPath = (
    nodes: EpsNode[],
    targetId: number,
    currentPath: EpsNode[] = [],
  ): EpsNode[] => {
    for (const node of nodes) {
      const newPath = [...currentPath, node];
      if (node.id === targetId) return newPath;
      if (node.children) {
        const found = findPath(node.children, targetId, newPath);
        if (found.length > 0) return found;
      }
    }
    return [];
  };

  const matchingPathIds = useMemo(() => {
    if (!searchTerm) return new Set<number>();
    const ids = new Set<number>();

    const walk = (nodes: EpsNode[], parents: number[] = []) => {
      nodes.forEach((node) => {
        const nodeName = (node.label || node.name || "").toLowerCase();
        const nextParents = [...parents, node.id];

        if (nodeName.includes(searchTerm)) {
          nextParents.forEach((id) => ids.add(id));
        }

        if (node.children?.length) {
          walk(node.children, nextParents);
        }
      });
    };

    walk(treeData);
    return ids;
  }, [searchTerm, treeData]);

  const toggleNode = (e: React.MouseEvent, nodeId: number) => {
    e.stopPropagation();
    const next = new Set(expandedNodes);
    if (next.has(nodeId)) next.delete(nodeId);
    else next.add(nodeId);
    setExpandedNodes(next);
  };

  const handleSelect = (node: EpsNode, parents: EpsNode[]) => {
    const fullPath = [...parents, node].map((n) => n.name).join(" > ");
    setSelectedLabel(fullPath);
    onChange(node.id, fullPath);
    setIsOpen(false);
  };

  const renderNode = (node: EpsNode, parents: EpsNode[] = []) => {
    const isLeaf = !node.children || node.children.length === 0;
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = value === node.id;

    if (searchTerm && !matchingPathIds.has(node.id)) {
      return null;
    }

    return (
      <div key={node.id} className="ml-4">
        <div
          className={`flex items-center gap-2 py-2 px-2.5 rounded-xl cursor-pointer border transition-colors ${
            isSelected
              ? "bg-primary-muted text-primary font-semibold border-primary/30 shadow-sm"
              : "border-transparent hover:bg-surface-raised hover:border-border-default"
          }`}
          onClick={() => handleSelect(node, parents)}
        >
          {!isLeaf ? (
            <button
              type="button"
              className="p-0.5 hover:bg-surface-raised rounded text-text-muted"
              onClick={(e) => toggleNode(e, node.id)}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          ) : (
            <div className="w-5" />
          )}

          {node.type === "TOWER" || node.type === "BLOCK" ? (
            <Building2 className="w-4 h-4 text-primary" />
          ) : node.type === "FLOOR" ? (
            <Layers className="w-4 h-4 text-info" />
          ) : (
            <MapPin className="w-4 h-4 text-text-disabled" />
          )}

          <span className="text-sm">{node.label || node.name}</span>
        </div>

        {isExpanded && !isLeaf && node.children && (
          <div className="border-l ml-2 pl-2 border-border-subtle">
            {node.children.map((child) =>
              renderNode(child, [...parents, node]),
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative">
      <div
        className={`w-full bg-surface-card border ${
          isOpen
            ? "border-primary shadow-[var(--focus-ring)]"
            : "border-border-default hover:border-border-strong"
        } rounded-xl px-4 py-3 text-sm font-medium cursor-pointer flex justify-between items-center transition-all`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 truncate">
          <MapPin className="w-4 h-4 text-text-disabled shrink-0" />
          <span
            className={`truncate ${
              selectedLabel ? "text-text-primary" : "text-text-disabled"
            }`}
          >
            {selectedLabel || placeholder}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-text-disabled transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-2 bg-surface-card rounded-xl shadow-xl border border-border-subtle z-50 max-h-96 overflow-hidden flex flex-col">
            <div className="p-3 border-b border-border-subtle">
              <input
                type="text"
                placeholder="Search locations..."
                className="w-full bg-surface-base border border-border-default rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="p-2 overflow-y-auto flex-1">
              {loading ? (
                <div className="p-4 text-center text-sm text-text-muted animate-pulse">
                  Loading structure...
                </div>
              ) : treeData.length > 0 ? (
                <div className="-ml-4">{treeData.map((node) => renderNode(node, []))}</div>
              ) : (
                <div className="p-4 text-center text-sm text-text-muted">
                  No structure defined.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default EpsLocationPicker;
