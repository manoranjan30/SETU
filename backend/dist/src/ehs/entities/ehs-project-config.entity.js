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
exports.EhsProjectConfig = void 0;
const typeorm_1 = require("typeorm");
const eps_entity_1 = require("../../eps/eps.entity");
let EhsProjectConfig = class EhsProjectConfig {
    id;
    projectId;
    project;
    ehsManagerId;
    ehsManagerContact;
    inceptionDate;
    lastLtiDate;
    targetSafetyScore;
    createdAt;
    updatedAt;
};
exports.EhsProjectConfig = EhsProjectConfig;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], EhsProjectConfig.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", Number)
], EhsProjectConfig.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => eps_entity_1.EpsNode),
    (0, typeorm_1.JoinColumn)({ name: 'projectId' }),
    __metadata("design:type", eps_entity_1.EpsNode)
], EhsProjectConfig.prototype, "project", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], EhsProjectConfig.prototype, "ehsManagerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EhsProjectConfig.prototype, "ehsManagerContact", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Date)
], EhsProjectConfig.prototype, "inceptionDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Date)
], EhsProjectConfig.prototype, "lastLtiDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 2, default: 95 }),
    __metadata("design:type", Number)
], EhsProjectConfig.prototype, "targetSafetyScore", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], EhsProjectConfig.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], EhsProjectConfig.prototype, "updatedAt", void 0);
exports.EhsProjectConfig = EhsProjectConfig = __decorate([
    (0, typeorm_1.Entity)('ehs_project_configs')
], EhsProjectConfig);
//# sourceMappingURL=ehs-project-config.entity.js.map