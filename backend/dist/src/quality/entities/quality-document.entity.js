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
exports.QualityDocument = void 0;
const typeorm_1 = require("typeorm");
let QualityDocument = class QualityDocument {
    id;
    projectId;
    documentType;
    documentName;
    referenceNumber;
    revision;
    submissionDate;
    approvalDate;
    status;
    fileUrl;
    createdAt;
    updatedAt;
};
exports.QualityDocument = QualityDocument;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], QualityDocument.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], QualityDocument.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], QualityDocument.prototype, "documentType", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], QualityDocument.prototype, "documentName", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], QualityDocument.prototype, "referenceNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], QualityDocument.prototype, "revision", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", String)
], QualityDocument.prototype, "submissionDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", String)
], QualityDocument.prototype, "approvalDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'Approved' }),
    __metadata("design:type", String)
], QualityDocument.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], QualityDocument.prototype, "fileUrl", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], QualityDocument.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], QualityDocument.prototype, "updatedAt", void 0);
exports.QualityDocument = QualityDocument = __decorate([
    (0, typeorm_1.Entity)('quality_documents')
], QualityDocument);
//# sourceMappingURL=quality-document.entity.js.map