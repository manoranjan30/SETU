import { Activity } from '../../wbs/entities/activity.entity';
export declare class RecoveryPlan {
    id: number;
    projectId: number;
    activity: Activity;
    activityId: number;
    reasonForDelay: string;
    recoveryStrategy: string;
    revisedDuration: number;
    targetFinish: Date;
    additionalResourcesRequired: string;
    status: string;
    createdOn: Date;
    updatedOn: Date;
    createdBy: string;
}
