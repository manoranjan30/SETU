import { AnalysisCoefficient } from './analysis-coefficient.entity';
export declare enum AnalysisStatus {
    DRAFT = "DRAFT",
    ACTIVE = "ACTIVE",
    ARCHIVED = "ARCHIVED"
}
export declare class AnalysisTemplate {
    id: number;
    templateCode: string;
    description: string;
    outputUom: string;
    status: AnalysisStatus;
    coefficients: AnalysisCoefficient[];
    createdOn: Date;
    updatedOn: Date;
}
