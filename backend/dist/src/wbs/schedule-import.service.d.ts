import { Repository } from 'typeorm';
import { Activity } from './entities/activity.entity';
import { ActivityRelationship } from './entities/activity-relationship.entity';
import { WbsNode } from './entities/wbs.entity';
import { WorkCalendar } from './entities/work-calendar.entity';
import { ProjectProfile } from '../eps/project-profile.entity';
export declare class ScheduleImportService {
    private activityRepo;
    private relationshipRepo;
    private wbsRepo;
    private calendarRepo;
    private projectProfileRepo;
    constructor(activityRepo: Repository<Activity>, relationshipRepo: Repository<ActivityRelationship>, wbsRepo: Repository<WbsNode>, calendarRepo: Repository<WorkCalendar>, projectProfileRepo: Repository<ProjectProfile>);
    importMsProject(projectId: number, fileBuffer: Buffer): Promise<{
        message: string;
        preview: never[];
    }>;
    importPrimaveraP6(projectId: number, fileBuffer: Buffer): Promise<void>;
}
