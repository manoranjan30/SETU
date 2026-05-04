import api from "../api/axios";
import { downloadBlob, withFileExtension } from "../utils/file-download.utils";

export interface BoqEpsNodeRef {
  id: number;
  name: string;
  parentId?: number;
  type?: string;
}

export interface BoqSubItem {
  id: number;
  boqItemId: number;
  description: string;
  uom: string;
  qty: number;
  rateSource: "SUB_ITEM" | "MEASUREMENT";
  rate: number; // Sub-item specific rate override
  amount: number;
  measurements?: MeasurementElement[];
  analysisTemplateId?: number;
}

export interface BoqItem {
  id: number;
  boqCode: string;
  description: string; // Was boqName
  longDescription?: string; // New Detailed Description
  uom: string;
  qty: number; // Rollup from SubItems
  rate: number; // Derived or informational
  amount: number; // Rollup from SubItems
  qtyMode: "MANUAL" | "DERIVED";
  subItems?: BoqSubItem[]; // Layer 1.5
  measurements?: MeasurementElement[]; // Layer 2 (Deprecated/Legacy)
  customAttributes?: Record<string, unknown>;
  // Legacy mapping helpers (optional, or we update UI)
  boqName?: string;
  totalQuantity?: number;
  consumedQuantity: number; // Layer 4 Rollup
  epsNode?: BoqEpsNodeRef;
  analysisTemplateId?: number; // Linked Analysis Template
}

export interface MeasurementElement {
  id: number;
  epsNodeId: number;
  // Parent Linkage
  boqItemId?: number; // Legacy
  boqSubItemId?: number; // New Layer 2 Parent

  elementId: string;
  elementName: string;
  elementCategory?: string;
  elementType?: string;
  grid?: string;
  linkingElement?: string;
  uom?: string;
  rate: number;

  length: number;
  breadth: number;
  depth: number;
  height?: number;
  bottomLevel?: number;
  topLevel?: number;
  perimeter?: number;
  baseArea?: number;

  qty: number;
  executedQty: number;
  analysisTemplateId?: number;

  baseCoordinates?: unknown;
  plineAllLengths?: unknown;
  customAttributes?: Record<string, unknown>;
  epsNode?: { id: number; name: string };
}

export interface CreateBoqDto {
  projectId: number;
  epsNodeId?: number; // Now optional
  boqCode: string;
  boqName: string;
  longDescription?: string; // New
  unitOfMeasure: string;
  totalQuantity: number;
}

export interface ImportMapping {
  [key: string]: string;
}

