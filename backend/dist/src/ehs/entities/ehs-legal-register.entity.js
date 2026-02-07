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
exports.EhsLegalRegister = void 0;
const typeorm_1 = require("typeorm");
let EhsLegalRegister = class EhsLegalRegister {
    id;
    projectId;
    requirement;
    responsibility;
    status;
    certifiedDate;
    expiryDate;
    remarks;
    createdAt;
    updatedAt;
};
exports.EhsLegalRegister = EhsLegalRegister;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], EhsLegalRegister.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], EhsLegalRegister.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EhsLegalRegister.prototype, "requirement", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EhsLegalRegister.prototype, "responsibility", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'Valid' }),
    __metadata("design:type", String)
], EhsLegalRegister.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", String)
], EhsLegalRegister.prototype, "certifiedDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", String)
], EhsLegalRegister.prototype, "expiryDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], EhsLegalRegister.prototype, "remarks", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], EhsLegalRegister.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], EhsLegalRegister.prototype, "updatedAt", void 0);
exports.EhsLegalRegister = EhsLegalRegister = __decorate([
    (0, typeorm_1.Entity)('ehs_legal_registers')
], EhsLegalRegister);
//# sourceMappingURL=ehs-legal-register.entity.js.map