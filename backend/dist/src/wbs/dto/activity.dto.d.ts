import { ActivityType, ActivityStatus } from '../entities/activity.entity';
export declare class CreateActivityDto {
    activityCode: string;
    activityName: string;
    activityType: ActivityType;
    responsibleRoleId?: number;
    responsibleUserId?: number;
}
export declare class UpdateActivityDto {
    activityName?: string;
    activityType?: ActivityType;
    status?: ActivityStatus;
    responsibleRoleId?: number;
    responsibleUserId?: number;
}
