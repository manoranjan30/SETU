import { DashboardService } from './dashboard.service';
export declare class DashboardController {
    private readonly dashboardService;
    constructor(dashboardService: DashboardService);
    getSummary(): Promise<{
        totalProjects: number;
        activeProjects: number;
        delayedActivities: number;
        thisWeekBurn: number;
        todayManpower: number;
        projects: {
            id: number;
            name: string;
            status: string;
        }[];
    }>;
    getBurnRate(): Promise<{
        trends: {
            date: any;
            value: number;
        }[];
        total: any;
    }>;
    getManpower(): Promise<{
        total: any;
        byCategory: {
            name: any;
            count: number;
        }[];
    }>;
    getMilestones(): Promise<any[]>;
    getAlerts(): Promise<{
        type: string;
        message: string;
        severity: string;
        count?: number;
    }[]>;
}
