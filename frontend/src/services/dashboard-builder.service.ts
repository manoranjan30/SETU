import api from '../api/axios';

// ─── Types ────────────────────────────────────────────────────────────────

export interface DataSourceField {
    key: string;
    label: string;
    type: 'string' | 'number' | 'date' | 'boolean' | 'percent';
    aggregatable?: boolean;
    groupable?: boolean;
    filterable?: boolean;
}

export interface DataSourceFilter {
    key: string;
    label: string;
    type: 'select' | 'date_range' | 'number_range' | 'text' | 'multi_select';
    options?: { value: string; label: string }[];
    required?: boolean;
}

export interface DataSourceMeta {
    key: string;
    label: string;
    module: string;
    scope: 'PROJECT' | 'GLOBAL' | 'BOTH';
    fields: DataSourceField[];
    filters: DataSourceFilter[];
}

export interface WidgetConfig {
    id?: number;
    widgetType: string;
    title: string;
    dataSourceKey: string;
    queryConfig: any;
    displayConfig: any;
    gridPosition: { x: number; y: number; w: number; h: number };
    refreshIntervalSec: number;
    sortOrder: number;
}

export interface DashboardConfig {
    id?: number;
    name: string;
    description?: string;
    scope: 'PROJECT' | 'GLOBAL';
    layoutConfig?: any;
    isTemplate?: boolean;
    isDefault?: boolean;
    isActive?: boolean;
    widgets?: WidgetConfig[];
    createdBy?: any;
    createdAt?: string;
    updatedAt?: string;
}

export interface DashboardTemplate {
    id: number;
    name: string;
    category: string;
    description?: string;
    thumbnailUrl?: string;
    isSystemTemplate: boolean;
}

// ─── API Calls ────────────────────────────────────────────────────────────

const BASE = '/dashboard-builder';

export const dashboardBuilderApi = {
    // Dashboards
    getAll: () => api.get<DashboardConfig[]>(BASE),
    getOne: (id: number) => api.get<DashboardConfig>(`${BASE}/${id}`),
    create: (dto: Partial<DashboardConfig>) => api.post<DashboardConfig>(BASE, dto),
    update: (id: number, dto: Partial<DashboardConfig>) => api.patch<DashboardConfig>(`${BASE}/${id}`, dto),
    remove: (id: number) => api.delete(`${BASE}/${id}`),
    clone: (id: number) => api.post<DashboardConfig>(`${BASE}/${id}/clone`),
    getMyDashboard: () => api.get<DashboardConfig | null>(`${BASE}/my`),

    // Widgets
    addWidget: (dashboardId: number, dto: Partial<WidgetConfig>) =>
        api.post<WidgetConfig>(`${BASE}/${dashboardId}/widgets`, dto),
    updateWidget: (widgetId: number, dto: Partial<WidgetConfig>) =>
        api.patch<WidgetConfig>(`${BASE}/widgets/${widgetId}`, dto),
    removeWidget: (widgetId: number) => api.delete(`${BASE}/widgets/${widgetId}`),

    // Data Sources
    getDataSources: () => api.get<DataSourceMeta[]>(`${BASE}/data-sources`),
    queryData: (key: string, config: any) =>
        api.post<any[]>(`${BASE}/data-sources/${key}/query`, config),
    previewData: (key: string, config: any) =>
        api.post<any[]>(`${BASE}/data-sources/${key}/preview`, config),

    // Assignments
    getAssignments: () => api.get<any[]>(`${BASE}/assignments`),
    saveAssignment: (dto: any) => api.post(`${BASE}/assignments`, dto),
    removeAssignment: (id: number) => api.delete(`${BASE}/assignments/${id}`),

    // Templates
    getTemplates: () => api.get<DashboardTemplate[]>(`${BASE}/templates`),
    applyTemplate: (templateId: number) =>
        api.post<DashboardConfig>(`${BASE}/templates/${templateId}/apply`),
    saveAsTemplate: (dashboardId: number, dto: { name: string; category: string; description?: string }) =>
        api.post(`${BASE}/${dashboardId}/save-as-template`, dto),

    // Common
    getDefaults: () => api.get<DashboardConfig>(`${BASE}/defaults/my`),
};
