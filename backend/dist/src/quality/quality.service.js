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
exports.QualityService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const quality_inspection_entity_1 = require("./entities/quality-inspection.entity");
const quality_material_test_entity_1 = require("./entities/quality-material-test.entity");
const quality_observation_ncr_entity_1 = require("./entities/quality-observation-ncr.entity");
const quality_checklist_entity_1 = require("./entities/quality-checklist.entity");
const quality_snag_list_entity_1 = require("./entities/quality-snag-list.entity");
const quality_audit_entity_1 = require("./entities/quality-audit.entity");
const quality_document_entity_1 = require("./entities/quality-document.entity");
let QualityService = class QualityService {
    inspectionRepo;
    materialRepo;
    observationNcrRepo;
    checklistRepo;
    snagRepo;
    auditRepo;
    documentRepo;
    constructor(inspectionRepo, materialRepo, observationNcrRepo, checklistRepo, snagRepo, auditRepo, documentRepo) {
        this.inspectionRepo = inspectionRepo;
        this.materialRepo = materialRepo;
        this.observationNcrRepo = observationNcrRepo;
        this.checklistRepo = checklistRepo;
        this.snagRepo = snagRepo;
        this.auditRepo = auditRepo;
        this.documentRepo = documentRepo;
    }
    async getSummary(projectId) {
        const inspections = await this.inspectionRepo.find({
            where: { projectId },
        });
        const materialTests = await this.materialRepo.find({
            where: { projectId },
        });
        const observationsNcr = await this.observationNcrRepo.find({
            where: { projectId },
        });
        const checklists = await this.checklistRepo.find({ where: { projectId } });
        const snags = await this.snagRepo.find({ where: { projectId } });
        const openNcr = observationsNcr.filter((o) => o.type === 'NCR' && o.status === 'Open').length;
        const openObservations = observationsNcr.filter((o) => o.type === 'Observation' && o.status === 'Open').length;
        const pendingInspections = inspections.filter((i) => i.status === 'Pending' || i.status === 'In Progress').length;
        const failedTests = materialTests.filter((t) => t.result === 'Fail').length;
        const totalClosedInspections = inspections.filter((i) => ['Pass', 'Fail'].includes(i.status)).length;
        const passedInspections = inspections.filter((i) => i.status === 'Pass').length;
        const qualityScore = totalClosedInspections > 0
            ? (passedInspections / totalClosedInspections) * 100
            : 100;
        return {
            openNcr,
            openObservations,
            pendingInspections,
            failedTests,
            qualityScore: Math.round(qualityScore),
            snagsCount: snags.filter((s) => s.status !== 'Closed').length,
            totalInspections: inspections.length,
            checklistsCount: checklists.length,
        };
    }
    async getInspections(projectId) {
        return this.inspectionRepo.find({
            where: { projectId },
            order: { scheduledDate: 'DESC' },
        });
    }
    async createInspection(data) {
        const item = this.inspectionRepo.create(data);
        return this.inspectionRepo.save(item);
    }
    async updateInspection(id, data) {
        await this.inspectionRepo.update(id, data);
        return this.inspectionRepo.findOne({ where: { id } });
    }
    async deleteInspection(id) {
        return this.inspectionRepo.delete(id);
    }
    async getMaterialTests(projectId) {
        return this.materialRepo.find({
            where: { projectId },
            order: { testDate: 'DESC' },
        });
    }
    async createMaterialTest(data) {
        const item = this.materialRepo.create(data);
        return this.materialRepo.save(item);
    }
    async updateMaterialTest(id, data) {
        await this.materialRepo.update(id, data);
        return this.materialRepo.findOne({ where: { id } });
    }
    async deleteMaterialTest(id) {
        return this.materialRepo.delete(id);
    }
    async getObservationsNcr(projectId) {
        return this.observationNcrRepo.find({
            where: { projectId },
            order: { reportedDate: 'DESC' },
        });
    }
    async createObservationNcr(data) {
        const item = this.observationNcrRepo.create(data);
        return this.observationNcrRepo.save(item);
    }
    async updateObservationNcr(id, data) {
        await this.observationNcrRepo.update(id, data);
        return this.observationNcrRepo.findOne({ where: { id } });
    }
    async deleteObservationNcr(id) {
        return this.observationNcrRepo.delete(id);
    }
    async getChecklists(projectId) {
        return this.checklistRepo.find({
            where: { projectId },
            order: { createdAt: 'DESC' },
        });
    }
    async createChecklist(data) {
        const item = this.checklistRepo.create(data);
        return this.checklistRepo.save(item);
    }
    async updateChecklist(id, data) {
        await this.checklistRepo.update(id, data);
        return this.checklistRepo.findOne({ where: { id } });
    }
    async deleteChecklist(id) {
        return this.checklistRepo.delete(id);
    }
    async getSnags(projectId) {
        return this.snagRepo.find({
            where: { projectId },
            order: { createdAt: 'DESC' },
        });
    }
    async createSnag(data) {
        const item = this.snagRepo.create(data);
        return this.snagRepo.save(item);
    }
    async updateSnag(id, data) {
        await this.snagRepo.update(id, data);
        return this.snagRepo.findOne({ where: { id } });
    }
    async deleteSnag(id) {
        return this.snagRepo.delete(id);
    }
    async getAudits(projectId) {
        return this.auditRepo.find({
            where: { projectId },
            order: { auditDate: 'DESC' },
        });
    }
    async createAudit(data) {
        const item = this.auditRepo.create(data);
        return this.auditRepo.save(item);
    }
    async updateAudit(id, data) {
        await this.auditRepo.update(id, data);
        return this.auditRepo.findOne({ where: { id } });
    }
    async deleteAudit(id) {
        return this.auditRepo.delete(id);
    }
    async getDocuments(projectId) {
        return this.documentRepo.find({
            where: { projectId },
            order: { submissionDate: 'DESC' },
        });
    }
    async createDocument(data) {
        const item = this.documentRepo.create(data);
        return this.documentRepo.save(item);
    }
    async updateDocument(id, data) {
        await this.documentRepo.update(id, data);
        return this.documentRepo.findOne({ where: { id } });
    }
    async deleteDocument(id) {
        return this.documentRepo.delete(id);
    }
};
exports.QualityService = QualityService;
exports.QualityService = QualityService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(quality_inspection_entity_1.QualityInspection)),
    __param(1, (0, typeorm_1.InjectRepository)(quality_material_test_entity_1.QualityMaterialTest)),
    __param(2, (0, typeorm_1.InjectRepository)(quality_observation_ncr_entity_1.QualityObservationNcr)),
    __param(3, (0, typeorm_1.InjectRepository)(quality_checklist_entity_1.QualityChecklist)),
    __param(4, (0, typeorm_1.InjectRepository)(quality_snag_list_entity_1.QualitySnagList)),
    __param(5, (0, typeorm_1.InjectRepository)(quality_audit_entity_1.QualityAudit)),
    __param(6, (0, typeorm_1.InjectRepository)(quality_document_entity_1.QualityDocument)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], QualityService);
//# sourceMappingURL=quality.service.js.map