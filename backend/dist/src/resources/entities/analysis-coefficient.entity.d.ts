import { AnalysisTemplate } from './analysis-template.entity';
import { ResourceMaster } from './resource-master.entity';
export declare class AnalysisCoefficient {
    id: number;
    templateId: number;
    template: AnalysisTemplate;
    resourceId: number;
    resource: ResourceMaster;
    coefficient: number;
    remarks: string;
}
