import { Repository } from 'typeorm';
import { EhsObservation } from './entities/ehs-observation.entity';
import { EhsIncident } from './entities/ehs-incident.entity';
import { EhsEnvironmental } from './entities/ehs-environmental.entity';
import { EhsTraining } from './entities/ehs-training.entity';
import { EhsProjectConfig } from './entities/ehs-project-config.entity';
import { DailyLaborPresence } from '../labor/entities/daily-labor-presence.entity';
import { EhsPerformance } from './entities/ehs-performance.entity';
import { EhsManhours } from './entities/ehs-manhours.entity';
import { EhsInspection } from './entities/ehs-inspection.entity';
import { EhsLegalRegister } from './entities/ehs-legal-register.entity';
import { EhsMachinery } from './entities/ehs-machinery.entity';
import { EhsIncidentRegister } from './entities/ehs-incident-register.entity';
import { EhsVehicle } from './entities/ehs-vehicle.entity';
import { EhsCompetency } from './entities/ehs-competency.entity';
export declare class EhsService {
    private readonly observationRepo;
    private readonly incidentRepo;
    private readonly environmentalRepo;
    private readonly trainingRepo;
    private readonly configRepo;
    private readonly laborRepo;
    private readonly performanceRepo;
    private readonly manhoursRepo;
    private readonly inspectionRepo;
    private readonly legalRepo;
    private readonly machineryRepo;
    private readonly incidentRegisterRepo;
    private readonly vehicleRepo;
    private readonly competencyRepo;
    constructor(observationRepo: Repository<EhsObservation>, incidentRepo: Repository<EhsIncident>, environmentalRepo: Repository<EhsEnvironmental>, trainingRepo: Repository<EhsTraining>, configRepo: Repository<EhsProjectConfig>, laborRepo: Repository<DailyLaborPresence>, performanceRepo: Repository<EhsPerformance>, manhoursRepo: Repository<EhsManhours>, inspectionRepo: Repository<EhsInspection>, legalRepo: Repository<EhsLegalRegister>, machineryRepo: Repository<EhsMachinery>, incidentRegisterRepo: Repository<EhsIncidentRegister>, vehicleRepo: Repository<EhsVehicle>, competencyRepo: Repository<EhsCompetency>);
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
    getObservations(projectId: number): Promise<EhsObservation[]>;
    createObservation(data: any): Promise<EhsObservation[]>;
    updateObservation(id: number, data: any): Promise<EhsObservation | null>;
    getIncidents(projectId: number): Promise<EhsIncident[]>;
    createIncident(data: any): Promise<EhsIncident[]>;
    getEnvironmentalLogs(projectId: number): Promise<EhsEnvironmental[]>;
    createEnvironmentalLog(data: any): Promise<EhsEnvironmental[]>;
    getTrends(projectId: number): Promise<{
        incidents: EhsIncident[];
        observations: EhsObservation[];
    }>;
    getPerformance(projectId: number): Promise<EhsPerformance[]>;
    savePerformance(projectId: number, data: any): Promise<EhsPerformance | EhsPerformance[] | null>;
    getManhours(projectId: number): Promise<EhsManhours[]>;
    saveManhours(projectId: number, data: any): Promise<EhsManhours | EhsManhours[] | null>;
    getMonthlyLaborStats(projectId: number, month: string): Promise<{
        totalWorkerManDays: number;
        workingDays: number;
    }>;
    getInspections(projectId: number): Promise<EhsInspection[]>;
    createInspection(data: any): Promise<EhsInspection[]>;
    updateInspection(id: number, data: any): Promise<EhsInspection | null>;
    deleteInspection(id: number): Promise<import("typeorm").DeleteResult>;
    getTrainings(projectId: number): Promise<EhsTraining[]>;
    createTraining(data: any): Promise<EhsTraining[]>;
    updateTraining(id: number, data: any): Promise<EhsTraining | null>;
    deleteTraining(id: number): Promise<import("typeorm").DeleteResult>;
    getLegal(projectId: number): Promise<EhsLegalRegister[]>;
    createLegal(data: any): Promise<EhsLegalRegister[]>;
    updateLegal(id: number, data: any): Promise<EhsLegalRegister | null>;
    deleteLegal(id: number): Promise<import("typeorm").DeleteResult>;
    getMachinery(projectId: number): Promise<EhsMachinery[]>;
    createMachinery(data: any): Promise<EhsMachinery[]>;
    updateMachinery(id: number, data: any): Promise<EhsMachinery | null>;
    deleteMachinery(id: number): Promise<import("typeorm").DeleteResult>;
    getIncidentsRegister(projectId: number): Promise<EhsIncidentRegister[]>;
    createIncidentRegister(data: any): Promise<EhsIncidentRegister[]>;
    updateIncidentRegister(id: number, data: any): Promise<EhsIncidentRegister | null>;
    deleteIncidentRegister(id: number): Promise<import("typeorm").DeleteResult>;
    getVehicles(projectId: number): Promise<EhsVehicle[]>;
    createVehicle(data: any): Promise<EhsVehicle[]>;
    updateVehicle(id: number, data: any): Promise<EhsVehicle | null>;
    deleteVehicle(id: number): Promise<import("typeorm").DeleteResult>;
    getCompetencies(projectId: number): Promise<EhsCompetency[]>;
    createCompetency(data: any): Promise<EhsCompetency[]>;
    updateCompetency(id: number, data: any): Promise<EhsCompetency | null>;
    deleteCompetency(id: number): Promise<import("typeorm").DeleteResult>;
}
