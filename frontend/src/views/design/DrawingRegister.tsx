import { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import {
  type ColDef,
  ModuleRegistry,
  ClientSideRowModelModule,
  ValidationModule,
} from "ag-grid-community";
import { Upload, Download, FileText, Plus, History, Eye } from "lucide-react";
import api from "../../api/axios";
import UploadModal from "./components/UploadModal";
import CreateDrawingModal from "./components/CreateDrawingModal";
import RevisionHistoryModal from "./components/RevisionHistoryModal";
import PreviewModal from "./components/PreviewModal";
import { downloadBlob, withFileExtension } from "../../utils/file-download.utils";
import { resolveRegisteredExportFileName } from "../../utils/export.registry";
import { exportUtils } from "../../utils/export.utils";

// Register modules
ModuleRegistry.registerModules([ClientSideRowModelModule, ValidationModule]);

interface RegisterItem {
  id: number;
  drawingNumber: string;
  title: string;
  category: {
    id: number;
    name: string;
    code: string;
  };
  status: string;
  statusUpdatedAt?: string | null;
  latestRevisionDate?: string | null;
  latestRevisionUploadedAt?: string | null;
  currentRevisionUnread?: boolean;
  currentRevision?: {
    id: number;
    revisionNumber: string;
    uploadedAt: string;
    uploadedBy: {
      id: number;
      username: string;
    };
    fileSize: number;
    originalFileName?: string;
    fileType?: string;
  };
  revisions: any[];
}

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "-";

const formatDateOnly = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString() : "-";

const STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planned",
  ON_HOLD: "On Hold",
  SUPERSEDED: "Superseded",
  ACTIVE_GFC: "Active GFC",
  ADVANCE_COPY: "Advance Copy",
  REFERENCE_ONLY: "Reference Only",
  HOLD: "On Hold",
  OBSOLETE: "Superseded",
  GFC: "Active GFC",
  IN_PROGRESS: "Advance Copy",
};

