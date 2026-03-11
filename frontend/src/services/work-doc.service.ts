import api from "../api/axios";

export interface WorkOrder {
  id: number;
  projectId: number;
  vendorId: number;
  woNumber: string;
  date: string;
  status: string;
  vendor?: { name: string; code: string };
  items?: WorkOrderItem[];
}

export interface WorkOrderItem {
  id: number;
  workOrderId: number;
  materialCode: string;
  shortText: string;
  longText: string;
  uom: string;
  quantity: number;
  rate: number;
  amount: number;
  executedQuantity?: number;
  boqItemId?: number;
  mappingStatus?: "PENDING" | "AUTO_CODE" | "AUTO_DESC" | "MANUAL";
}

export interface PendingBoardItem {
  id: number;
  workOrderId: number;
  workOrderRef: string;
  vendorName: string;
  materialCode: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  mappingStatus: string;
  suggestedBoqId: number | null;
}

export interface ColumnMapping {
  serialNumber?: number;
  sapItemNumber?: number;
  shortDescription?: number;
  detailDescription?: number;
  uom?: number;
  quantity?: number;
  rate?: number;
  amount?: number;
}

export interface ConfirmWorkOrderData {
  vendor: { code: string };
  header: {
    woNumber: string;
    date: string;
  };
  items: {
    code: string;
    description: string;
    longText: string;
    qty: number;
    uom: string;
    rate: number;
    amount: number;
    serialNumber: string;
    parentSerialNumber: string | null;
    level: number;
    isParent: boolean;
  }[];
  pdfPath: string | null;
  originalFileName?: string;
}

export interface ExcelImportResult {
  projectId: number;
  items: {
    serialNumber: string;
    parentSerialNumber: string | null;
    level: number;
    isParent: boolean;
    materialCode: string;
    shortText: string;
    longText: string;
    uom: string;
    quantity: number;
    rate: number;
    amount: number;
    calculatedAmount: number;
  }[];
  filePath: string;
  originalFileName: string;
  totalItems: number;
}

export const WorkDocService = {
  // --- Vendors ---
  getAllVendors: async (search?: string) => {
    const res = await api.get("/workdoc/vendors", { params: { search } });
    return res.data;
  },

  getVendorWorkOrders: async (vendorId: number) => {
    const res = await api.get(`/workdoc/vendors/${vendorId}/work-orders`);
    return res.data;
  },

  // --- Work Orders ---
  getProjectWorkOrders: async (projectId: number) => {
    const res = await api.get(`/workdoc/${projectId}/work-orders`);
    return res.data;
  },

  getWorkOrderDetail: async (woId: number) => {
    const res = await api.get(`/workdoc/work-orders/${woId}`);
    return res.data;
  },

  // --- Import & Export ---
  previewExcelFn: async (
    projectId: number,
    file: File,
  ): Promise<{
    previewRows: string[][];
    potentialHeaders: string[][];
    totalRows: number;
    fileName: string;
  }> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post(
      `/workdoc/${projectId}/preview-excel`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return res.data;
  },

  importExcelFn: async (
    projectId: number,
    file: File,
    mapping: ColumnMapping,
    headerRow: number,
  ): Promise<ExcelImportResult> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("columnMapping", JSON.stringify(mapping));
    formData.append("headerRow", String(headerRow));
    const res = await api.post(`/workdoc/${projectId}/import-excel`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  confirmWorkOrder: async (projectId: number, data: ConfirmWorkOrderData) => {
    const res = await api.post(`/workdoc/${projectId}/confirm`, data);
    return res.data;
  },

  // --- Mapping ---
  getPendingVendorBoard: async (
    projectId: number,
  ): Promise<PendingBoardItem[]> => {
    const res = await api.get(`/workdoc/${projectId}/pending-vendor-board`);
    return res.data;
  },

  getMappingSuggestions: async (projectId: number, search: string) => {
    const res = await api.get(`/workdoc/mapping/suggestions`, {
      params: { projectId, search },
    });
    return res.data;
  },

  autoMapWorkOrder: async (workOrderId: number) => {
    const res = await api.post(`/workdoc/mapping/auto`, { workOrderId });
    return res.data;
  },

  bulkMapItems: async (
    projectId: number,
    mappings: { woItemId: number; boqItemId: number | null }[],
  ) => {
    const res = await api.post(`/workdoc/mapping/bulk`, {
      projectId,
      mappings,
    });
    return res.data;
  },
};
