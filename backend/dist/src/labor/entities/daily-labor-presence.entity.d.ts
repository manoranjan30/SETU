import { LaborCategory } from './labor-category.entity';
export declare class DailyLaborPresence {
    id: number;
    projectId: number;
    date: string;
    categoryId: number;
    category: LaborCategory;
    count: number;
    contractorName: string;
    remarks: string;
    createdOn: Date;
    updatedOn: Date;
    updatedBy: string;
}
