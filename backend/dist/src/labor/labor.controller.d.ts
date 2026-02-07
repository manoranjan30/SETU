import { LaborService } from './labor.service';
export declare class LaborController {
    private readonly laborService;
    constructor(laborService: LaborService);
    getCategories(projectId?: string): Promise<import("./entities/labor-category.entity").LaborCategory[]>;
    saveCategories(categories: any[]): Promise<(Partial<import("./entities/labor-category.entity").LaborCategory> & import("./entities/labor-category.entity").LaborCategory)[]>;
    getDailyPresence(projectId: string, date?: string): Promise<import("./entities/daily-labor-presence.entity").DailyLaborPresence[]>;
    saveDailyPresence(projectId: string, body: {
        entries: any[];
        userId: number;
    }): Promise<any[]>;
    getActivityLabor(activityId: string): Promise<import("./entities/activity-labor-update.entity").ActivityLaborUpdate[]>;
    getAllocationsByProject(projectId: string, date?: string): Promise<import("./entities/activity-labor-update.entity").ActivityLaborUpdate[]>;
    saveActivityLabor(body: {
        entries: any[];
        userId: number;
    }): Promise<any[]>;
    getMappings(projectId: string): Promise<import("./entities/labor-excel-mapping.entity").LaborExcelMapping[]>;
    saveMapping(mapping: any): Promise<Partial<import("./entities/labor-excel-mapping.entity").LaborExcelMapping> & import("./entities/labor-excel-mapping.entity").LaborExcelMapping>;
    importData(projectId: string, body: {
        data: any[];
        mappingId: number;
        userId: number;
    }): Promise<any[]>;
}
