import { BoqItem } from './boq-item.entity';
import { MeasurementElement } from './measurement-element.entity';
export declare class BoqSubItem {
    id: number;
    boqItemId: number;
    boqItem: BoqItem;
    description: string;
    uom: string;
    rate: number;
    qty: number;
    executedQty: number;
    amount: number;
    measurements: MeasurementElement[];
    analysisTemplateId: number;
    analysisTemplate: any;
    createdOn: Date;
    updatedOn: Date;
}
