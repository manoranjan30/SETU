import { Repository } from 'typeorm';
import { BoqItem } from './entities/boq-item.entity';
import { BoqSubItem } from './entities/boq-sub-item.entity';
import { EpsNode } from '../eps/eps.entity';
import { MeasurementElement } from './entities/measurement-element.entity';
export declare class BoqImportService {
    private readonly boqItemRepo;
    private readonly epsRepo;
    private readonly measurementRepo;
    private readonly boqSubItemRepo;
    constructor(boqItemRepo: Repository<BoqItem>, epsRepo: Repository<EpsNode>, measurementRepo: Repository<MeasurementElement>, boqSubItemRepo: Repository<BoqSubItem>);
    getMeasurementTemplate(): Buffer;
    importMeasurements(projectId: number, boqItemId: number, fileBuffer: Buffer, mapping?: any, defaultEpsId?: number, valueMap?: Record<string, number | string>, hierarchyMapping?: any, boqSubItemId?: number): Promise<number>;
    getTemplateBuffer(): Buffer;
    importBoq(projectId: number, fileBuffer: Buffer, mapping?: any, defaultEpsId?: number, hierarchyMapping?: any): Promise<number>;
    private resolveEpsPath;
    private tryParseJson;
}
