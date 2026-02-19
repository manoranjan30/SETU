import { ExecutionService } from './execution.service';
import { ExecutionBreakdownService } from './execution-breakdown.service';
export declare class ExecutionController {
    private readonly service;
    private readonly breakdownService;
    constructor(service: ExecutionService, breakdownService: ExecutionBreakdownService);
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
    getExecutionBreakdown(query: {
        activityId: string;
        epsNodeId: string;
    }): Promise<import("./execution-breakdown.service").ExecutionBreakdown | {
        error: string;
        enabled: boolean;
    }>;
    hasMicroSchedule(activityId: string): Promise<{
        hasMicro: boolean;
    }>;
    saveMicroProgress(dto: any, req: any): Promise<import("../boq/entities/measurement-progress.entity").MeasurementProgress[]>;
    getPendingApprovals(projectId: string): Promise<import("../boq/entities/measurement-progress.entity").MeasurementProgress[]>;
    approveMeasurements(body: {
        logIds: number[];
    }, req: any): Promise<{
        success: boolean;
        count: number;
        message: string;
    } | {
        success: boolean;
        count: number;
        message?: undefined;
    }>;
    rejectMeasurements(body: {
        logIds: number[];
        reason: string;
    }, req: any): Promise<{
        success: boolean;
        affected: number | undefined;
    }>;
}
