import type { Response } from 'express';
import { ResourcesService } from './resources.service';
import { ResourceMaster } from './entities/resource-master.entity';
import { AnalysisTemplate } from './entities/analysis-template.entity';
export declare class ResourcesController {
    private readonly resourcesService;
    constructor(resourcesService: ResourcesService);
    getResources(): Promise<ResourceMaster[]>;
    createResource(body: Partial<ResourceMaster>): Promise<ResourceMaster>;
    updateResource(id: number, body: Partial<ResourceMaster>): Promise<ResourceMaster | null>;
    deleteResource(id: number): Promise<import("typeorm").DeleteResult>;
    getTemplateFile(res: Response): Promise<Response<any, Record<string, any>>>;
    importResources(file: Express.Multer.File, mappingStr: string): Promise<{
        imported: number;
        errors: any[];
    }>;
    getTemplates(): Promise<AnalysisTemplate[]>;
    getTemplate(id: number): Promise<AnalysisTemplate>;
    createTemplate(body: Partial<AnalysisTemplate>): Promise<AnalysisTemplate>;
    updateTemplate(id: number, body: Partial<AnalysisTemplate>): Promise<AnalysisTemplate>;
    deleteTemplate(id: string): Promise<import("typeorm").DeleteResult>;
    suggestMappings(body: {
        items: {
            boqItemId: number;
            description: string;
        }[];
    }): Promise<any[]>;
    getProjectTotals(projectId: string): Promise<{
        aggregated: {
            resourceCode: string;
            resourceName: string;
            uom: string;
            totalQty: number;
            standardRate: number;
            totalAmount: number;
            type: string;
        }[];
        boqBreakdown: {
            resources: {
                resourceCode: string;
                resourceName: string;
                uom: string;
                totalQty: number;
                standardRate: number;
                totalAmount: number;
                type: string;
            }[];
            id: number;
            boqCode: string;
            description: string;
            totalAmount: number;
        }[];
        typeTotals: {
            MATERIAL: number;
            LABOR: number;
            PLANT: number;
            SUBCONTRACT: number;
            OTHER: number;
        };
    }>;
}
