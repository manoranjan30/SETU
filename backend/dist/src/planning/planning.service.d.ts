import { Repository } from 'typeorm';
import { BoqActivityPlan, PlanningBasis, MappingType } from './entities/boq-activity-plan.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';
import { BoqSubItem } from '../boq/entities/boq-sub-item.entity';
import { MeasurementElement } from '../boq/entities/measurement-element.entity';
import { MeasurementProgress } from '../boq/entities/measurement-progress.entity';
import { Activity } from '../wbs/entities/activity.entity';
import { ActivityRelationship } from '../wbs/entities/activity-relationship.entity';
import { RecoveryPlan } from './entities/recovery-plan.entity';
import { QuantityProgressRecord } from './entities/quantity-progress-record.entity';
import { WbsNode } from '../wbs/entities/wbs.entity';
import { EpsNode } from '../eps/eps.entity';
import { CpmService } from '../wbs/cpm.service';
import { AuditService } from '../audit/audit.service';
export declare class PlanningService {
    private planRepo;
    private recoveryRepo;
    private boqRepo;
    private activityRepo;
    private progressRepo;
    private subItemRepo;
    private measurementRepo;
    private measurementProgressRepo;
    private wbsRepo;
    private epsRepo;
    private relRepo;
    private cpmService;
    private readonly auditService;
    constructor(planRepo: Repository<BoqActivityPlan>, recoveryRepo: Repository<RecoveryPlan>, boqRepo: Repository<BoqItem>, activityRepo: Repository<Activity>, progressRepo: Repository<QuantityProgressRecord>, subItemRepo: Repository<BoqSubItem>, measurementRepo: Repository<MeasurementElement>, measurementProgressRepo: Repository<MeasurementProgress>, wbsRepo: Repository<WbsNode>, epsRepo: Repository<EpsNode>, relRepo: Repository<ActivityRelationship>, cpmService: CpmService, auditService: AuditService);
    unlinkBoq(boqItemId: number, boqSubItemId?: number, measurementId?: number): Promise<void>;
    distributeBoqToActivity(boqItemId: number, activityId: number, quantity: number, basis?: PlanningBasis, mappingType?: MappingType, mappingRules?: any, boqSubItemId?: number, measurementId?: number): Promise<BoqActivityPlan>;
    getProjectPlanningMatrix(projectId: number): Promise<BoqActivityPlan[]>;
    getProjectRelationships(projectId: number): Promise<ActivityRelationship[]>;
    getUnmappedBoqItems(projectId: number): Promise<any[]>;
    getActivityAllocations(activityId: number): Promise<BoqActivityPlan[]>;
    createRecoveryPlan(data: Partial<RecoveryPlan>): Promise<RecoveryPlan>;
    getRecoveryPlans(projectId: number): Promise<RecoveryPlan[]>;
    recordProgress(data: Partial<QuantityProgressRecord>): Promise<QuantityProgressRecord>;
    recalculateScheduleFromBoq(boqItemId: number): Promise<void>;
    private updateActivityProgress;
    completeActivity(activityId: number): Promise<Activity>;
    getPlanningStats(projectId: number): Promise<any>;
    getUnlinkedActivities(projectId: number): Promise<Activity[]>;
    getGapAnalysis(projectId: number): Promise<any[]>;
    distributeActivitiesToEps(activityIds: number[], targetEpsIds: number[], user: any): Promise<any>;
    repairDistributedActivities(): Promise<any>;
    undistributeActivities(activityIds: number[], targetEpsIds: number[], user: any): Promise<{
        deleted: number | null | undefined;
    }>;
    getDistributionMatrix(masterProjectId: number): Promise<Record<string, number[]>>;
    findActivitiesWithBoq(projectId: number, wbsNodeId?: number): Promise<any[]>;
    debugProjectActivities(projectId: number): Promise<{
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
    repairDistributedActivitiesV3(): Promise<any>;
    repairDistributedActivitiesV4(): Promise<any>;
    repairDistributedActivitiesV5(): Promise<any>;
    repairDistributedActivitiesV6(): Promise<any>;
    checkHierarchy(rootId: number): Promise<{
        rootId: number;
        childrenFound: number;
        hierarchy: any[];
    }>;
    searchEps(name: string): Promise<EpsNode[]>;
    listActivities(): Promise<Activity[]>;
    findActivityByName(namePartial: string): Promise<{
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
    updateActivityFinancials(activityId: number): Promise<void>;
    syncProjectFinancials(projectId: number): Promise<void>;
    updateActivitiesByBoqItem(boqItemId: number): Promise<void>;
    getLookAheadResources(projectId: number, startDate: string, endDate: string): Promise<any>;
    private calculateResourceImpact;
}
