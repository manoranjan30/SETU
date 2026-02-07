import { MeasurementElement } from './measurement-element.entity';
export declare class MeasurementProgress {
    id: number;
    measurementElement: MeasurementElement;
    measurementElementId: number;
    executedQty: number;
    date: Date;
    updatedBy: string;
    customAttributes: any;
    loggedOn: Date;
}
