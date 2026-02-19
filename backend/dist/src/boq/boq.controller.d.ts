import type { Response } from 'express';
import { BoqService } from './boq.service';
import { BoqImportService } from './boq-import.service';
import { CreateBoqElementDto } from './dto/create-boq-element.dto';
import { User } from '../users/user.entity';
export declare class BoqController {
    private readonly boqService;
    private readonly boqImportService;
    constructor(boqService: BoqService, boqImportService: BoqImportService);
    downloadTemplate(res: Response): Promise<void>;
    exportBoq(projectId: number, res: Response): Promise<void>;
    importBoq(projectId: number, file: Express.Multer.File, mappingStr?: string, defaultEpsIdStr?: string, hierarchyMappingStr?: string, dryRunStr?: string): Promise<{
        newCount: number;
        updateCount: number;
        errorCount: number;
        errors: string[];
        warnings: string[];
        preview: any[];
    }>;
    downloadMeasurementTemplate(res: Response): Promise<void>;
    importMeasurements(projectId: number, boqItemId: number, file: Express.Multer.File, mappingStr?: string, defaultEpsIdStr?: string, valueMapStr?: string, hierarchyMappingStr?: string, boqSubItemIdStr?: string): Promise<{
        count: number;
        message: string;
    }>;
    create(dto: CreateBoqElementDto, user: User): Promise<import("./entities/boq-item.entity").BoqItem>;
    createSubItem(body: any): Promise<import("./entities/boq-sub-item.entity").BoqSubItem>;
    updateSubItem(id: number, body: any): Promise<import("./entities/boq-sub-item.entity").BoqSubItem>;
    addMeasurement(body: any): Promise<import("./entities/measurement-element.entity").MeasurementElement>;
    addProgress(body: any): Promise<import("./entities/measurement-progress.entity").MeasurementProgress>;
    getForEps(nodeId: number): Promise<import("./entities/boq-item.entity").BoqItem[]>;
    getForProject(projectId: number): Promise<import("./entities/boq-item.entity").BoqItem[]>;
    update(id: number, updateDto: any, user: User): Promise<import("./entities/boq-item.entity").BoqItem>;
    remove(id: number, user: User): Promise<void>;
    bulkDeleteMeasurements(body: {
        ids: number[];
    }): Promise<void>;
    updateMeasurement(id: number, body: any): Promise<any>;
    bulkUpdateMeasurements(body: {
        ids: number[];
        data: any;
    }): Promise<void>;
}
