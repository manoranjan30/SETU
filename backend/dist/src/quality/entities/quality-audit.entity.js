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
Object.defineProperty(exports, "__esModule", { value: true });
exports.QualityAudit = void 0;
const typeorm_1 = require("typeorm");
let QualityAudit = class QualityAudit {
    id;
    projectId;
    auditType;
    auditorName;
    auditDate;
    scope;
    findings;
    nonConformancesCount;
    observationsCount;
    status;
    reportUrl;
    createdAt;
    updatedAt;
};
exports.QualityAudit = QualityAudit;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], QualityAudit.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], QualityAudit.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], QualityAudit.prototype, "auditType", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], QualityAudit.prototype, "auditorName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date' }),
    __metadata("design:type", String)
], QualityAudit.prototype, "auditDate", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], QualityAudit.prototype, "scope", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], QualityAudit.prototype, "findings", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], QualityAudit.prototype, "nonConformancesCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], QualityAudit.prototype, "observationsCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'Completed' }),
    __metadata("design:type", String)
], QualityAudit.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], QualityAudit.prototype, "reportUrl", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], QualityAudit.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], QualityAudit.prototype, "updatedAt", void 0);
exports.QualityAudit = QualityAudit = __decorate([
    (0, typeorm_1.Entity)('quality_audits')
], QualityAudit);
//# sourceMappingURL=quality-audit.entity.js.map