import api from '../api/axios';

export interface ExecutionContext {
    id: number;
    epsNode: { id: number; name: string };
    boqElement: { id: number; boqCode: string; boqName: string; unitOfMeasure: string };
    activity?: { id: number; name: string; activityId: string };
    plannedQuantity: number;
    actualQuantity: number;
    remainingQuantity: number;
    percentComplete: number;
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
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

export const executionService = {
    // Create Mapping
    create: async (data: CreateContextDto) => {
        return await api.post('/execution-context', data);
    },

    // Get All Contexts for Project
    getByProject: async (projectId: number): Promise<ExecutionContext[]> => {
        const res = await api.get(`/execution-context/project/${projectId}`);
        return res.data;
    },

    // Update Progress
    updateProgress: async (id: number, data: UpdateProgressDto) => {
        return await api.patch(`/execution-context/${id}/progress`, data);
    }
};
