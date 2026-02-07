import { ExecutionService } from './execution.service';
export declare class ExecutionController {
    private readonly service;
    constructor(service: ExecutionService);
    saveMeasurements(projectId: string, body: {
        entries: any[];
    }, req: any): Promise<import("../boq/entities/measurement-progress.entity").MeasurementProgress[]>;
    getLogs(projectId: string): Promise<import("../boq/entities/measurement-progress.entity").MeasurementProgress[]>;
    updateLog(logId: string, body: {
        newQty: number;
    }, req: any): Promise<import("../boq/entities/measurement-progress.entity").MeasurementProgress>;
    deleteLog(logId: string): Promise<{
        success: boolean;
    }>;
}
