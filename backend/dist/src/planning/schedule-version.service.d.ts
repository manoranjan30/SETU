import { Repository, DataSource } from 'typeorm';
import { ScheduleVersion, ScheduleVersionType } from './entities/schedule-version.entity';
import { ActivityVersion } from './entities/activity-version.entity';
import { Activity } from '../wbs/entities/activity.entity';
import { ActivityRelationship } from '../wbs/entities/activity-relationship.entity';
import { SchedulingEngineService } from './scheduling-engine.service';
export declare class ScheduleVersionService {
    private versionRepo;
    private activityVersionRepo;
    private activityRepo;
    private relRepo;
    private dataSource;
    private engine;
    constructor(versionRepo: Repository<ScheduleVersion>, activityVersionRepo: Repository<ActivityVersion>, activityRepo: Repository<Activity>, relRepo: Repository<ActivityRelationship>, dataSource: DataSource, engine: SchedulingEngineService);
    getVersions(projectId: number): Promise<ScheduleVersion[]>;
    createVersion(projectId: number, code: string, type: ScheduleVersionType, sourceVersionId?: number, user?: string): Promise<ScheduleVersion>;
    getVersionActivities(versionId: number): Promise<ActivityVersion[]>;
    updateActivityDate(versionId: number, activityId: number, start?: Date, finish?: Date, actualStart?: Date, actualFinish?: Date): Promise<ActivityVersion>;
    deleteVersion(projectId: number, versionId: number): Promise<ScheduleVersion>;
    recalculateSchedule(versionId: number): Promise<ActivityVersion[] | undefined>;
    createRevisionWithUpdates(projectId: number, sourceVersionId: number, updates: any[], codeInput: string): Promise<ScheduleVersion>;
    compareVersions(baseVersionId: number, compareVersionId: number): Promise<{
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
}
