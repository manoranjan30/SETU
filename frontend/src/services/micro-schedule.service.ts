import api from '../api/axios';

// ==================== TYPES & INTERFACES ====================

export const MicroScheduleStatus = {
    DRAFT: 'DRAFT',
    SUBMITTED: 'SUBMITTED',
    APPROVED: 'APPROVED',
    ACTIVE: 'ACTIVE',
    SUSPENDED: 'SUSPENDED',
    COMPLETED: 'COMPLETED',
    ARCHIVED: 'ARCHIVED',
} as const;

export type MicroScheduleStatus = typeof MicroScheduleStatus[keyof typeof MicroScheduleStatus];

export const MicroActivityStatus = {
    PLANNED: 'PLANNED',
    IN_PROGRESS: 'IN_PROGRESS',
    DELAYED: 'DELAYED',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
} as const;

export type MicroActivityStatus = typeof MicroActivityStatus[keyof typeof MicroActivityStatus];

export const DelayCategory = {
    WEATHER: 'WEATHER',
    MATERIAL: 'MATERIAL',
    MANPOWER: 'MANPOWER',
    EQUIPMENT: 'EQUIPMENT',
    DESIGN: 'DESIGN',
    CLIENT: 'CLIENT',
    SUBCONTRACTOR: 'SUBCONTRACTOR',
    COORDINATION: 'COORDINATION',
    OTHER: 'OTHER',
} as const;

export type DelayCategory = typeof DelayCategory[keyof typeof DelayCategory];

export interface MicroSchedule {
    id: number;
    projectId: number;
    parentActivityId: number;
    name: string;
    description?: string;
    version: number;
    baselineStart: string;
    baselineFinish: string;
    plannedStart: string;
    plannedFinish: string;
    forecastFinish?: string;
    actualStart?: string;
    actualFinish?: string;
    status: MicroScheduleStatus;
    overshootFlag: boolean;
    overshootDays: number;
    totalAllocatedQty: number;
    totalActualQty: number;
    createdBy: number;
    approvedBy?: number;
    approvedAt?: string;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string;
    parentActivity?: any;
    creator?: any;
    approver?: any;
    activities?: MicroScheduleActivity[];
}

export interface MicroScheduleActivity {
    id: number;
    microScheduleId: number;
    parentActivityId: number;
    boqItemId?: number;
    workOrderItemId?: number;
    workOrderId?: number;
    vendorId?: number;
    epsNodeId: number;
    name: string;
    description?: string;
    allocatedQty: number;
    uom: string;
    plannedStart: string;
    plannedFinish: string;
    forecastFinish?: string;
    actualStart?: string;
    actualFinish?: string;
    progressPercent: number;
    varianceDays: number;
    status: MicroActivityStatus;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string;
    microSchedule?: MicroSchedule;
    epsNode?: any;
    boqItem?: any;
    workOrder?: any;
    dailyLogs?: MicroDailyLog[];
}

export interface MicroDailyLog {
    id: number;
    microActivityId: number;
    logDate: string;
    qtyDone: number;
    manpowerCount: number;
    equipmentHours: number;
    delayReasonId?: number;
    remarks?: string;
    createdBy: number;
    createdAt: string;
    updatedAt: string;
    microActivity?: MicroScheduleActivity;
    delayReason?: DelayReason;
    creator?: any;
}

export interface DelayReason {
    id: number;
    code: string;
    name: string;
    category: DelayCategory;
    description?: string;
    isActive: boolean;
}

export interface MicroQuantityLedger {
    id: number;
    parentActivityId: number;
    workOrderItemId?: number;
    workOrderId?: number;
    vendorId?: number;
    boqItemId: number;
    totalParentQty: number;
    allocatedQty: number;
    consumedQty: number;
    balanceQty: number;
    uom: string;
    lastReconciled?: string;
    boqItem?: any;
    parentActivity?: any;
    workOrder?: any;
    vendor?: any;
}

export interface ProductivityStats {
    avgDailyRate: number;
    totalDaysWorked: number;
    totalQtyDone: number;
    avgManpower: number;
    avgEquipmentHours: number;
}

// ==================== DTOs ====================

export interface CreateMicroScheduleDto {
    projectId: number;
    parentActivityId?: number;
    linkedActivityIds?: number[];
    name: string;
    description?: string;
    baselineStart: string;
    baselineFinish: string;
    plannedStart: string;
    plannedFinish: string;
    status?: MicroScheduleStatus;
}

export interface CreateMicroActivityDto {
    microScheduleId: number;
    parentActivityId: number;
    boqItemId?: number;
    workOrderItemId?: number;
    workOrderId?: number;
    vendorId?: number;
    epsNodeId: number;
    name: string;
    description?: string;
    allocatedQty: number;
    uom: string;
    plannedStart: string;
    plannedFinish: string;
    status?: MicroActivityStatus;
}

export interface CreateDailyLogDto {
    microActivityId: number;
    logDate: string;
    qtyDone: number;
    manpowerCount?: number;
    equipmentHours?: number;
    delayReasonId?: number;
    remarks?: string;
}

// ==================== SERVICE ====================

