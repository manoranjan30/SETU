export declare enum ExecutionStatus {
    NOT_STARTED = "NOT_STARTED",
    IN_PROGRESS = "IN_PROGRESS",
    COMPLETED = "COMPLETED"
}
export declare class UpdateProgressDto {
    actualQuantity: number;
    date?: string;
    status?: ExecutionStatus;
}
