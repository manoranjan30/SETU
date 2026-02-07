import { DataSource, Repository } from 'typeorm';
import { MeasurementElement } from '../boq/entities/measurement-element.entity';
import { MeasurementProgress } from '../boq/entities/measurement-progress.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';
import { Activity } from '../wbs/entities/activity.entity';
import { BoqActivityPlan } from '../planning/entities/boq-activity-plan.entity';
import { BoqService } from '../boq/boq.service';
export declare class ExecutionService {
    private dataSource;
    private boqService;
    private activityRepo;
    private planRepo;
    private boqRepo;
    private progressRepo;
    private measurementRepo;
    private readonly logger;
    constructor(dataSource: DataSource, boqService: BoqService, activityRepo: Repository<Activity>, planRepo: Repository<BoqActivityPlan>, boqRepo: Repository<BoqItem>, progressRepo: Repository<MeasurementProgress>, measurementRepo: Repository<MeasurementElement>);
    batchSaveMeasurements(projectId: number, entries: any[], userId: number): Promise<MeasurementProgress[]>;
    private syncSchedule;
    private recalculateActivityProgress;
    getProjectProgressLogs(projectId: number): Promise<MeasurementProgress[]>;
    updateProgressLog(logId: number, newQty: number, userId: number): Promise<MeasurementProgress>;
    deleteProgressLog(logId: number): Promise<{
        success: boolean;
    }>;
}
