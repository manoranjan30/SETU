import { BoqItem } from '../../boq/entities/boq-item.entity';
import { Activity } from '../../wbs/entities/activity.entity';
import { MeasurementElement } from '../../boq/entities/measurement-element.entity';
export declare enum PlanningBasis {
    INITIAL = "INITIAL",
    LOOKAHEAD = "LOOKAHEAD",
    RECOVERY = "RECOVERY"
}
export declare enum MappingType {
    DIRECT = "DIRECT",
    PROPORTION = "PROPORTION",
    PHASED = "PHASED"
}
export declare class BoqActivityPlan {
    id: number;
    projectId: number;
    boqItem: BoqItem;
    boqItemId: number;
    activity: Activity;
    activityId: number;
    boqSubItemId: number;
    measurement: MeasurementElement;
    measurementId: number;
    plannedQuantity: number;
    planningBasis: PlanningBasis;
    mappingType: MappingType;
    mappingRules: any;
    plannedStart: Date | null;
    plannedFinish: Date | null;
    createdOn: Date;
    updatedOn: Date;
    createdBy: string;
}
