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
exports.QualityMaterialTest = void 0;
const typeorm_1 = require("typeorm");
let QualityMaterialTest = class QualityMaterialTest {
    id;
    projectId;
    materialName;
    batchNumber;
    supplier;
    receivedDate;
    testDate;
    testType;
    result;
    testParameters;
    status;
    reportUrl;
    createdAt;
    updatedAt;
};
exports.QualityMaterialTest = QualityMaterialTest;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], QualityMaterialTest.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], QualityMaterialTest.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], QualityMaterialTest.prototype, "materialName", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], QualityMaterialTest.prototype, "batchNumber", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], QualityMaterialTest.prototype, "supplier", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date' }),
    __metadata("design:type", String)
], QualityMaterialTest.prototype, "receivedDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date' }),
    __metadata("design:type", String)
], QualityMaterialTest.prototype, "testDate", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], QualityMaterialTest.prototype, "testType", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], QualityMaterialTest.prototype, "result", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], QualityMaterialTest.prototype, "testParameters", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'Approved' }),
    __metadata("design:type", String)
], QualityMaterialTest.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], QualityMaterialTest.prototype, "reportUrl", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], QualityMaterialTest.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], QualityMaterialTest.prototype, "updatedAt", void 0);
exports.QualityMaterialTest = QualityMaterialTest = __decorate([
    (0, typeorm_1.Entity)('quality_material_tests')
], QualityMaterialTest);
//# sourceMappingURL=quality-material-test.entity.js.map