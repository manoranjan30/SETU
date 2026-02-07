import { Activity } from './activity.entity';
export declare class ActivitySchedule {
    id: number;
    activityId: number;
    activity: Activity;
    earlyStart: Date;
    earlyFinish: Date;
    lateStart: Date;
    lateFinish: Date;
    totalFloat: number;
    freeFloat: number;
    isCritical: boolean;
    calculatedOn: Date;
    createdOn: Date;
    updatedOn: Date;
}
