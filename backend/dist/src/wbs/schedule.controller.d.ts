import { CpmService } from './cpm.service';
import { ScheduleImportService } from './schedule-import.service';
export declare class ScheduleController {
    private readonly cpmService;
    private readonly importService;
    constructor(cpmService: CpmService, importService: ScheduleImportService);
    getSchedule(projectId: number): Promise<{
        activities: import("./entities/activity.entity").Activity[];
        relationships: import("./entities/activity-relationship.entity").ActivityRelationship[];
    }>;
    calculate(projectId: number): Promise<{
        message: string;
    }>;
    repairDurations(projectId: number): Promise<{
        message: string;
    }>;
    reschedule(projectId: number): Promise<{
        message: string;
    }>;
    importSchedule(projectId: number, file: Express.Multer.File): Promise<{
        message: string;
        preview: never[];
    } | {
        message: string;
    }>;
}