const DrawingRegister = () => {
  const { projectId } = useParams();
  const [rowData, setRowData] = useState<RegisterItem[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{
    name: string;
    type: string;
  } | null>(null);
  const [previewCanDownload, setPreviewCanDownload] = useState(false);
  const [previewRevisionId, setPreviewRevisionId] = useState<number | undefined>(undefined);

  const fetchData = async () => {
    if (!projectId) return;
    try {
      const response = await api.get(`/design/${projectId}/register`);
      setRowData(response.data);
    } catch (error) {
      console.error("Failed to fetch register:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const handleUploadClick = (item: any) => {
    let nextRevision = "0";
    if (item.currentRevision) {
      const current = item.currentRevision.revisionNumber;
      if (current === "0") nextRevision = "A";
      else if (current.match(/^[A-Z]$/))
        nextRevision = String.fromCharCode(current.charCodeAt(0) + 1);
      else if (!isNaN(Number(current)))
        nextRevision = String(Number(current) + 1);
    }

    setSelectedItem({ ...item, nextRevision });
    setIsUploadModalOpen(true);
  };

  const handleUpload = async (
    file: File,
    registerId: number,
    revisionNumber: string,
    revisionDate: string,
  ) => {
    if (!projectId) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("registerId", String(registerId));
    formData.append("revisionNumber", revisionNumber);
    formData.append("revisionDate", revisionDate);

    await api.post(`/design/${projectId}/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    // Refresh data
    await fetchData();
  };

  const handleDownload = async (revisionId: number, filename: string) => {
    if (!projectId) return;
    try {
      const response = await api.get(
        `/design/${projectId}/download/${revisionId}`,
        {
          responseType: "blob",
        },
      );
      downloadBlob(
        new Blob([response.data]),
        withFileExtension(filename || "drawing", ".pdf"),
      );
    } catch (e) {
      console.error("Download failed", e);
      alert("Failed to download file");
    }
  };

  const exportRows = useMemo(
    () =>
      rowData.map((item) => ({
        drawingNumber: item.drawingNumber,
        title: item.title,
        categoryName: item.category?.name || "-",
        status: STATUS_LABELS[item.status] || item.status,
        statusUpdatedAt: item.statusUpdatedAt,
        latestRevisionNumber: item.currentRevision?.revisionNumber || "-",
        latestRevisionDate: item.latestRevisionDate,
        latestRevisionUploadedAt: item.latestRevisionUploadedAt,
        latestRevisionUploadedBy: item.currentRevision?.uploadedBy?.username || "-",
        latestFileName: item.currentRevision?.originalFileName || "-",
      })),
    [rowData],
  );

  const exportColumns = [
    { key: "drawingNumber", label: "Drawing No" },
    { key: "title", label: "Title" },
    { key: "categoryName", label: "Category" },
    { key: "status", label: "Status" },
    {
      key: "statusUpdatedAt",
      label: "Status Updated",
      formatter: (value: unknown) =>
        typeof value === "string" ? formatDateTime(value) : "-",
    },
    { key: "latestRevisionNumber", label: "Latest Revision" },
    {
      key: "latestRevisionDate",
      label: "Revision Date",
      formatter: (value: unknown) =>
        typeof value === "string" ? formatDateOnly(value) : "-",
    },
    {
      key: "latestRevisionUploadedAt",
      label: "Latest Revision Uploaded",
      formatter: (value: unknown) =>
        typeof value === "string" ? formatDateTime(value) : "-",
    },
    { key: "latestRevisionUploadedBy", label: "Uploaded By" },
    { key: "latestFileName", label: "Latest File" },
  ] as const;

  const handleExport = (format: "EXCEL" | "CSV") => {
    const fileName = resolveRegisteredExportFileName("design.drawing-register", {
      projectId,
    });

    if (format === "EXCEL") {
      exportUtils.toExcel(exportRows, fileName, {
        sheetName: "Drawing Register",
        columns: [...exportColumns],
      });
      return;
    }

    exportUtils.toCsv(exportRows, fileName, {
      columns: [...exportColumns],
    });
  };

  const canDownload = (item: RegisterItem) =>
    item.status === "ACTIVE_GFC" || item.status === "GFC";

  const markOpened = async (registerId: number) => {
    if (!projectId) return;
    try {
      await api.post(`/design/${projectId}/register/${registerId}/open`);
      await fetchData();
    } catch (e) {
      console.error("Failed to mark drawing as opened", e);
    }
  };

  const handlePreview = async (
    registerId: number,
    revisionId: number,
    filename: string,
    fileType: string,
    allowDownload: boolean,
  ) => {
    if (!projectId) return;
    try {
      const response = await api.get(
        `/design/${projectId}/preview/${revisionId}`,
        {
          responseType: "blob",
        },
      );
      const blob = new Blob([response.data], {
        type: fileType || "application/pdf",
      }); // Fallback to PDF if unknown, though risky
      const url = window.URL.createObjectURL(blob);

      setPreviewUrl(url);
      setPreviewFile({ name: filename, type: fileType });
      setPreviewCanDownload(allowDownload);
      setPreviewRevisionId(revisionId);
      setIsPreviewModalOpen(true);
      await markOpened(registerId);
    } catch (e) {
      console.error("Preview failed", e);
      alert("Failed to load preview");
    }
  };

  const handleDelete = async (item: any) => {
    if (!projectId) return;
    if (
      !confirm(
        `Are you sure you want to delete ${item.drawingNumber}? This will strictly delete the file also from the system.`,
      )
    )
      return;

    try {
      await api.delete(`/design/${projectId}/register/${item.id}`);
      await fetchData();
    } catch (e) {
      console.error("Delete failed", e);
      alert("Failed to delete record");
    }
  };

  const colDefs: ColDef<RegisterItem>[] = useMemo(
    () => [
      {
        field: "category.name",
        headerName: "Category",
        width: 150,
        rowGroup: false,
        enableRowGroup: false,
      },
      {
        field: "drawingNumber",
        headerName: "Drawing No",
        width: 140,
        sortable: true,
        filter: true,
        pinned: "left",
        cellRenderer: (params: any) => {
          if (!params.value) return "-";
          return (
            <div className="flex items-center gap-2">
              <span className={params.data?.currentRevisionUnread ? "font-bold" : ""}>
                {params.value}
              </span>
              {params.data?.currentRevisionUnread && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Updated
                </span>
              )}
            </div>
          );
        },
      },
      {
        field: "title",
        headerName: "Title",
        flex: 1,
        minWidth: 220,
        cellRenderer: (params: any) => (
          <div className="flex flex-col py-1">
            <span className={params.data?.currentRevisionUnread ? "font-bold" : ""}>
              {params.value || "-"}
            </span>
            <span className="text-xs text-text-muted">
              Latest revision: {formatDateOnly(params.data?.latestRevisionDate)}
            </span>
          </div>
        ),
      },
      {
        field: "currentRevision.revisionNumber",
        headerName: "Rev",
        width: 140,
        cellRenderer: (params: any) => {
          if (!params.value)
            return <span className="text-text-disabled">-</span>;
          return (
            <div className="flex flex-col gap-1 py-1">
              <span className="inline-flex w-fit items-center rounded bg-primary-muted px-2 py-1 font-bold text-primary">
                {params.value}
              </span>
              {params.data?.currentRevisionUnread && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Latest unread
                </span>
              )}
            </div>
          );
        },
      },
      {
        field: "status",
        headerName: "Status",
        width: 120,
        cellRenderer: (params: any) => {
          const status = params.value;
          let color = "text-text-muted bg-surface-raised";
          if (status === "ACTIVE_GFC" || status === "GFC") color = "text-success bg-green-100";
          if (status === "ADVANCE_COPY" || status === "IN_PROGRESS") color = "text-primary bg-info-muted";
          if (status === "ON_HOLD" || status === "HOLD") color = "text-amber-700 bg-amber-100";
          if (status === "SUPERSEDED" || status === "OBSOLETE") color = "text-rose-700 bg-rose-100";
          if (status === "REFERENCE_ONLY") color = "text-violet-700 bg-violet-100";
          if (status === "PLANNED") color = "text-slate-700 bg-slate-100";
          return (
            <div className="flex flex-col gap-1 py-1">
              <span
                className={`w-fit px-2 py-1 rounded-full text-xs font-medium ${color}`}
              >
                {STATUS_LABELS[status] || status}
              </span>
              <span className="text-[10px] text-text-muted">
                {formatDateTime(params.data?.statusUpdatedAt)}
              </span>
            </div>
          );
        },
      },
      {
        field: "statusUpdatedAt",
        headerName: "Status Updated",
        width: 180,
        valueFormatter: (params: any) => formatDateTime(params.value),
      },
      {
        field: "latestRevisionDate",
        headerName: "Revision Date",
        width: 150,
        valueFormatter: (params: any) => formatDateOnly(params.value),
      },
      {
        field: "currentRevision.uploadedAt",
        headerName: "Latest Revision Uploaded",
        width: 190,
        valueFormatter: (params: any) => formatDateTime(params.value),
      },
      {
        headerName: "Actions",
        width: 260,
        pinned: "right",
        cellRenderer: (params: any) => {
          const item = params.data;
          if (!item) return null;
          return (
            <div className="flex gap-2">
              {item.currentRevision && (
                <button
                  onClick={() =>
                    handlePreview(
                      item.id,
                      item.currentRevision.id,
                      item.currentRevision.originalFileName || "drawing",
                      item.currentRevision.fileType,
                      canDownload(item),
                    )
                  }
                  className="p-1.5 text-text-secondary hover:bg-surface-raised rounded transition-colors"
                  title="Preview"
                >
                  <Eye size={16} />
                </button>
              )}
              <button
                onClick={() => handleUploadClick(item)}
                className="p-1.5 text-primary hover:bg-primary-muted rounded transition-colors"
                title="Upload New Revision"
              >
                <Upload size={16} />
              </button>
              {item.currentRevision && (
                <button
                  onClick={() =>
                    canDownload(item)
                      ? handleDownload(
                          item.currentRevision.id,
                          item.currentRevision.originalFileName || "drawing.pdf",
                        )
                      : alert("Download is allowed only for Active GFC drawings")
                  }
                  disabled={!canDownload(item)}
                  className={`p-1.5 rounded transition-colors ${
                    canDownload(item)
                      ? "text-success hover:bg-success-muted"
                      : "text-text-disabled bg-surface-base cursor-not-allowed"
                  }`}
                  title="Download Latest"
                >
                  <Download size={16} />
                </button>
              )}
              <button
                onClick={() => {
                  setSelectedItem(item);
                  setIsHistoryModalOpen(true);
                }}
                className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                title="View History"
              >
                <History size={16} />
              </button>
              <button
                onClick={() => {
                  setSelectedItem(item);
                  setIsCreateModalOpen(true);
                }}
                className="p-1.5 text-warning hover:bg-warning-muted rounded transition-colors"
                title="Edit Details"
              >
                <FileText size={16} />
              </button>
              <button
                onClick={() => handleDelete(item)}
                className="p-1.5 text-error hover:bg-error-muted rounded transition-colors"
                title="Delete"
              >
                <Plus size={16} className="rotate-45" />
              </button>
            </div>
          );
        },
      },
    ],
    [projectId],
  );

  return (
    <div className="h-full flex flex-col bg-surface-card rounded-lg shadow-sm border border-border-default">
      <div className="p-4 border-b border-border-default flex justify-between items-center bg-surface-base">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <FileText size={20} className="text-primary" />
          Drawing Register
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport("CSV")}
            className="px-3 py-1.5 text-sm bg-surface-card border border-border-strong rounded hover:bg-surface-base flex items-center gap-2"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button
            onClick={() => handleExport("EXCEL")}
            className="px-3 py-1.5 text-sm bg-surface-card border border-border-strong rounded hover:bg-surface-base flex items-center gap-2"
          >
            <FileText size={16} />
            Export Excel
          </button>
          <button
            onClick={() => {
              setSelectedItem(null);
              setIsCreateModalOpen(true);
            }}
            className="px-3 py-1.5 text-sm bg-primary text-white rounded hover:bg-primary-dark flex items-center gap-2"
          >
            <Plus size={16} />
            Add Drawing
          </button>
          <button
            onClick={() => fetchData()}
            className="px-3 py-1.5 text-sm bg-surface-card border border-border-strong rounded hover:bg-surface-base"
          >
            Refresh
          </button>
        </div>
      </div>

      <div
        className="flex-1 ag-theme-alpine ag-theme-setu"
        style={{ width: "100%" }}
      >
        <AgGridReact
          rowData={rowData}
          columnDefs={colDefs}
          getRowStyle={(params) =>
            params.data?.currentRevisionUnread
              ? { fontWeight: "700", backgroundColor: "#eff6ff" }
              : undefined
          }
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
            flex: 0,
          }}
          rowHeight={48}
          headerHeight={48}
          animateRows={true}
          loadingOverlayComponent={() => (
            <div className="text-text-muted">Loading drawings...</div>
          )}
        />
      </div>

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={handleUpload}
        registerItem={selectedItem}
      />

      <CreateDrawingModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchData}
        projectId={projectId || ""}
        initialData={selectedItem}
      />

      <RevisionHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        registerItem={selectedItem}
        projectId={projectId || ""}
        onDownload={handleDownload}
        canDownload={selectedItem ? canDownload(selectedItem) : false}
      />

      <PreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => {
          setIsPreviewModalOpen(false);
          if (previewUrl) window.URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
          setPreviewCanDownload(false);
          setPreviewRevisionId(undefined);
        }}
        fileUrl={previewUrl}
        fileName={previewFile?.name || ""}
        fileType={previewFile?.type || ""}
        canDownload={previewCanDownload}
        revisionId={previewRevisionId}
        projectId={projectId}
      />
    </div>
  );
};

export default DrawingRegister;
