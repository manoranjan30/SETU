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
exports.QualityController = void 0;
const common_1 = require("@nestjs/common");
const quality_service_1 = require("./quality.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
let QualityController = class QualityController {
    qualityService;
    constructor(qualityService) {
        this.qualityService = qualityService;
    }
    getSummary(projectId) {
        return this.qualityService.getSummary(projectId);
    }
    getInspections(projectId) {
        return this.qualityService.getInspections(projectId);
    }
    createInspection(data) {
        return this.qualityService.createInspection(data);
    }
    updateInspection(id, data) {
        return this.qualityService.updateInspection(id, data);
    }
    deleteInspection(id) {
        return this.qualityService.deleteInspection(id);
    }
    getMaterialTests(projectId) {
        return this.qualityService.getMaterialTests(projectId);
    }
    createMaterialTest(data) {
        return this.qualityService.createMaterialTest(data);
    }
    updateMaterialTest(id, data) {
        return this.qualityService.updateMaterialTest(id, data);
    }
    deleteMaterialTest(id) {
        return this.qualityService.deleteMaterialTest(id);
    }
    getObservationNcr(projectId) {
        return this.qualityService.getObservationsNcr(projectId);
    }
    createObservationNcr(data) {
        return this.qualityService.createObservationNcr(data);
    }
    updateObservationNcr(id, data) {
        return this.qualityService.updateObservationNcr(id, data);
    }
    deleteObservationNcr(id) {
        return this.qualityService.deleteObservationNcr(id);
    }
    getChecklists(projectId) {
        return this.qualityService.getChecklists(projectId);
    }
    createChecklist(data) {
        return this.qualityService.createChecklist(data);
    }
    updateChecklist(id, data) {
        return this.qualityService.updateChecklist(id, data);
    }
    deleteChecklist(id) {
        return this.qualityService.deleteChecklist(id);
    }
    getSnags(projectId) {
        return this.qualityService.getSnags(projectId);
    }
    createSnag(data) {
        return this.qualityService.createSnag(data);
    }
    updateSnag(id, data) {
        return this.qualityService.updateSnag(id, data);
    }
    deleteSnag(id) {
        return this.qualityService.deleteSnag(id);
    }
    getAudits(projectId) {
        return this.qualityService.getAudits(projectId);
    }
    createAudit(data) {
        return this.qualityService.createAudit(data);
    }
    updateAudit(id, data) {
        return this.qualityService.updateAudit(id, data);
    }
    deleteAudit(id) {
        return this.qualityService.deleteAudit(id);
    }
    getDocuments(projectId) {
        return this.qualityService.getDocuments(projectId);
    }
    createDocument(data) {
        return this.qualityService.createDocument(data);
    }
    updateDocument(id, data) {
        return this.qualityService.updateDocument(id, data);
    }
    deleteDocument(id) {
        return this.qualityService.deleteDocument(id);
    }
};
exports.QualityController = QualityController;
__decorate([
    (0, common_1.Get)(':projectId/summary'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "getSummary", null);
__decorate([
    (0, common_1.Get)(':projectId/inspections'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "getInspections", null);
__decorate([
    (0, common_1.Post)('inspections'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "createInspection", null);
__decorate([
    (0, common_1.Put)('inspections/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "updateInspection", null);
__decorate([
    (0, common_1.Delete)('inspections/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "deleteInspection", null);
__decorate([
    (0, common_1.Get)(':projectId/material-tests'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "getMaterialTests", null);
__decorate([
    (0, common_1.Post)('material-tests'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "createMaterialTest", null);
__decorate([
    (0, common_1.Put)('material-tests/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "updateMaterialTest", null);
__decorate([
    (0, common_1.Delete)('material-tests/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "deleteMaterialTest", null);
__decorate([
    (0, common_1.Get)(':projectId/observation-ncr'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "getObservationNcr", null);
__decorate([
    (0, common_1.Post)('observation-ncr'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "createObservationNcr", null);
__decorate([
    (0, common_1.Put)('observation-ncr/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "updateObservationNcr", null);
__decorate([
    (0, common_1.Delete)('observation-ncr/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "deleteObservationNcr", null);
__decorate([
    (0, common_1.Get)(':projectId/checklists'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "getChecklists", null);
__decorate([
    (0, common_1.Post)('checklists'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "createChecklist", null);
__decorate([
    (0, common_1.Put)('checklists/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "updateChecklist", null);
__decorate([
    (0, common_1.Delete)('checklists/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "deleteChecklist", null);
__decorate([
    (0, common_1.Get)(':projectId/snags'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "getSnags", null);
__decorate([
    (0, common_1.Post)('snags'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "createSnag", null);
__decorate([
    (0, common_1.Put)('snags/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "updateSnag", null);
__decorate([
    (0, common_1.Delete)('snags/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "deleteSnag", null);
__decorate([
    (0, common_1.Get)(':projectId/audits'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "getAudits", null);
__decorate([
    (0, common_1.Post)('audits'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "createAudit", null);
__decorate([
    (0, common_1.Put)('audits/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "updateAudit", null);
__decorate([
    (0, common_1.Delete)('audits/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "deleteAudit", null);
__decorate([
    (0, common_1.Get)(':projectId/documents'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "getDocuments", null);
__decorate([
    (0, common_1.Post)('documents'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "createDocument", null);
__decorate([
    (0, common_1.Put)('documents/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "updateDocument", null);
__decorate([
    (0, common_1.Delete)('documents/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], QualityController.prototype, "deleteDocument", null);
exports.QualityController = QualityController = __decorate([
    (0, common_1.Controller)('quality'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [quality_service_1.QualityService])
], QualityController);
//# sourceMappingURL=quality.controller.js.map