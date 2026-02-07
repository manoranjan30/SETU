export declare class QualityAudit {
    id: number;
    projectId: number;
    auditType: string;
    auditorName: string;
    auditDate: string;
    scope: string;
    findings: string;
    nonConformancesCount: number;
    observationsCount: number;
    status: string;
    reportUrl: string;
    createdAt: Date;
    updatedAt: Date;
}
