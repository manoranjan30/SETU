import { WbsService } from './wbs.service';
import { WbsImportService } from './wbs-import.service';
import { CreateWbsDto, UpdateWbsDto, ReorderWbsDto } from './dto/wbs.dto';
import { CreateActivityDto, UpdateActivityDto } from './dto/activity.dto';
export declare class WbsController {
    private readonly wbsService;
    private readonly importService;
    constructor(wbsService: WbsService, importService: WbsImportService);
    create(projectId: string, dto: CreateWbsDto, req: any): Promise<import("./entities/wbs.entity").WbsNode>;
    findAll(projectId: string): Promise<import("./entities/wbs.entity").WbsNode[]>;
    getAllActivities(projectId: string): Promise<import("./entities/activity.entity").Activity[]>;
    findOne(projectId: string, id: string): Promise<import("./entities/wbs.entity").WbsNode>;
    update(projectId: string, id: string, dto: UpdateWbsDto): Promise<import("./entities/wbs.entity").WbsNode>;
    reorder(projectId: string, id: string, dto: ReorderWbsDto): Promise<import("./entities/wbs.entity").WbsNode>;
    remove(projectId: string, id: string): Promise<void>;
    createActivity(projectId: string, nodeId: string, dto: CreateActivityDto, req: any): Promise<import("./entities/activity.entity").Activity>;
    getActivities(projectId: string, nodeId: string): Promise<import("./entities/activity.entity").Activity[]>;
    updateActivity(activityId: string, dto: UpdateActivityDto): Promise<import("./entities/activity.entity").Activity>;
    deleteActivity(activityId: string): Promise<void>;
    applyTemplate(projectId: string, templateId: string, req: any): Promise<void>;
    saveAsTemplate(projectId: string, body: {
        templateName: string;
        description?: string;
    }): Promise<import("./entities/wbs-template.entity").WbsTemplate>;
    previewImport(file: Express.Multer.File): Promise<{
        data: any[];
        validation: {
            isValid: boolean;
            errors: string[];
        };
    }>;
    commitImport(projectId: string, body: {
        data: any[];
    }, req: any): Promise<void>;
}
