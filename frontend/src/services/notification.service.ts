import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export interface PendingTaskItem {
    type: 'RFI_APPROVAL' | 'RFI_RAISED' | 'OBS_CLOSE' | 'OBS_RECTIFY';
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
    getPendingTasks: async (projectId?: number): Promise<PendingTasksResponse> => {
        const params = projectId ? { projectId } : {};
        const res = await axios.get(`${API_URL}/pending-tasks/my`, { params });
        return res.data;
    }
};
