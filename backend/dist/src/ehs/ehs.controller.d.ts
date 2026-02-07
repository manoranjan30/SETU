import { EhsService } from './ehs.service';
export declare class EhsController {
    private readonly ehsService;
    constructor(ehsService: EhsService);
    getSummary(projectId: number): Promise<{
        cumulativeSafeManhours: number;
        cumulativeManpower: number;
        incidents: {
            total: number;
            fatal: number;
            major: number;
            minor: number;
            firstAid: number;
            nearMiss: number;
            dangerous: number;
        };
        legal: {
            total: number;
            expired: number;
            expiringSoon: number;
            valid: number;
        };
        machinery: {
            total: number;
            expired: number;
            expiringSoon: number;
            valid: number;
        };
        vehicle: {
            total: number;
            expired: number;
            expiringSoon: number;
            valid: number;
        };
        competency: {
            total: number;
            expired: number;
            expiringSoon: number;
            valid: number;
        };
        inspections: {
            total: number;
            completed: number;
            pending: number;
            overdue: number;
        };
        training: {
            total: number;
            participants: number;
        };
    }>;
    getObservations(projectId: number): Promise<import("./entities/ehs-observation.entity").EhsObservation[]>;
    createObservation(projectId: number, data: any, req: any): Promise<import("./entities/ehs-observation.entity").EhsObservation[]>;
    updateObservation(id: number, data: any): Promise<import("./entities/ehs-observation.entity").EhsObservation | null>;
    getIncidents(projectId: number): Promise<import("./entities/ehs-incident.entity").EhsIncident[]>;
    createIncident(projectId: number, data: any, req: any): Promise<import("./entities/ehs-incident.entity").EhsIncident[]>;
    getEnvironmental(projectId: number): Promise<import("./entities/ehs-environmental.entity").EhsEnvironmental[]>;
    createEnvironmental(projectId: number, data: any, req: any): Promise<import("./entities/ehs-environmental.entity").EhsEnvironmental[]>;
    getTrends(projectId: number): Promise<{
        incidents: import("./entities/ehs-incident.entity").EhsIncident[];
        observations: import("./entities/ehs-observation.entity").EhsObservation[];
    }>;
    getPerformance(projectId: number): Promise<import("./entities/ehs-performance.entity").EhsPerformance[]>;
    savePerformance(projectId: number, data: any): Promise<import("./entities/ehs-performance.entity").EhsPerformance | import("./entities/ehs-performance.entity").EhsPerformance[] | null>;
    getManhours(projectId: number): Promise<import("./entities/ehs-manhours.entity").EhsManhours[]>;
    saveManhours(projectId: number, data: any): Promise<import("./entities/ehs-manhours.entity").EhsManhours | import("./entities/ehs-manhours.entity").EhsManhours[] | null>;
    getLaborStats(projectId: number, month: string): Promise<{
        totalWorkerManDays: number;
        workingDays: number;
    }>;
    getInspections(projectId: number): Promise<import("./entities/ehs-inspection.entity").EhsInspection[]>;
    createInspection(projectId: number, data: any): Promise<import("./entities/ehs-inspection.entity").EhsInspection[]>;
    updateInspection(id: number, data: any): Promise<import("./entities/ehs-inspection.entity").EhsInspection | null>;
    deleteInspection(id: number): Promise<import("typeorm").DeleteResult>;
    getTrainings(projectId: number): Promise<import("./entities/ehs-training.entity").EhsTraining[]>;
    createTraining(projectId: number, data: any, req: any): Promise<import("./entities/ehs-training.entity").EhsTraining[]>;
    updateTraining(id: number, data: any): Promise<import("./entities/ehs-training.entity").EhsTraining | null>;
    deleteTraining(id: number): Promise<import("typeorm").DeleteResult>;
    getLegal(projectId: number): Promise<import("./entities/ehs-legal-register.entity").EhsLegalRegister[]>;
    createLegal(projectId: number, data: any): Promise<import("./entities/ehs-legal-register.entity").EhsLegalRegister[]>;
    updateLegal(id: number, data: any): Promise<import("./entities/ehs-legal-register.entity").EhsLegalRegister | null>;
    deleteLegal(id: number): Promise<import("typeorm").DeleteResult>;
    getMachinery(projectId: number): Promise<import("./entities/ehs-machinery.entity").EhsMachinery[]>;
    createMachinery(projectId: number, data: any): Promise<import("./entities/ehs-machinery.entity").EhsMachinery[]>;
    updateMachinery(id: number, data: any): Promise<import("./entities/ehs-machinery.entity").EhsMachinery | null>;
    deleteMachinery(id: number): Promise<import("typeorm").DeleteResult>;
    getIncidentsRegister(projectId: number): Promise<import("./entities/ehs-incident-register.entity").EhsIncidentRegister[]>;
    createIncidentRegister(projectId: number, data: any): Promise<import("./entities/ehs-incident-register.entity").EhsIncidentRegister[]>;
    updateIncidentRegister(id: number, data: any): Promise<import("./entities/ehs-incident-register.entity").EhsIncidentRegister | null>;
    deleteIncidentRegister(id: number): Promise<import("typeorm").DeleteResult>;
    getVehicles(projectId: number): Promise<import("./entities/ehs-vehicle.entity").EhsVehicle[]>;
    createVehicle(projectId: number, data: any): Promise<import("./entities/ehs-vehicle.entity").EhsVehicle[]>;
    updateVehicle(id: number, data: any): Promise<import("./entities/ehs-vehicle.entity").EhsVehicle | null>;
    deleteVehicle(id: number): Promise<import("typeorm").DeleteResult>;
    getCompetencies(projectId: number): Promise<import("./entities/ehs-competency.entity").EhsCompetency[]>;
    createCompetency(projectId: number, data: any): Promise<import("./entities/ehs-competency.entity").EhsCompetency[]>;
    updateCompetency(id: number, data: any): Promise<import("./entities/ehs-competency.entity").EhsCompetency | null>;
    deleteCompetency(id: number): Promise<import("typeorm").DeleteResult>;
}
