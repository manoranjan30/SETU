import { ScheduleVersion } from './schedule-version.entity';
import { Activity } from '../../wbs/entities/activity.entity';
export declare class ActivityVersion {
    id: number;
    versionId: number;
    scheduleVersion: ScheduleVersion;
    activityId: number;
    activity: Activity;
    startDate: Date | null;
    finishDate: Date | null;
    duration: number;
    isCritical: boolean;
    totalFloat: number;
    freeFloat: number;
    remarks: string;
}