export const microScheduleService = {
    // ==================== MICRO SCHEDULE ====================

    createMicroSchedule: async (dto: CreateMicroScheduleDto): Promise<MicroSchedule> => {
        const response = await api.post('/micro-schedules', dto);
        return response.data;
    },

    getMicroSchedule: async (id: number): Promise<MicroSchedule> => {
        const response = await api.get(`/micro-schedules/${id}`);
        return response.data;
    },

    getMicroSchedulesByProject: async (projectId: number): Promise<MicroSchedule[]> => {
        const response = await api.get(`/micro-schedules/project/${projectId}`);
        return response.data;
    },

    getMicroSchedulesByActivity: async (activityId: number): Promise<MicroSchedule[]> => {
        const response = await api.get(`/micro-schedules/activity/${activityId}`);
        return response.data;
    },

    updateMicroSchedule: async (id: number, updates: Partial<MicroSchedule>): Promise<MicroSchedule> => {
        const response = await api.patch(`/micro-schedules/${id}`, updates);
        return response.data;
    },

    submitMicroSchedule: async (id: number): Promise<MicroSchedule> => {
        const response = await api.post(`/micro-schedules/${id}/submit`);
        return response.data;
    },

    approveMicroSchedule: async (id: number): Promise<MicroSchedule> => {
        const response = await api.post(`/micro-schedules/${id}/approve`);
        return response.data;
    },

    activateMicroSchedule: async (id: number): Promise<MicroSchedule> => {
        const response = await api.post(`/micro-schedules/${id}/activate`);
        return response.data;
    },

    completeMicroSchedule: async (id: number): Promise<MicroSchedule> => {
        const response = await api.post(`/micro-schedules/${id}/complete`);
        return response.data;
    },

    deleteMicroSchedule: async (id: number): Promise<void> => {
        await api.delete(`/micro-schedules/${id}`);
    },

    recalculateMicroSchedule: async (id: number): Promise<MicroSchedule> => {
        const response = await api.post(`/micro-schedules/${id}/recalculate`);
        return response.data;
    },

    // ==================== MICRO ACTIVITY ====================

    createActivity: async (dto: CreateMicroActivityDto): Promise<MicroScheduleActivity> => {
        const response = await api.post('/micro-schedules/activities', dto);
        return response.data;
    },

    getActivity: async (id: number): Promise<MicroScheduleActivity> => {
        const response = await api.get(`/micro-schedules/activities/${id}`);
        return response.data;
    },

    getActivitiesByMicroSchedule: async (microScheduleId: number): Promise<MicroScheduleActivity[]> => {
        const response = await api.get(`/micro-schedules/${microScheduleId}/activities`);
        return response.data;
    },

    updateActivity: async (id: number, updates: Partial<MicroScheduleActivity>): Promise<MicroScheduleActivity> => {
        const response = await api.patch(`/micro-schedules/activities/${id}`, updates);
        return response.data;
    },

    deleteActivity: async (id: number): Promise<void> => {
        await api.delete(`/micro-schedules/activities/${id}`);
    },

    calculateForecast: async (id: number): Promise<{ forecastFinish: string | null }> => {
        const response = await api.post(`/micro-schedules/activities/${id}/calculate-forecast`);
        return response.data;
    },

    // ==================== DAILY LOG ====================

    createDailyLog: async (dto: CreateDailyLogDto): Promise<MicroDailyLog> => {
        const response = await api.post('/micro-schedules/logs', dto);
        return response.data;
    },

    getDailyLog: async (id: number): Promise<MicroDailyLog> => {
        const response = await api.get(`/micro-schedules/logs/${id}`);
        return response.data;
    },

    getLogsByActivity: async (activityId: number): Promise<MicroDailyLog[]> => {
        const response = await api.get(`/micro-schedules/activities/${activityId}/logs`);
        return response.data;
    },

    getLogsByDateRange: async (
        activityId: number,
        startDate: string,
        endDate: string
    ): Promise<MicroDailyLog[]> => {
        const response = await api.get(
            `/micro-schedules/activities/${activityId}/logs/range?startDate=${startDate}&endDate=${endDate}`
        );
        return response.data;
    },

    getTodayLogs: async (microScheduleId: number): Promise<MicroDailyLog[]> => {
        const response = await api.get(`/micro-schedules/${microScheduleId}/logs/today`);
        return response.data;
    },

    updateDailyLog: async (id: number, updates: Partial<MicroDailyLog>): Promise<MicroDailyLog> => {
        const response = await api.patch(`/micro-schedules/logs/${id}`, updates);
        return response.data;
    },

    deleteDailyLog: async (id: number): Promise<void> => {
        await api.delete(`/micro-schedules/logs/${id}`);
    },

    getProductivityStats: async (activityId: number): Promise<ProductivityStats> => {
        const response = await api.get(`/micro-schedules/activities/${activityId}/productivity`);
        return response.data;
    },

    // ==================== LEDGER ====================

    getLedgerByActivity: async (activityId: number): Promise<MicroQuantityLedger[]> => {
        const response = await api.get(`/micro-schedules/ledger/activity/${activityId}`);
        return response.data;
    },

    reconcileLedger: async (parentActivityId: number, boqItemId: number): Promise<void> => {
        await api.post('/micro-schedules/ledger/reconcile', {
            parentActivityId,
            boqItemId,
        });
    },

    // ==================== DELAY REASONS ====================

    getDelayReasons: async (): Promise<DelayReason[]> => {
        const response = await api.get('/micro-schedules/delay-reasons');
        return response.data;
    },
};

export default microScheduleService;
