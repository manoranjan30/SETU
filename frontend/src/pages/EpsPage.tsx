import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import {
  Plus,
  ChevronRight,
  ChevronDown,
  Edit2,
  Trash2,
  Folder,
  Building,
  Layers,
  Component,
  Grid,
  Box,
  Layout,
  Upload,
  Download,
  Settings,
  Users,
  ShieldAlert,
  CheckCircle,
  FileText,
} from "lucide-react";
import EpsModal from "../components/eps/EpsModal";
import ProjectPropertiesModal from "../components/eps/ProjectPropertiesModal";
import ProjectTeamModal from "../components/eps/ProjectTeamModal";
import clsx from "clsx"; // Make sure to install clsx if not present, or use template literals
import { useAuth } from "../context/AuthContext";
import { exportUtils } from "../utils/export.utils";
import { resolveRegisteredExportFileName } from "../utils/export.registry";
import { downloadBlob, withFileExtension } from "../utils/file-download.utils";

// Types
interface EpsNode {
  id: number;
  name: string;
  type: "COMPANY" | "PROJECT" | "BLOCK" | "TOWER" | "FLOOR" | "UNIT" | "ROOM";
  parentId: number | null;
  children?: EpsNode[];
}

interface EpsImportResponse {
  message: string;
  rowCount: number;
  processedRows: number;
  skippedRows: number;
  createdCount: number;
  existingCount: number;
  recognizedHeaders: string[];
}

