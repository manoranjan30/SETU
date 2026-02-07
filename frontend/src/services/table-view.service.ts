import api from '../api/axios';

export interface TableViewConfig {
    id: number;
    userId: number;
    tableId: string;
    viewName: string;
    config: {
        columns: {
            id: string; // matches field name in data
            label: string;
            visible: boolean;
            width?: string;
        }[];
    };
    isDefault: boolean;
}

export const tableViewService = {
    getViews: async (tableId: string) => {
        const response = await api.get(`/table-views/${tableId}`);
        return response.data as TableViewConfig[];
    },

    saveView: async (tableId: string, viewName: string, config: any, isDefault: boolean = false) => {
        const response = await api.post(`/table-views`, { tableId, viewName, config, isDefault });
        return response.data;
    },

    deleteView: async (id: number) => {
        const response = await api.delete(`/table-views/${id}`);
        return response.data;
    }
};
