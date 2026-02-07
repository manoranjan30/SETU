import { Repository } from 'typeorm';
import { ResourceMaster } from './entities/resource-master.entity';
import { AnalysisTemplate } from './entities/analysis-template.entity';
import { AnalysisCoefficient } from './entities/analysis-coefficient.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';
export declare class ResourcesService {
    private resourceRepo;
    private templateRepo;
    private coefficientRepo;
    private boqItemRepo;
    constructor(resourceRepo: Repository<ResourceMaster>, templateRepo: Repository<AnalysisTemplate>, coefficientRepo: Repository<AnalysisCoefficient>, boqItemRepo: Repository<BoqItem>);
    private generateNextResourceCode;
    private generateNextTemplateCode;
    findAllResources(): Promise<ResourceMaster[]>;
    createResource(data: Partial<ResourceMaster>): Promise<ResourceMaster>;
    updateResource(id: number, data: Partial<ResourceMaster>): Promise<ResourceMaster | null>;
    deleteResource(id: number): Promise<import("typeorm").DeleteResult>;
    findAllTemplates(): Promise<AnalysisTemplate[]>;
    findTemplateById(id: number): Promise<AnalysisTemplate>;
    createTemplate(data: Partial<AnalysisTemplate>): Promise<AnalysisTemplate>;
    updateTemplate(id: number, data: Partial<AnalysisTemplate>): Promise<AnalysisTemplate>;
    deleteTemplate(id: number): Promise<import("typeorm").DeleteResult>;
    suggestMappings(items: {
        boqItemId: number;
        description: string;
    }[]): Promise<any[]>;
    private tokenize;
    private calculateJaccardIndex;
    calculateProjectResources(projectId: number): Promise<{
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
    getResourceTemplate(): Promise<string>;
    private mapResourceType;
    importResources(file: any, mapping: any): Promise<{
        imported: number;
        errors: any[];
    }>;
}
