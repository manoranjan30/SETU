import { EpsNode } from '../../eps/eps.entity';
import { MeasurementElement } from './measurement-element.entity';
import { BoqSubItem } from './boq-sub-item.entity';
export declare enum BoqQtyMode {
    MANUAL = "MANUAL",
    DERIVED = "DERIVED"
}
export declare class BoqItem {
    id: number;
    projectId: number;
    boqCode: string;
    description: string;
    uom: string;
    longDescription: string;
    epsNode: EpsNode;
    epsNodeId: number | null;
    qtyMode: BoqQtyMode;
    qty: number;
    rate: number;
    consumedQty: number;
    amount: number;
    status: string;
    customAttributes: any;
    subItems: BoqSubItem[];
    measurements: MeasurementElement[];
    createdOn: Date;
    updatedOn: Date;
    analysisTemplateId: number;
    analysisTemplate: any;
}
