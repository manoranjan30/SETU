import { EpsNode } from '../../eps/eps.entity';
import { BoqElement } from '../../boq/entities/boq-element.entity';
import { Activity } from '../../wbs/entities/activity.entity';
export declare class ExecutionContext {
    id: number;
    projectId: number;
    epsNode: EpsNode;
    boqElement: BoqElement;
    activity: Activity;
    plannedQuantity: number;
    actualQuantity: number;
    remainingQuantity: number;
    percentComplete: number;
    status: string;
    actualStartDate: Date;
    actualFinishDate: Date;
    createdOn: Date;
    updatedOn: Date;
}
