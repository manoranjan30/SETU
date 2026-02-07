import { Repository } from 'typeorm';
import { EpsNode } from '../eps/eps.entity';
import { Activity } from '../wbs/entities/activity.entity';
import { MeasurementProgress } from '../boq/entities/measurement-progress.entity';
import { DailyLaborPresence } from '../labor/entities/daily-labor-presence.entity';
import { BoqActivityPlan } from '../planning/entities/boq-activity-plan.entity';
export declare class DashboardService {
    private readonly epsRepo;
    private readonly activityRepo;
    private readonly progressRepo;
    private readonly laborRepo;
    private readonly planRepo;
    constructor(epsRepo: Repository<EpsNode>, activityRepo: Repository<Activity>, progressRepo: Repository<MeasurementProgress>, laborRepo: Repository<DailyLaborPresence>, planRepo: Repository<BoqActivityPlan>);
    getPortfolioSummary(): Promise<{
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
    getPortfolioBurnRate(): Promise<{
        trends: {
            date: any;
            value: number;
        }[];
        total: any;
    }>;
    getTodaysManpower(): Promise<{
        total: any;
        byCategory: {
            name: any;
            count: number;
        }[];
    }>;
    getUpcomingMilestones(): Promise<any[]>;
    getAlerts(): Promise<{
        type: string;
        message: string;
        severity: string;
        count?: number;
    }[]>;
}
