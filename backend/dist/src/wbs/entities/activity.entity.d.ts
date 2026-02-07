import { WbsNode } from './wbs.entity';
import { ActivitySchedule } from './activity-schedule.entity';
export declare enum ActivityType {
    TASK = "TASK",
    MILESTONE = "MILESTONE"
}
export declare enum ActivityStatus {
    NOT_STARTED = "NOT_STARTED",
    IN_PROGRESS = "IN_PROGRESS",
    COMPLETED = "COMPLETED"
}
export declare class Activity {
    id: number;
    projectId: number;
    wbsNode: WbsNode;
    activityCode: string;
    activityName: string;
    activityType: ActivityType;
    status: ActivityStatus;
    durationPlanned: number;
    durationActual: number;
    startDatePlanned: Date | null;
    finishDatePlanned: Date | null;
    startDateBaseline: Date | null;
    finishDateBaseline: Date | null;
    startDateMSP: Date | null;
    finishDateMSP: Date | null;
    startDateActual: Date | null;
    finishDateActual: Date | null;
    isMilestone: boolean;
    percentComplete: number;
    budgetedValue: number;
    actualValue: number;
    responsibleRoleId: number;
    responsibleUserId: number;
    createdOn: Date;
    createdBy: string;
    schedule: ActivitySchedule;
    masterActivityId: number;
    masterActivity: Activity;
}