export const boqService = {
  // Download Template
  getBoqTemplate: async (projectId?: number) => {
    const response = await api.get("/boq/template", {
      params: projectId ? { projectId } : undefined,
      responseType: "blob", // Important for file download
    });
    downloadBlob(
      new Blob([response.data]),
      withFileExtension("BOQ_Import_Template", ".xlsx"),
    );
  },

  // Export BOQ (CSV)
  exportBoqCsv: async (projectId: number) => {
    const response = await api.get(`/boq/export/${projectId}`, {
      responseType: "blob",
    });
    downloadBlob(
      new Blob([response.data]),
      withFileExtension(`BOQ_Export_${projectId}`, ".csv"),
    );
  },

  // Import BOQ
  importBoq: async (formData: FormData) => {
    const projectId = formData.get("projectId");
    return await api.post(`/boq/import/${projectId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  // Get Items
  getBoqItems: async (projectId: number): Promise<BoqItem[]> => {
    const response = await api.get(`/boq/project/${projectId}`);
    return response.data;
  },

  recalculateProjectBoq: async (projectId: number) => {
    return await api.post(`/boq/project/${projectId}/recalculate`);
  },

  // Get EPS List (for Dropdown)
  getEpsList: async () => {
    const response = await api.get("/eps");
    return response.data;
  },

  getProjectEpsList: async (projectId: number) => {
    const response = await api.get(`/eps/${projectId}/tree`);
    const flatten = (
      nodes: Array<Record<string, unknown>>,
      acc: BoqEpsNodeRef[] = [],
    ) => {
      nodes.forEach((node) => {
        const rawNode = (node.data as Record<string, unknown> | undefined) ?? node;
        const nodeId = Number(rawNode?.id ?? node?.id);
        const nodeName = String(
          rawNode?.name ?? node?.label ?? node?.name ?? "",
        );
        const rawParentId = rawNode?.parentId ?? node?.parentId;
        const parentId =
          rawParentId === null || rawParentId === undefined || rawParentId === ""
            ? undefined
            : Number(rawParentId);

        acc.push({
          id: nodeId,
          name: nodeName,
          parentId,
          type:
            typeof rawNode?.type === "string"
              ? rawNode.type
              : typeof node?.type === "string"
                ? node.type
                : undefined,
        });
        if (Array.isArray(node.children) && node.children.length > 0) {
          flatten(node.children, acc);
        }
      });
      return acc;
    };
    return flatten(Array.isArray(response.data) ? response.data : []);
  },

  // Create Single Item
  createBoqItem: async (data: CreateBoqDto) => {
    return await api.post("/boq", data);
  },

  // Create Sub Item (Layer 1.5)
  createSubItem: async (data: {
    boqItemId: number;
    description: string;
    uom?: string;
    rateSource?: "SUB_ITEM" | "MEASUREMENT";
    rate?: number;
  }) => {
    return await api.post("/boq/sub-item", data);
  },

  // Update Sub Item
  updateSubItem: async (
    id: number,
    data: Partial<Pick<BoqSubItem, "description" | "uom" | "rate" | "rateSource">>,
  ) => {
    // data: { description, rate, uom }
    return await api.patch(`/boq/sub-item/${id}`, data);
  },

  // --- Measurement Layer (Layer 2) ---
  importMeasurements: async (formData: FormData) => {
    // Extract IDs from FormData logic happens in component or here?
    // Component now builds full FormData. Let's make this method accept FormData directly.
    // But the previous signature was specific. Let's keep it clean:
    // Actually, the component is building FormData but calling this with args?
    // ImportWizard says: await boqService.importMeasurements(formData);
    // So we change signature to accept FormData.

    // Extract IDs from URL if needed? No, path params are in URL.
    // Wait, the Controller route is `/boq/measurements/import/:projectId/:boqItemId`
    // We need to extract them or pass them separately.
    // Let's pass formData directly to axios.
    const projectId = formData.get("projectId");
    const boqItemId = formData.get("boqItemId");

    return await api.post(
      `/boq/measurements/import/${projectId}/${boqItemId}`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
  },

  addMeasurement: async (data: Record<string, unknown>) => {
    return await api.post("/boq/measurement", data);
  },

  getMeasurementTemplate: async (
    projectId?: number,
    boqItemId?: number,
    boqSubItemId?: number,
  ) => {
    const response = await api.get("/boq/measurements/template", {
      params: {
        ...(projectId ? { projectId } : {}),
        ...(boqItemId ? { boqItemId } : {}),
        ...(boqSubItemId ? { boqSubItemId } : {}),
      },
      responseType: "blob",
    });
    downloadBlob(
      new Blob([response.data]),
      withFileExtension("Measurement_Import_Template", ".xlsx"),
    );
  },

  // --- Progress Layer (Layer 4) ---
  addProgress: async (data: {
    measurementElementId: number;
    executedQty: number;
    date?: string;
  }) => {
    return await api.post("/boq/progress", data);
  },

  updateMeasurement: async (id: number, data: Record<string, unknown>) => {
    return await api.patch(`/boq/measurement/${id}`, data);
  },

  bulkUpdateMeasurements: async (
    ids: number[],
    data: Record<string, unknown>,
  ) => {
    return await api.patch("/boq/measurements/bulk", { ids, data });
  },

  // Edit Item
  update: async (id: number, data: Partial<BoqItem>) => {
    return await api.patch(`/boq/${id}`, data);
  },

  // Delete Item
  delete: async (id: number) => {
    return await api.delete(`/boq/${id}`);
  },

  deleteMeasurements: async (ids: number[]) => {
    return await api.post("/boq/measurements/bulk-delete", { ids });
  },
};
