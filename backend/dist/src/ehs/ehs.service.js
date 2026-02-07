"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EhsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ehs_observation_entity_1 = require("./entities/ehs-observation.entity");
const ehs_incident_entity_1 = require("./entities/ehs-incident.entity");
const ehs_environmental_entity_1 = require("./entities/ehs-environmental.entity");
const ehs_training_entity_1 = require("./entities/ehs-training.entity");
const ehs_project_config_entity_1 = require("./entities/ehs-project-config.entity");
const daily_labor_presence_entity_1 = require("../labor/entities/daily-labor-presence.entity");
const ehs_performance_entity_1 = require("./entities/ehs-performance.entity");
const ehs_manhours_entity_1 = require("./entities/ehs-manhours.entity");
const ehs_inspection_entity_1 = require("./entities/ehs-inspection.entity");
const ehs_legal_register_entity_1 = require("./entities/ehs-legal-register.entity");
const ehs_machinery_entity_1 = require("./entities/ehs-machinery.entity");
const ehs_incident_register_entity_1 = require("./entities/ehs-incident-register.entity");
const ehs_vehicle_entity_1 = require("./entities/ehs-vehicle.entity");
const ehs_competency_entity_1 = require("./entities/ehs-competency.entity");
let EhsService = class EhsService {
    observationRepo;
    incidentRepo;
    environmentalRepo;
    trainingRepo;
    configRepo;
    laborRepo;
    performanceRepo;
    manhoursRepo;
    inspectionRepo;
    legalRepo;
    machineryRepo;
    incidentRegisterRepo;
    vehicleRepo;
    competencyRepo;
    constructor(observationRepo, incidentRepo, environmentalRepo, trainingRepo, configRepo, laborRepo, performanceRepo, manhoursRepo, inspectionRepo, legalRepo, machineryRepo, incidentRegisterRepo, vehicleRepo, competencyRepo) {
        this.observationRepo = observationRepo;
        this.incidentRepo = incidentRepo;
        this.environmentalRepo = environmentalRepo;
        this.trainingRepo = trainingRepo;
        this.configRepo = configRepo;
        this.laborRepo = laborRepo;
        this.performanceRepo = performanceRepo;
        this.manhoursRepo = manhoursRepo;
        this.inspectionRepo = inspectionRepo;
        this.legalRepo = legalRepo;
        this.machineryRepo = machineryRepo;
        this.incidentRegisterRepo = incidentRegisterRepo;
        this.vehicleRepo = vehicleRepo;
        this.competencyRepo = competencyRepo;
    }
    async getSummary(projectId) {
        const today = new Date();
        const next30Days = new Date();
        next30Days.setDate(today.getDate() + 30);
        const manhoursRecords = await this.manhoursRepo.find({
            where: { projectId },
        });
        const cumulativeSafeManhours = manhoursRecords.reduce((sum, rec) => sum + Number(rec.safeManhours), 0);
        const cumulativeManpower = manhoursRecords.reduce((sum, rec) => sum + Number(rec.totalManpower), 0);
        const incidents = await this.incidentRegisterRepo.find({
            where: { projectId },
        });
        const incidentStats = {
            total: incidents.length,
            fatal: incidents.filter((i) => i.incidentType === 'Fatal').length,
            major: incidents.filter((i) => i.incidentType === 'Major').length,
            minor: incidents.filter((i) => i.incidentType === 'Minor').length,
            firstAid: incidents.filter((i) => i.incidentType === 'First Aid').length,
            nearMiss: incidents.filter((i) => i.incidentType === 'Near Miss').length,
            dangerous: incidents.filter((i) => i.incidentType === 'Dangerous Occurrence').length,
        };
        const legal = await this.legalRepo.find({ where: { projectId } });
        const legalStats = {
            total: legal.length,
            expired: legal.filter((i) => i.expiryDate && new Date(i.expiryDate) < today).length,
            expiringSoon: legal.filter((i) => i.expiryDate &&
                new Date(i.expiryDate) >= today &&
                new Date(i.expiryDate) <= next30Days).length,
            valid: 0,
        };
        legalStats.valid =
            legalStats.total - legalStats.expired - legalStats.expiringSoon;
        const machinery = await this.machineryRepo.find({ where: { projectId } });
        const machineryStats = {
            total: machinery.length,
            expired: machinery.filter((i) => i.expiryDate && new Date(i.expiryDate) < today).length,
            expiringSoon: machinery.filter((i) => i.expiryDate &&
                new Date(i.expiryDate) >= today &&
                new Date(i.expiryDate) <= next30Days).length,
            valid: 0,
        };
        machineryStats.valid =
            machineryStats.total -
                machineryStats.expired -
                machineryStats.expiringSoon;
        const vehicles = await this.vehicleRepo.find({ where: { projectId } });
        let vehicleExpired = 0;
        let vehicleExpiringSoon = 0;
        vehicles.forEach((v) => {
            const certs = [v.fitnessCertDate, v.insuranceDate, v.pollutionDate].map((d) => (d ? new Date(d) : null));
            if (certs.some((d) => d && d < today)) {
                vehicleExpired++;
            }
            else if (certs.some((d) => d && d <= next30Days)) {
                vehicleExpiringSoon++;
            }
        });
        const vehicleStats = {
            total: vehicles.length,
            expired: vehicleExpired,
            expiringSoon: vehicleExpiringSoon,
            valid: vehicles.length - vehicleExpired - vehicleExpiringSoon,
        };
        const competency = await this.competencyRepo.find({ where: { projectId } });
        let compExpired = 0;
        let compExpiringSoon = 0;
        competency.forEach((c) => {
            const certs = [c.licenseExpiry, c.fitnessExpiry].map((d) => d ? new Date(d) : null);
            if (certs.some((d) => d && d < today)) {
                compExpired++;
            }
            else if (certs.some((d) => d && d <= next30Days)) {
                compExpiringSoon++;
            }
        });
        const competencyStats = {
            total: competency.length,
            expired: compExpired,
            expiringSoon: compExpiringSoon,
            valid: competency.length - compExpired - compExpiringSoon,
        };
        const inspections = await this.inspectionRepo.find({
            where: { projectId },
        });
        const inspectionStats = {
            total: inspections.length,
            completed: inspections.filter((i) => i.status === 'Completed').length,
            pending: inspections.filter((i) => i.status === 'Pending').length,
            overdue: inspections.filter((i) => i.status === 'Pending' && i.dueDate && new Date(i.dueDate) < today).length,
        };
        const trainings = await this.trainingRepo.find({ where: { projectId } });
        const trainingStats = {
            total: trainings.length,
            participants: trainings.reduce((sum, t) => sum + Number(t.attendeeCount || 0), 0),
        };
        return {
            cumulativeSafeManhours,
            cumulativeManpower,
            incidents: incidentStats,
            legal: legalStats,
            machinery: machineryStats,
            vehicle: vehicleStats,
            competency: competencyStats,
            inspections: inspectionStats,
            training: trainingStats,
        };
    }
    async getObservations(projectId) {
        return this.observationRepo.find({
            where: { projectId },
            relations: ['reportedBy', 'assignedTo'],
            order: { date: 'DESC' },
        });
    }
    async createObservation(data) {
        const observation = this.observationRepo.create(data);
        return this.observationRepo.save(observation);
    }
    async updateObservation(id, data) {
        await this.observationRepo.update(id, data);
        return this.observationRepo.findOne({ where: { id } });
    }
    async getIncidents(projectId) {
        return this.incidentRepo.find({
            where: { projectId },
            order: { incidentDate: 'DESC' },
        });
    }
    async createIncident(data) {
        const incident = this.incidentRepo.create(data);
        return this.incidentRepo.save(incident);
    }
    async getEnvironmentalLogs(projectId) {
        return this.environmentalRepo.find({
            where: { projectId },
            order: { date: 'DESC' },
        });
    }
    async createEnvironmentalLog(data) {
        const log = this.environmentalRepo.create(data);
        return this.environmentalRepo.save(log);
    }
    async getTrends(projectId) {
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
        const incidents = await this.incidentRepo.find({
            where: {
                projectId,
                incidentDate: (0, typeorm_2.MoreThanOrEqual)(twelveMonthsAgo.toISOString().split('T')[0]),
            },
        });
        const observations = await this.observationRepo.find({
            where: {
                projectId,
                date: (0, typeorm_2.MoreThanOrEqual)(twelveMonthsAgo.toISOString().split('T')[0]),
            },
        });
        return {
            incidents,
            observations,
        };
    }
    async getPerformance(projectId) {
        return this.performanceRepo.find({
            where: { projectId },
            order: { month: 'DESC' },
        });
    }
    async savePerformance(projectId, data) {
        const existing = await this.performanceRepo.findOne({
            where: { projectId, month: data.month },
        });
        if (existing) {
            await this.performanceRepo.update(existing.id, data);
            return this.performanceRepo.findOne({ where: { id: existing.id } });
        }
        else {
            const perf = this.performanceRepo.create({ ...data, projectId });
            return this.performanceRepo.save(perf);
        }
    }
    async getManhours(projectId) {
        return this.manhoursRepo.find({
            where: { projectId },
            order: { month: 'DESC' },
        });
    }
    async saveManhours(projectId, data) {
        const existing = await this.manhoursRepo.findOne({
            where: { projectId, month: data.month },
        });
        if (existing) {
            await this.manhoursRepo.update(existing.id, { ...data, projectId });
            return this.manhoursRepo.findOne({ where: { id: existing.id } });
        }
        else {
            const record = this.manhoursRepo.create({ ...data, projectId });
            return this.manhoursRepo.save(record);
        }
    }
    async getMonthlyLaborStats(projectId, month) {
        const startDate = `${month}-01`;
        const d = new Date(startDate);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const endDate = new Date(y, m, 0).toISOString().split('T')[0];
        const monthlyLabor = await this.laborRepo.find({
            where: {
                projectId,
                date: (0, typeorm_2.Between)(startDate, endDate),
            },
        });
        const totalWorkerManDays = monthlyLabor.reduce((sum, rec) => sum + Number(rec.count), 0);
        const uniqueDays = new Set(monthlyLabor.filter((r) => Number(r.count) > 0).map((r) => r.date)).size;
        return {
            totalWorkerManDays,
            workingDays: uniqueDays,
        };
    }
    async getInspections(projectId) {
        return this.inspectionRepo.find({
            where: { projectId },
            order: { dueDate: 'DESC' },
        });
    }
    async createInspection(data) {
        const inspection = this.inspectionRepo.create(data);
        return this.inspectionRepo.save(inspection);
    }
    async updateInspection(id, data) {
        await this.inspectionRepo.update(id, data);
        return this.inspectionRepo.findOne({ where: { id } });
    }
    async deleteInspection(id) {
        return this.inspectionRepo.delete(id);
    }
    async getTrainings(projectId) {
        return this.trainingRepo.find({
            where: { projectId },
            order: { date: 'DESC' },
        });
    }
    async createTraining(data) {
        const training = this.trainingRepo.create({
            ...data,
            attendeeCount: Number(data.attendeeCount),
            duration: Number(data.duration),
        });
        return this.trainingRepo.save(training);
    }
    async updateTraining(id, data) {
        await this.trainingRepo.update(id, data);
        return this.trainingRepo.findOne({ where: { id } });
    }
    async deleteTraining(id) {
        return this.trainingRepo.delete(id);
    }
    async getLegal(projectId) {
        return this.legalRepo.find({
            where: { projectId },
            order: { expiryDate: 'ASC' },
        });
    }
    async createLegal(data) {
        const legal = this.legalRepo.create(data);
        return this.legalRepo.save(legal);
    }
    async updateLegal(id, data) {
        await this.legalRepo.update(id, data);
        return this.legalRepo.findOne({ where: { id } });
    }
    async deleteLegal(id) {
        return this.legalRepo.delete(id);
    }
    async getMachinery(projectId) {
        return this.machineryRepo.find({
            where: { projectId },
            order: { expiryDate: 'ASC' },
        });
    }
    async createMachinery(data) {
        const item = this.machineryRepo.create(data);
        return this.machineryRepo.save(item);
    }
    async updateMachinery(id, data) {
        await this.machineryRepo.update(id, data);
        return this.machineryRepo.findOne({ where: { id } });
    }
    async deleteMachinery(id) {
        return this.machineryRepo.delete(id);
    }
    async getIncidentsRegister(projectId) {
        return this.incidentRegisterRepo.find({
            where: { projectId },
            order: { date: 'DESC' },
        });
    }
    async createIncidentRegister(data) {
        const item = this.incidentRegisterRepo.create(data);
        return this.incidentRegisterRepo.save(item);
    }
    async updateIncidentRegister(id, data) {
        await this.incidentRegisterRepo.update(id, data);
        return this.incidentRegisterRepo.findOne({ where: { id } });
    }
    async deleteIncidentRegister(id) {
        return this.incidentRegisterRepo.delete(id);
    }
    async getVehicles(projectId) {
        return this.vehicleRepo.find({ where: { projectId } });
    }
    async createVehicle(data) {
        const item = this.vehicleRepo.create(data);
        return this.vehicleRepo.save(item);
    }
    async updateVehicle(id, data) {
        await this.vehicleRepo.update(id, data);
        return this.vehicleRepo.findOne({ where: { id } });
    }
    async deleteVehicle(id) {
        return this.vehicleRepo.delete(id);
    }
    async getCompetencies(projectId) {
        return this.competencyRepo.find({ where: { projectId } });
    }
    async createCompetency(data) {
        const item = this.competencyRepo.create(data);
        return this.competencyRepo.save(item);
    }
    async updateCompetency(id, data) {
        await this.competencyRepo.update(id, data);
        return this.competencyRepo.findOne({ where: { id } });
    }
    async deleteCompetency(id) {
        return this.competencyRepo.delete(id);
    }
};
exports.EhsService = EhsService;
exports.EhsService = EhsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ehs_observation_entity_1.EhsObservation)),
    __param(1, (0, typeorm_1.InjectRepository)(ehs_incident_entity_1.EhsIncident)),
    __param(2, (0, typeorm_1.InjectRepository)(ehs_environmental_entity_1.EhsEnvironmental)),
    __param(3, (0, typeorm_1.InjectRepository)(ehs_training_entity_1.EhsTraining)),
    __param(4, (0, typeorm_1.InjectRepository)(ehs_project_config_entity_1.EhsProjectConfig)),
    __param(5, (0, typeorm_1.InjectRepository)(daily_labor_presence_entity_1.DailyLaborPresence)),
    __param(6, (0, typeorm_1.InjectRepository)(ehs_performance_entity_1.EhsPerformance)),
    __param(7, (0, typeorm_1.InjectRepository)(ehs_manhours_entity_1.EhsManhours)),
    __param(8, (0, typeorm_1.InjectRepository)(ehs_inspection_entity_1.EhsInspection)),
    __param(9, (0, typeorm_1.InjectRepository)(ehs_legal_register_entity_1.EhsLegalRegister)),
    __param(10, (0, typeorm_1.InjectRepository)(ehs_machinery_entity_1.EhsMachinery)),
    __param(11, (0, typeorm_1.InjectRepository)(ehs_incident_register_entity_1.EhsIncidentRegister)),
    __param(12, (0, typeorm_1.InjectRepository)(ehs_vehicle_entity_1.EhsVehicle)),
    __param(13, (0, typeorm_1.InjectRepository)(ehs_competency_entity_1.EhsCompetency)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], EhsService);
//# sourceMappingURL=ehs.service.js.map