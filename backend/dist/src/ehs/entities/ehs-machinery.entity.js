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
exports.EhsMachinery = void 0;
const typeorm_1 = require("typeorm");
let EhsMachinery = class EhsMachinery {
    id;
    projectId;
    equipmentName;
    idNumber;
    location;
    certifiedDate;
    expiryDate;
    status;
    remarks;
    createdAt;
    updatedAt;
};
exports.EhsMachinery = EhsMachinery;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], EhsMachinery.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], EhsMachinery.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EhsMachinery.prototype, "equipmentName", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EhsMachinery.prototype, "idNumber", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EhsMachinery.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", String)
], EhsMachinery.prototype, "certifiedDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", String)
], EhsMachinery.prototype, "expiryDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'Valid' }),
    __metadata("design:type", String)
], EhsMachinery.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], EhsMachinery.prototype, "remarks", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], EhsMachinery.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], EhsMachinery.prototype, "updatedAt", void 0);
exports.EhsMachinery = EhsMachinery = __decorate([
    (0, typeorm_1.Entity)('ehs_machineries')
], EhsMachinery);
//# sourceMappingURL=ehs-machinery.entity.js.map