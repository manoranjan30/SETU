import { Repository, DataSource } from 'typeorm';
import { Activity } from './entities/activity.entity';
import { ActivityRelationship } from './entities/activity-relationship.entity';
import { ActivitySchedule } from './entities/activity-schedule.entity';
import { WbsNode } from './entities/wbs.entity';
import { ProjectProfile } from '../eps/project-profile.entity';
import { WorkCalendar } from './entities/work-calendar.entity';
import { WorkWeek } from './entities/work-week.entity';
export declare class CpmService {
    private activityRepo;
    private scheduleRepo;
    private relationshipRepo;
    private wbsRepo;
    private projectProfileRepo;
    private calendarRepo;
    private workWeekRepo;
    private dataSource;
    private readonly logger;
    constructor(activityRepo: Repository<Activity>, scheduleRepo: Repository<ActivitySchedule>, relationshipRepo: Repository<ActivityRelationship>, wbsRepo: Repository<WbsNode>, projectProfileRepo: Repository<ProjectProfile>, calendarRepo: Repository<WorkCalendar>, workWeekRepo: Repository<WorkWeek>, dataSource: DataSource);
    calculateSchedule(projectId: number): Promise<void>;
    private buildGraph;
    private normalizeDate;
    private getProjectCalendar;
    private isWorkingDay;
    private addWorkingDays;
    private getWorkingDuration;
    private calculateDates;
    private saveSchedule;
    triggerWbsRollup(projectId: number): Promise<void>;
    private calculateSummaryRollup;
    repairDurations(projectId: number): Promise<void>;
    rescheduleProject(projectId: number): Promise<void>;
    getProjectSchedule(projectId: number): Promise<{
        activities: Activity[];
        relationships: ActivityRelationship[];
    }>;
}
