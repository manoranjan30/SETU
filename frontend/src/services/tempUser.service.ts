import api from '../api/axios';

export interface TempRoleTemplate {
    id: number;
    name: string;
    description: string;
    allowedPermissions: string[];
    isActive: boolean;
    createdAt: string;
}

export interface TempUser {
    id: number;
    user: {
        id: number;
        username: string; // mobile
        displayName: string;
        email: string;
        designation: string;
        isActive: boolean;
    };
    vendor: {
        id: number;
        name: string;
    };
    workOrder: {
        id: number;
        woNumber: string;
    };
    tempRoleTemplate: {
        id: number;
        name: string;
    };
    expiryDate: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
    suspensionReason?: string;
    suspendedAt?: string;
}

export const tempUserService = {
    // Templates
    getTemplates: async () => {
        const res = await api.get<TempRoleTemplate[]>('/temp-roles');
        return res.data;
    },
    createTemplate: async (data: Partial<TempRoleTemplate>) => {
        const res = await api.post<TempRoleTemplate>('/temp-roles', data);
        return res.data;
    },
    updateTemplate: async (id: number, data: Partial<TempRoleTemplate>) => {
        const res = await api.put<TempRoleTemplate>(`/temp-roles/${id}`, data);
        return res.data;
    },
    deleteTemplate: async (id: number) => {
        const res = await api.delete(`/temp-roles/${id}`);
        return res.data;
    },

    // Temp Users
    getVendorsForProject: async (projectId: number) => {
        const res = await api.get(`/temp-users/vendors?projectId=${projectId}`);
        return res.data;
    },
    getWorkOrders: async (vendorId: number, projectId: number) => {
        const res = await api.get(`/temp-users/work-orders?vendorId=${vendorId}&projectId=${projectId}`);
        return res.data;
    },
    getTempUsersInProject: async (projectId: number) => {
        const res = await api.get<TempUser[]>(`/temp-users?projectId=${projectId}`);
        return res.data;
    },
    createTempUser: async (data: any) => {
        const res = await api.post('/temp-users', data);
        return res.data;
    },
    suspendTempUser: async (id: number, reason: string) => {
        const res = await api.put(`/temp-users/${id}/suspend`, { reason });
        return res.data;
    },
    reactivateTempUser: async (id: number) => {
        const res = await api.put(`/temp-users/${id}/reactivate`);
        return res.data;
    },
};
