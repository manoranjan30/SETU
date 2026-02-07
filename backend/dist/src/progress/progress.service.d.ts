import { Repository } from 'typeorm';
import { MeasurementProgress } from '../boq/entities/measurement-progress.entity';
import { MeasurementElement } from '../boq/entities/measurement-element.entity';
import { BoqActivityPlan } from '../planning/entities/boq-activity-plan.entity';
export declare class ProgressService {
    private progressRepo;
    private elementRepo;
    private planRepo;
    private readonly logger;
    constructor(progressRepo: Repository<MeasurementProgress>, elementRepo: Repository<MeasurementElement>, planRepo: Repository<BoqActivityPlan>);
    getBurnRateStats(projectId: number): Promise<{
        today: number;
        thisWeek: number;
        thisMonth: number;
        total: number;
        trends: Record<string, number>;
    }>;
    getPlanVsAchieved(projectId: number): Promise<{
        planned: number;
        achieved: number;
        variance: number;
        status: string;
    }>;
    getEfficiencyInsights(projectId: number): Promise<{
        topBurners: {
            name: string;
            value: number;
        }[];
        alerts: never[];
    }>;
}
