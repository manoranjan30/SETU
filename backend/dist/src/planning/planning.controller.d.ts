import { PlanningService } from './planning.service';
import { PlanningBasis } from './entities/boq-activity-plan.entity';
import { ScheduleVersionService } from './schedule-version.service';
import { ImportExportService } from './import-export.service';
import { LookAheadDto } from './dto/look-ahead.dto';
import type { Response } from 'express';
export declare class PlanningController {
    private readonly planningService;
    private readonly versionService;
    private readonly importService;
    constructor(planningService: PlanningService, versionService: ScheduleVersionService, importService: ImportExportService);
    getMatrix(projectId: string): Promise<import("./entities/boq-activity-plan.entity").BoqActivityPlan[]>;
    getMapperBoq(projectId: string): Promise<any[]>;
    getStats(projectId: number): Promise<any>;
    getUnlinkedActivities(projectId: number): Promise<import("../wbs/entities/activity.entity").Activity[]>;
    getGapAnalysis(projectId: number): Promise<any[]>;
    getExecutionReadyActivities(projectId: number, wbsNodeId?: string): Promise<any[]>;
    distributeBoq(boqItemId: number, activityId: number, quantity: number, basis?: PlanningBasis, boqSubItemId?: number, measurementId?: number): Promise<import("./entities/boq-activity-plan.entity").BoqActivityPlan>;
    unlinkBoq(boqItemId: number, boqSubItemId?: number, measurementId?: number): Promise<void>;
    getRecoveryPlans(projectId: number): Promise<import("./entities/recovery-plan.entity").RecoveryPlan[]>;
    createRecoveryPlan(body: any): Promise<import("./entities/recovery-plan.entity").RecoveryPlan>;
    recordProgress(body: any): Promise<import("./entities/quantity-progress-record.entity").QuantityProgressRecord>;
    completeActivity(activityId: number): Promise<import("../wbs/entities/activity.entity").Activity>;
    distributeSchedule(body: {
        activityIds: number[];
        targetEpsIds: number[];
    }, req: any): Promise<any>;
    undistributeSchedule(body: {
        activityIds: number[];
        targetEpsIds: number[];
    }, req: any): Promise<{
        deleted: number | null | undefined;
    }>;
    repairLinks(): Promise<any>;
    debugProject(projectId: string): Promise<{
        projectId: number;
        totalActivities: number;
        totalPlans: number;
        plans: {
            planId: number;
            activity: string;
            plannedQty: number;
            measId: number;
            subItemId: number;
            measQtyFromLink: number;
        }[];
    }>;
    getDistributionMatrix(projectId: string): Promise<Record<string, number[]>>;
    getRelationships(projectId: string): Promise<import("../wbs/entities/activity-relationship.entity").ActivityRelationship[]>;
    debugActivityByName(name: string): Promise<{
        status: string;
        activity: {
            id: number;
            projectId: number;
            name: string;
            plans: {
                id: number;
                qty: number;
                measId: number;
                measQty: number;
            }[];
        };
        name?: undefined;
        count?: undefined;
        firstMatch?: undefined;
    } | {
        status: string;
        name: string;
        activity?: undefined;
        count?: undefined;
        firstMatch?: undefined;
    } | {
        status: string;
        count: number;
        firstMatch: {
            id: number;
            projectId: number;
            name: string;
            plans: {
                id: number;
                qty: number;
                measId: number;
                measQty: number;
            }[];
        };
        activity?: undefined;
        name?: undefined;
    }>;
    searchEps(name: string): Promise<import("../eps/eps.entity").EpsNode[]>;
    createVersion(projectId: string, body: {
        code: string;
        type: string;
        sourceVersionId?: number;
    }): Promise<import("./entities/schedule-version.entity").ScheduleVersion>;
    getVersions(projectId: string): Promise<import("./entities/schedule-version.entity").ScheduleVersion[]>;
    getVersionActivities(versionId: string): Promise<import("./entities/activity-version.entity").ActivityVersion[]>;
    updateVersionActivity(versionId: string, activityId: string, body: {
        startDate?: Date;
        finishDate?: Date;
        actualStart?: Date;
        actualFinish?: Date;
    }): Promise<import("./entities/activity-version.entity").ActivityVersion>;
    compareVersions(v1: string, v2: string): Promise<{
        activityId: number;
        wbsCode: string;
        activityCode: string;
        activityName: string;
        baseStart: Date | null | undefined;
        compareStart: Date | null;
        startVariance: number;
        baseFinish: Date | null | undefined;
        compareFinish: Date | null;
        finishVariance: number;
        baseDuration: number | undefined;
        compareDuration: number;
    }[]>;
    recalculateSchedule(versionId: string): Promise<import("./entities/activity-version.entity").ActivityVersion[] | undefined>;
    exportVersion(versionId: string, res: Response): Promise<void>;
    importRevision(projectId: string, file: Express.Multer.File, body: {
        sourceVersionId: string;
        code: string;
    }): Promise<import("./entities/schedule-version.entity").ScheduleVersion>;
    getLookAhead(body: LookAheadDto): Promise<any>;
}
