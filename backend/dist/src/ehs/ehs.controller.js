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
exports.EhsController = void 0;
const common_1 = require("@nestjs/common");
const ehs_service_1 = require("./ehs.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
let EhsController = class EhsController {
    ehsService;
    constructor(ehsService) {
        this.ehsService = ehsService;
    }
    async getSummary(projectId) {
        return this.ehsService.getSummary(projectId);
    }
    async getObservations(projectId) {
        return this.ehsService.getObservations(projectId);
    }
    async createObservation(projectId, data, req) {
        return this.ehsService.createObservation({
            ...data,
            projectId,
            reportedById: req.user.id,
        });
    }
    async updateObservation(id, data) {
        return this.ehsService.updateObservation(id, data);
    }
    async getIncidents(projectId) {
        return this.ehsService.getIncidents(projectId);
    }
    async createIncident(projectId, data, req) {
        return this.ehsService.createIncident({
            ...data,
            projectId,
            reportedById: req.user.id,
        });
    }
    async getEnvironmental(projectId) {
        return this.ehsService.getEnvironmentalLogs(projectId);
    }
    async createEnvironmental(projectId, data, req) {
        return this.ehsService.createEnvironmentalLog({
            ...data,
            projectId,
            createdById: req.user.id,
        });
    }
    async getTrends(projectId) {
        return this.ehsService.getTrends(projectId);
    }
    async getPerformance(projectId) {
        return this.ehsService.getPerformance(projectId);
    }
    async savePerformance(projectId, data) {
        return this.ehsService.savePerformance(projectId, data);
    }
    async getManhours(projectId) {
        return this.ehsService.getManhours(projectId);
    }
    async saveManhours(projectId, data) {
        return this.ehsService.saveManhours(projectId, data);
    }
    async getLaborStats(projectId, month) {
        return this.ehsService.getMonthlyLaborStats(projectId, month);
    }
    async getInspections(projectId) {
        return this.ehsService.getInspections(projectId);
    }
    async createInspection(projectId, data) {
        return this.ehsService.createInspection({ ...data, projectId });
    }
    async updateInspection(id, data) {
        return this.ehsService.updateInspection(id, data);
    }
    async deleteInspection(id) {
        return this.ehsService.deleteInspection(id);
    }
    async getTrainings(projectId) {
        return this.ehsService.getTrainings(projectId);
    }
    async createTraining(projectId, data, req) {
        return this.ehsService.createTraining({
            ...data,
            projectId,
            createdById: req.user.id,
        });
    }
    async updateTraining(id, data) {
        return this.ehsService.updateTraining(id, data);
    }
    async deleteTraining(id) {
        return this.ehsService.deleteTraining(id);
    }
    async getLegal(projectId) {
        return this.ehsService.getLegal(projectId);
    }
    async createLegal(projectId, data) {
        return this.ehsService.createLegal({ ...data, projectId });
    }
    async updateLegal(id, data) {
        return this.ehsService.updateLegal(id, data);
    }
    async deleteLegal(id) {
        return this.ehsService.deleteLegal(id);
    }
    async getMachinery(projectId) {
        return this.ehsService.getMachinery(projectId);
    }
    async createMachinery(projectId, data) {
        return this.ehsService.createMachinery({ ...data, projectId });
    }
    async updateMachinery(id, data) {
        return this.ehsService.updateMachinery(id, data);
    }
    async deleteMachinery(id) {
        return this.ehsService.deleteMachinery(id);
    }
    async getIncidentsRegister(projectId) {
        return this.ehsService.getIncidentsRegister(projectId);
    }
    async createIncidentRegister(projectId, data) {
        return this.ehsService.createIncidentRegister({ ...data, projectId });
    }
    async updateIncidentRegister(id, data) {
        return this.ehsService.updateIncidentRegister(id, data);
    }
    async deleteIncidentRegister(id) {
        return this.ehsService.deleteIncidentRegister(id);
    }
    async getVehicles(projectId) {
        return this.ehsService.getVehicles(projectId);
    }
    async createVehicle(projectId, data) {
        return this.ehsService.createVehicle({ ...data, projectId });
    }
    async updateVehicle(id, data) {
        return this.ehsService.updateVehicle(id, data);
    }
    async deleteVehicle(id) {
        return this.ehsService.deleteVehicle(id);
    }
    async getCompetencies(projectId) {
        return this.ehsService.getCompetencies(projectId);
    }
    async createCompetency(projectId, data) {
        return this.ehsService.createCompetency({ ...data, projectId });
    }
    async updateCompetency(id, data) {
        return this.ehsService.updateCompetency(id, data);
    }
    async deleteCompetency(id) {
        return this.ehsService.deleteCompetency(id);
    }
};
exports.EhsController = EhsController;
__decorate([
    (0, common_1.Get)(':projectId/summary'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "getSummary", null);
__decorate([
    (0, common_1.Get)(':projectId/observations'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "getObservations", null);
__decorate([
    (0, common_1.Post)(':projectId/observations'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "createObservation", null);
__decorate([
    (0, common_1.Put)('observations/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "updateObservation", null);
__decorate([
    (0, common_1.Get)(':projectId/incidents'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "getIncidents", null);
__decorate([
    (0, common_1.Post)(':projectId/incidents'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "createIncident", null);
__decorate([
    (0, common_1.Get)(':projectId/environmental'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "getEnvironmental", null);
__decorate([
    (0, common_1.Post)(':projectId/environmental'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "createEnvironmental", null);
__decorate([
    (0, common_1.Get)(':projectId/trends'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "getTrends", null);
__decorate([
    (0, common_1.Get)(':projectId/performance'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "getPerformance", null);
__decorate([
    (0, common_1.Post)(':projectId/performance'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "savePerformance", null);
__decorate([
    (0, common_1.Get)(':projectId/manhours'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "getManhours", null);
__decorate([
    (0, common_1.Post)(':projectId/manhours'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "saveManhours", null);
__decorate([
    (0, common_1.Get)(':projectId/labor-stats'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Query)('month')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "getLaborStats", null);
__decorate([
    (0, common_1.Get)(':projectId/inspections'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "getInspections", null);
__decorate([
    (0, common_1.Post)(':projectId/inspections'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "createInspection", null);
__decorate([
    (0, common_1.Put)('inspections/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "updateInspection", null);
__decorate([
    (0, common_1.Delete)('inspections/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "deleteInspection", null);
__decorate([
    (0, common_1.Get)(':projectId/trainings'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "getTrainings", null);
__decorate([
    (0, common_1.Post)(':projectId/trainings'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "createTraining", null);
__decorate([
    (0, common_1.Put)('trainings/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "updateTraining", null);
__decorate([
    (0, common_1.Delete)('trainings/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "deleteTraining", null);
__decorate([
    (0, common_1.Get)(':projectId/legal'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "getLegal", null);
__decorate([
    (0, common_1.Post)(':projectId/legal'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "createLegal", null);
__decorate([
    (0, common_1.Put)('legal/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "updateLegal", null);
__decorate([
    (0, common_1.Delete)('legal/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "deleteLegal", null);
__decorate([
    (0, common_1.Get)(':projectId/machinery'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "getMachinery", null);
__decorate([
    (0, common_1.Post)(':projectId/machinery'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "createMachinery", null);
__decorate([
    (0, common_1.Put)('machinery/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "updateMachinery", null);
__decorate([
    (0, common_1.Delete)('machinery/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "deleteMachinery", null);
__decorate([
    (0, common_1.Get)(':projectId/incidents-register'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "getIncidentsRegister", null);
__decorate([
    (0, common_1.Post)(':projectId/incidents-register'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "createIncidentRegister", null);
__decorate([
    (0, common_1.Put)('incidents-register/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "updateIncidentRegister", null);
__decorate([
    (0, common_1.Delete)('incidents-register/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "deleteIncidentRegister", null);
__decorate([
    (0, common_1.Get)(':projectId/vehicles'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "getVehicles", null);
__decorate([
    (0, common_1.Post)(':projectId/vehicles'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "createVehicle", null);
__decorate([
    (0, common_1.Put)('vehicles/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "updateVehicle", null);
__decorate([
    (0, common_1.Delete)('vehicles/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "deleteVehicle", null);
__decorate([
    (0, common_1.Get)(':projectId/competencies'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "getCompetencies", null);
__decorate([
    (0, common_1.Post)(':projectId/competencies'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "createCompetency", null);
__decorate([
    (0, common_1.Put)('competencies/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "updateCompetency", null);
__decorate([
    (0, common_1.Delete)('competencies/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], EhsController.prototype, "deleteCompetency", null);
exports.EhsController = EhsController = __decorate([
    (0, common_1.Controller)('ehs'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [ehs_service_1.EhsService])
], EhsController);
//# sourceMappingURL=ehs.controller.js.map