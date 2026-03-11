import api from "../api/axios";

export interface PlanningActivity {
  id: number;
  activityCode: string;
  activityName: string;
  description?: string;
  startDatePlanned: string;
  finishDatePlanned: string;
  durationPlanned: number;
  wbsNodeId: number;
  uom?: string;
  quantity?: number;
  boqItems?: any[]; // BOQ items linked to this activity
  wbsNode?: { id: number; wbsCode?: string; wbsName?: string }; // Populated WBS node
  // ... other fields
}

export const planningService = {
  getProjectActivities: async (
    projectId: number,
  ): Promise<PlanningActivity[]> => {
    const response = await api.get(`/projects/${projectId}/schedule`);
    // The /schedule endpoint returns { activities: [], relationships: [] }
    return response.data.activities || [];
  },

  getWbsNodes: async (projectId: number): Promise<any[]> => {
    const response = await api.get(`/projects/${projectId}/wbs`);
    return response.data;
  },

  getProjectEps: async (projectId: number): Promise<any[]> => {
    const response = await api.get(`/eps/${projectId}/tree`);
    return response.data;
  },

  getDistributionMatrix: async (
    projectId: number,
  ): Promise<Record<string, number[]>> => {
    const response = await api.get(
      `/planning/${projectId}/distribution-matrix`,
    );
    return response.data;
  },
};

export default planningService;
