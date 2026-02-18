import api from '../api/axios';

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
    // ... other fields
}

export const planningService = {
    getProjectActivities: async (projectId: number): Promise<PlanningActivity[]> => {
        const response = await api.get(`/projects/${projectId}/schedule`);
        // The /schedule endpoint returns { activities: [], relationships: [] }
        return response.data.activities || [];
    },

    getWbsNodes: async (projectId: number): Promise<any[]> => {
        const response = await api.get(`/projects/${projectId}/wbs`);
        return response.data;
    }
};

export default planningService;
