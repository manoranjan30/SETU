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
exports.QualityObservationNcr = void 0;
const typeorm_1 = require("typeorm");
let QualityObservationNcr = class QualityObservationNcr {
    id;
    projectId;
    type;
    severity;
    category;
    issueDescription;
    location;
    reportedDate;
    reportedBy;
    assignedTo;
    status;
    rootCause;
    correctiveAction;
    targetDate;
    closedDate;
    attachmentUrl;
    createdAt;
    updatedAt;
};
exports.QualityObservationNcr = QualityObservationNcr;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], QualityObservationNcr.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], QualityObservationNcr.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], QualityObservationNcr.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], QualityObservationNcr.prototype, "severity", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], QualityObservationNcr.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], QualityObservationNcr.prototype, "issueDescription", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], QualityObservationNcr.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date' }),
    __metadata("design:type", String)
], QualityObservationNcr.prototype, "reportedDate", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], QualityObservationNcr.prototype, "reportedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], QualityObservationNcr.prototype, "assignedTo", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'Open' }),
    __metadata("design:type", String)
], QualityObservationNcr.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], QualityObservationNcr.prototype, "rootCause", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], QualityObservationNcr.prototype, "correctiveAction", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", String)
], QualityObservationNcr.prototype, "targetDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", String)
], QualityObservationNcr.prototype, "closedDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], QualityObservationNcr.prototype, "attachmentUrl", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], QualityObservationNcr.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], QualityObservationNcr.prototype, "updatedAt", void 0);
exports.QualityObservationNcr = QualityObservationNcr = __decorate([
    (0, typeorm_1.Entity)('quality_observations_ncr')
], QualityObservationNcr);
//# sourceMappingURL=quality-observation-ncr.entity.js.map