import { ActivityVersion } from './activity-version.entity';
export declare enum ScheduleVersionType {
    BASELINE = "BASELINE",
    REVISED = "REVISED",
    WORKING = "WORKING"
}
export declare class ScheduleVersion {
    id: number;
    projectId: number;
    versionCode: string;
    versionType: ScheduleVersionType;
    sequenceNumber: number;
    parentVersionId: number | null;
    parentVersion?: ScheduleVersion;
    isActive: boolean;
    isLocked: boolean;
    remarks: string;
    createdBy: string;
    createdOn: Date;
    updatedOn: Date;
    activityVersions: ActivityVersion[];
}
