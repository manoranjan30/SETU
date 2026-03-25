import api from "../api/axios";

export interface ExecutionContext {
  id: number;
  epsNode: { id: number; name: string };
  boqElement: {
    id: number;
    boqCode: string;
    boqName: string;
    unitOfMeasure: string;
  };
  activity?: { id: number; name: string; activityId: string };
  plannedQuantity: number;
  actualQuantity: number;
  remainingQuantity: number;
  percentComplete: number;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  actualStartDate?: string;
  actualFinishDate?: string;
}

export interface CreateContextDto {
  projectId: number;
  epsNodeId: number;
  boqElementId: number;
  activityId?: number;
  plannedQuantity: number;
}

export interface UpdateProgressDto {
  actualQuantity: number;
  date?: string;
  status?: string;
}

// NEW: Micro Schedule Breakdown Types
export interface ExecutionBreakdownItem {
  type: "MICRO" | "BALANCE";
  id: number | null;
  name: string;
  boqSubItemId?: number | null;
  microActivityId?: number | null;
  microActivityName?: string | null;
  microActivityDescription?: string | null;
  workOrderItemDescription?: string | null;
  workOrderNumber?: string | null;
  wbsPath?: string | null;
  wbsParentName?: string | null;
  wbsGrandparentName?: string | null;
  displayLabel?: string | null;
  subtitle?: string | null;
  allocatedQty: number;
  executedQty: number;
  balanceQty: number;
}

export interface VendorBreakdownItem {
  vendorId: number | null;
  vendorName: string;
  vendorCode: string | null;
  workOrderNumber: string | null;
  boqBreakdown: {
    boqItem: any;
    boqSubItemId?: number | null;
    workOrderItemId: number | null;
    planId: number | null;
    workOrderItemDescription?: string | null;
    scope: {
      total: number;
      allocated: number;
      balance: number;
    };
    items: ExecutionBreakdownItem[];
  }[];
}

export interface ExecutionBreakdown {
  activityId: number;
  activity: any;
  epsNodeId: number;
  vendorBreakdown: VendorBreakdownItem[];
}

export interface VendorSummaryItem {
  vendorId: number | null;
  vendorName: string;
  vendorCode: string | null;
  workOrderNumber: string | null;
  boqItemCount: number;
  totalAllocatedQty: number;
}

export const executionService = {
  // Create Mapping
  create: async (data: CreateContextDto) => {
    return await api.post("/execution-context", data);
  },

  // Get All Contexts for Project
  getByProject: async (projectId: number): Promise<ExecutionContext[]> => {
    const res = await api.get(`/execution-context/project/${projectId}`);
    return res.data;
  },

  // Update Progress
  updateProgress: async (id: number, data: UpdateProgressDto) => {
    return await api.patch(`/execution-context/${id}/progress`, data);
  },

  // NEW: Check if activity has micro schedule
  hasMicroSchedule: async (activityId: number): Promise<boolean> => {
    try {
      const res = await api.get(`/execution/has-micro/${activityId}`);
      return res.data.hasMicro || false;
    } catch {
      return false;
    }
  },

  getBreakdown: async (
    activityId: number,
    epsNodeId: number,
  ): Promise<ExecutionBreakdown> => {
    // Updated Endpoint
    const res = await api.get(
      `/execution/breakdown/${activityId}/${epsNodeId}`,
    );
    return res.data;
  },

  // NEW: Get vendor summary for an activity
  getVendorSummary: async (
    activityId: number,
    epsNodeId?: number,
  ): Promise<{ vendors: VendorSummaryItem[]; hasVendors: boolean }> => {
    const res = await api.get(`/execution/vendors/${activityId}`, {
      params: epsNodeId ? { epsNodeId } : undefined,
    });
    return res.data;
  },
};
