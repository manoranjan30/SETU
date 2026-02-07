import { BoqItem } from '../../boq/entities/boq-item.entity';
export declare enum ProgressStatus {
    DRAFT = "DRAFT",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED"
}
export declare class QuantityProgressRecord {
    id: number;
    projectId: number;
    boqItem: BoqItem;
    boqItemId: number;
    measuredQty: number;
    totalToDate: number;
    measureDate: Date;
    status: ProgressStatus;
    locationId: string;
    remarks: string;
    createdOn: Date;
    updatedOn: Date;
    createdBy: string;
    approvedBy: string;
    approvedDate: Date;
}
