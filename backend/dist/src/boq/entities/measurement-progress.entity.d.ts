import { MeasurementElement } from './measurement-element.entity';
export declare class MeasurementProgress {
    id: number;
    measurementElement: MeasurementElement;
    measurementElementId: number;
    executedQty: number;
    date: Date;
    updatedBy: string;
    customAttributes: any;
    status: string;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    rejectionReason: string;
    loggedOn: Date;
}
