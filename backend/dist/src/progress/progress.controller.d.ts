import { ProgressService } from './progress.service';
export declare class ProgressController {
    private readonly progressService;
    constructor(progressService: ProgressService);
    getBurnRateStats(projectId: string): Promise<{
        today: number;
        thisWeek: number;
        thisMonth: number;
        total: number;
        trends: Record<string, number>;
    }>;
    getPlanVsAchieved(projectId: string): Promise<{
        planned: number;
        achieved: number;
        variance: number;
        status: string;
    }>;
    getEfficiencyInsights(projectId: string): Promise<{
        topBurners: {
            name: string;
            value: number;
        }[];
        alerts: never[];
    }>;
}
