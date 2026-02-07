import { EpsNode } from '../../eps/eps.entity';
export declare class BoqElement {
    id: number;
    projectId: number;
    epsNode: EpsNode;
    boqCode: string;
    boqName: string;
    unitOfMeasure: string;
    totalQuantity: number;
    consumedQuantity: number;
    geometryRefId: string;
}
