import { Repository } from 'typeorm';
import { LaborCategory } from './entities/labor-category.entity';
import { DailyLaborPresence } from './entities/daily-labor-presence.entity';
import { ActivityLaborUpdate } from './entities/activity-labor-update.entity';
import { LaborExcelMapping } from './entities/labor-excel-mapping.entity';
export declare class LaborService {
    private categoryRepo;
    private presenceRepo;
    private activityLaborRepo;
    private mappingRepo;
    private readonly logger;
    constructor(categoryRepo: Repository<LaborCategory>, presenceRepo: Repository<DailyLaborPresence>, activityLaborRepo: Repository<ActivityLaborUpdate>, mappingRepo: Repository<LaborExcelMapping>);
    getCategories(projectId?: number): Promise<LaborCategory[]>;
    saveCategories(categories: Partial<LaborCategory>[]): Promise<(Partial<LaborCategory> & LaborCategory)[]>;
    getDailyPresence(projectId: number, date?: string): Promise<DailyLaborPresence[]>;
    saveDailyPresence(projectId: number, entries: any[], userId: number): Promise<any[]>;
    getActivityLabor(activityId: number): Promise<ActivityLaborUpdate[]>;
    saveActivityLabor(entries: any[], userId: number): Promise<any[]>;
    getAllocationsByProject(projectId: number, date?: string): Promise<ActivityLaborUpdate[]>;
    getMappings(projectId: number): Promise<LaborExcelMapping[]>;
    saveMapping(mapping: Partial<LaborExcelMapping>): Promise<Partial<LaborExcelMapping> & LaborExcelMapping>;
    importLaborData(projectId: number, data: any[], mappingId: number, userId: number): Promise<any[]>;
}