const EpsPage = () => {
  const { user } = useAuth();
  const [nodes, setNodes] = useState<EpsNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedParent, setSelectedParent] = useState<EpsNode | null>(null);
  const [nodeToEdit, setNodeToEdit] = useState<EpsNode | null>(null);
  const [isPropsModalOpen, setIsPropsModalOpen] = useState(false);
  const [selectedProjectForProps, setSelectedProjectForProps] =
    useState<EpsNode | null>(null);
  const [selectedNodeForTeam, setSelectedNodeForTeam] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const navigate = useNavigate();
  const isAdmin = user?.roles?.includes("Admin") ?? false;
  const moduleChipBase =
    "px-2.5 py-1 text-[11px] font-semibold rounded-lg border flex items-center gap-1.5 transition-colors";
  const moduleChipClass = {
    team: `${moduleChipBase} bg-secondary-muted text-secondary border-secondary/25 hover:bg-secondary-muted/80`,
    wbs: `${moduleChipBase} bg-info-muted text-info border-info/25 hover:bg-info-muted/80`,
    boq: `${moduleChipBase} bg-warning-muted text-warning border-warning/25 hover:bg-warning-muted/80`,
    plan: `${moduleChipBase} bg-primary-muted text-primary border-primary/25 hover:bg-primary-muted/80`,
    progress: `${moduleChipBase} bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100`,
    ehs: `${moduleChipBase} bg-error-muted text-error border-error/25 hover:bg-error-muted/80`,
    quality: `${moduleChipBase} bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100`,
    design: `${moduleChipBase} bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100`,
  };

  // Tree State
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetchNodes();
  }, []);

  const fetchNodes = async () => {
    setLoading(true);
    setError("");

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        const res = await api.get("/eps");
        const tree = buildTree(res.data);
        setNodes(tree);
        if (tree.length > 0) {
          const companyIds = tree.map((node) => node.id);
          const initialExpanded = companyIds.reduce(
            (acc, id) => ({ ...acc, [id]: true }),
            {},
          );
          setExpanded((prev) => ({ ...prev, ...initialExpanded }));
        }
        setLoading(false);
        return; // Success
      } catch (err) {
        attempts++;
        console.warn(`EPS Fetch Attempt ${attempts} failed`);
        if (attempts === maxAttempts) {
          setError("Failed to load EPS structure. Please reload.");
          setLoading(false);
        } else {
          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempts));
        }
      }
    }
  };

  const buildTree = (flatList: EpsNode[]): EpsNode[] => {
    const map = new Map<number, EpsNode>();
    const roots: EpsNode[] = [];

    // Initialize map
    flatList.forEach((node) => {
      map.set(node.id, { ...node, children: [] });
    });

    // Build hierarchy
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
    // Natural Sort Helper
    const naturalSort = (nodes: EpsNode[]) => {
      nodes.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
      nodes.forEach((n) => {
        if (n.children && n.children.length > 0) {
          naturalSort(n.children);
        }
      });
    };

    naturalSort(roots);
    return roots;
  };

  const toggleExpand = (id: number) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDelete = async (node: EpsNode) => {
    if (
      !confirm(
        `Are you sure you want to delete ${node.name}? This cannot be undone.`,
      )
    )
      return;
    try {
      await api.delete(`/eps/${node.id}`);
      fetchNodes();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to delete");
    }
  };

  const openCreate = (parent: EpsNode | null) => {
    setModalMode("create");
    setSelectedParent(parent);
    setNodeToEdit(null);
    setIsModalOpen(true);
  };

  const openEdit = (node: EpsNode) => {
    setModalMode("edit");
    setNodeToEdit(node);
    setSelectedParent(null); // Not used in edit
    setIsModalOpen(true);
  };

  const openProperties = (node: EpsNode) => {
    setSelectedProjectForProps(node);
    setIsPropsModalOpen(true);
  };

  const openTeam = (node: EpsNode) => {
    setSelectedNodeForTeam({ id: node.id, name: node.name });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    try {
      const response = await api.post<EpsImportResponse>("/eps/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const summary = response.data;
      await fetchNodes();
      alert(
        [
          summary.message,
          `Rows: ${summary.rowCount}`,
          `Processed: ${summary.processedRows}`,
          `Created: ${summary.createdCount}`,
          `Already existed: ${summary.existingCount}`,
          summary.skippedRows > 0 ? `Skipped: ${summary.skippedRows}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    } catch (err: any) {
      alert(err.response?.data?.message || "Import failed");
    } finally {
      setLoading(false);
      e.target.value = ""; // Reset input
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent =
      "Company,Project,Block,Tower,Floor,Unit,Room\nMyCompany,Project A,Block 1,Tower A,Level 1,Unit 101,Kitchen";
    const blob = new Blob([csvContent], { type: "text/csv" });
    downloadBlob(blob, withFileExtension("eps_template", ".csv"));
  };

  const flattenNodes = (
    treeNodes: EpsNode[],
    parentName = "",
    level = 1,
  ): Array<Record<string, unknown>> =>
    treeNodes.flatMap((node) => {
      const current = {
        name: node.name,
        type: node.type,
        parentName,
        level,
      };
      return [
        current,
        ...flattenNodes(node.children || [], node.name, level + 1),
      ];
    });

  const handleExport = (format: "EXCEL" | "CSV") => {
    const exportRows = flattenNodes(nodes);
    const fileName = resolveRegisteredExportFileName("eps.structure", {
      scope: "Tree",
    });
    const columns = [
      { key: "name", label: "Name" },
      { key: "type", label: "Type" },
      { key: "parentName", label: "Parent" },
      { key: "level", label: "Level" },
    ];

    if (format === "EXCEL") {
      exportUtils.toExcel(exportRows, fileName, {
        sheetName: "EPS",
        columns,
      });
      return;
    }

    exportUtils.toCsv(exportRows, fileName, { columns });
  };

  // Recursive Tree Renderer
  const renderTree = (nodes: EpsNode[]) => {
    return nodes.map((node) => (
      <div
        key={node.id}
        className="ml-4 border-l border-border-default/60 pl-2 py-1"
      >
        <div className="flex items-center gap-1 group rounded-xl border border-transparent hover:border-border-default hover:bg-surface-card px-1.5 py-1 transition-colors">
          {/* Expand/Collapse */}
          <button
            onClick={() => toggleExpand(node.id)}
            className="mr-1 p-0.5 hover:bg-surface-raised rounded text-text-muted"
            style={{
              visibility:
                node.children && node.children.length > 0
                  ? "visible"
                  : "hidden",
            }}
          >
            {expanded[node.id] ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>

          {/* Icon based on Type */}
          <span
            className={clsx("mr-2", {
              "text-blue-800": node.type === "COMPANY",
              "text-primary": node.type === "PROJECT",
              "text-purple-600": node.type === "BLOCK",
              "text-orange-600": node.type === "TOWER",
              "text-success": node.type === "FLOOR",
              "text-secondary": node.type === "UNIT",
              "text-pink-600": node.type === "ROOM",
            })}
          >
            {node.type === "COMPANY" && <Building className="w-4 h-4" />}
            {node.type === "PROJECT" && <Folder className="w-4 h-4" />}
            {node.type === "BLOCK" && <Grid className="w-4 h-4" />}
            {node.type === "TOWER" && <Component className="w-4 h-4" />}
            {node.type === "FLOOR" && <Layers className="w-4 h-4" />}
            {node.type === "UNIT" && <Box className="w-4 h-4" />}
            {node.type === "ROOM" && <Layout className="w-4 h-4" />}
          </span>

          {/* Node Name */}
          <span className="font-semibold text-text-secondary text-sm">
            {node.name}
          </span>
          <span className="ml-2 text-xs text-text-disabled uppercase tracking-wider">
            [{node.type}]
          </span>

          {/* Actions */}
          <div className="ml-auto flex gap-2 opacity-100">
            {node.type === "PROJECT" && (
              <>
                {isAdmin && (
                  <button
                    onClick={() => openTeam(node)}
                    className={moduleChipClass.team}
                    title="Manage Team"
                  >
                    <Users className="w-3 h-3" />
                    Team
                  </button>
                )}
                <button
                  onClick={() => navigate(`/dashboard/projects/${node.id}/wbs`)}
                  className={moduleChipClass.wbs}
                  title="Open Work Breakdown Structure"
                >
                  WBS
                </button>

                <button
                  onClick={() => navigate(`/dashboard/projects/${node.id}/boq`)}
                  className={moduleChipClass.boq}
                  title="Bill of Quantities"
                >
                  <Layers className="w-3 h-3" />
                  BOQ
                </button>
                <button
                  onClick={() =>
                    navigate(`/dashboard/projects/${node.id}/planning`)
                  }
                  className={moduleChipClass.plan}
                  title="Planning & Lookahead"
                >
                  <Grid className="w-3 h-3" />
                  Plan
                </button>

                <button
                  onClick={() =>
                    navigate(`/dashboard/projects/${node.id}/progress`)
                  }
                  className={moduleChipClass.progress}
                  title="Daily Site Progress"
                >
                  <Box className="w-3 h-3" />
                  Progress
                </button>
                <button
                  onClick={() => navigate(`/dashboard/projects/${node.id}/ehs`)}
                  className={moduleChipClass.ehs}
                  title="Environment, Health & Safety"
                >
                  <ShieldAlert className="w-3 h-3" />
                  EHS
                </button>
                <button
                  onClick={() =>
                    navigate(`/dashboard/projects/${node.id}/quality`)
                  }
                  className={moduleChipClass.quality}
                  title="Quality Control & QA"
                >
                  <CheckCircle className="w-3 h-3" />
                  Quality
                </button>
                <button
                  onClick={() =>
                    navigate(`/dashboard/projects/${node.id}/design`)
                  }
                  className={moduleChipClass.design}
                  title="Design & Drawings"
                >
                  <FileText className="w-3 h-3" />
                  Design
                </button>
              </>
            )}

            {isAdmin && (
              <div className="flex gap-1 opacity-50 hover:opacity-100 transition-opacity">
                {node.type === "PROJECT" && (
                  <button
                    onClick={() => openProperties(node)}
                    className="p-1 text-warning hover:bg-warning-muted rounded"
                    title="Project Properties"
                  >
                    <Settings className="w-3 h-3" />
                  </button>
                )}
                {node.type !== "ROOM" && (
                  <button
                    onClick={() => openCreate(node)}
                    className="p-1 text-success hover:bg-success-muted rounded"
                    title="Add Child"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => openEdit(node)}
                  className="p-1 text-primary hover:bg-info-muted rounded"
                  title="Edit"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDelete(node)}
                  className="p-1 text-error hover:bg-error-muted rounded"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Children */}
        {expanded[node.id] && node.children && node.children.length > 0 && (
          <div className="ml-2">{renderTree(node.children)}</div>
        )}
      </div>
    ));
  };

  return (
    <div className="ui-shell p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="ui-title text-4xl">
          Enterprise Project Structure (EPS)
        </h1>
        <div className="flex gap-2">
          {isAdmin && (
            <>
              <button
                onClick={handleDownloadTemplate}
                className="ui-btn-secondary px-4 py-2.5 text-sm shadow-sm flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Template
              </button>
              <button
                onClick={() => handleExport("CSV")}
                className="ui-btn-secondary px-4 py-2.5 text-sm shadow-sm flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </button>
              <button
                onClick={() => handleExport("EXCEL")}
                className="ui-btn-secondary px-4 py-2.5 text-sm shadow-sm flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Excel
              </button>
              <label className="bg-success text-white px-4 py-2.5 rounded-xl shadow-md hover:brightness-95 flex items-center cursor-pointer text-sm font-semibold">
                <Upload className="w-4 h-4 mr-2" />
                Import CSV
                <input
                  type="file"
                  className="hidden"
                  accept=".csv"
                  onChange={handleImport}
                />
              </label>
              {nodes.length === 0 && !loading && (
                <button
                  onClick={() => openCreate(null)}
                  className="bg-primary text-white px-4 py-2.5 rounded-xl shadow-md hover:brightness-95 flex items-center text-sm font-semibold"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Initialize
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="ui-card p-6 min-h-[500px]">
        {loading ? (
          <div className="text-center text-text-muted py-10">
            Loading EPS...
          </div>
        ) : error ? (
          <div className="text-center text-error py-10">{error}</div>
        ) : nodes.length === 0 ? (
          <div className="text-center text-text-disabled py-10">
            {isAdmin ? (
              <>No EPS Defined. Click 'Initialize EPS' to start.</>
            ) : (
              <>
                <p className="text-lg text-text-secondary font-semibold">
                  No Projects Assigned
                </p>
                <p className="text-sm">
                  You have not been assigned to any projects yet.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">{renderTree(nodes)}</div>
        )}
      </div>

      <EpsModal
        isOpen={isModalOpen}
        mode={modalMode}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchNodes}
        parentNode={selectedParent}
        nodeToEdit={nodeToEdit}
      />
      {selectedProjectForProps && (
        <ProjectPropertiesModal
          isOpen={isPropsModalOpen}
          onClose={() => setIsPropsModalOpen(false)}
          nodeId={selectedProjectForProps.id}
          nodeName={selectedProjectForProps.name}
        />
      )}
      {selectedNodeForTeam && (
        <ProjectTeamModal
          isOpen={!!selectedNodeForTeam}
          onClose={() => setSelectedNodeForTeam(null)}
          projectId={selectedNodeForTeam.id}
          projectName={selectedNodeForTeam.name}
        />
      )}
    </div>
  );
};

export default EpsPage;
