import api from "../api/axios";

export interface PendingTaskItem {
  type: "RFI_APPROVAL" | "RFI_RAISED" | "OBS_CLOSE" | "OBS_RECTIFY";
  id: string | number;
  title: string;
  subtitle: string;
  date: string;
}

export interface PendingTasksResponse {
  approvalsCount: number;
  raisedRFIsCount: number;
  obsToCloseCount: number;
  vendorObsCount: number;
  totalCount: number;
  items: PendingTaskItem[];
}

export const notificationService = {
  getPendingTasks: async (
    projectId?: number,
  ): Promise<PendingTasksResponse> => {
    const params = projectId ? { projectId } : {};
    const res = await api.get("/pending-tasks/my", { params });
    return res.data;
  },
};
