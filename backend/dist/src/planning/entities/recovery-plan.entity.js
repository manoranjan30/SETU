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
exports.RecoveryPlan = void 0;
const typeorm_1 = require("typeorm");
const activity_entity_1 = require("../../wbs/entities/activity.entity");
let RecoveryPlan = class RecoveryPlan {
    id;
    projectId;
    activity;
    activityId;
    reasonForDelay;
    recoveryStrategy;
    revisedDuration;
    targetFinish;
    additionalResourcesRequired;
    status;
    createdOn;
    updatedOn;
    createdBy;
};
exports.RecoveryPlan = RecoveryPlan;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], RecoveryPlan.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], RecoveryPlan.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => activity_entity_1.Activity, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'activity_id' }),
    __metadata("design:type", activity_entity_1.Activity)
], RecoveryPlan.prototype, "activity", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], RecoveryPlan.prototype, "activityId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], RecoveryPlan.prototype, "reasonForDelay", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], RecoveryPlan.prototype, "recoveryStrategy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], RecoveryPlan.prototype, "revisedDuration", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Date)
], RecoveryPlan.prototype, "targetFinish", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], RecoveryPlan.prototype, "additionalResourcesRequired", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'PROPOSED' }),
    __metadata("design:type", String)
], RecoveryPlan.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], RecoveryPlan.prototype, "createdOn", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], RecoveryPlan.prototype, "updatedOn", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], RecoveryPlan.prototype, "createdBy", void 0);
exports.RecoveryPlan = RecoveryPlan = __decorate([
    (0, typeorm_1.Entity)('recovery_plan')
], RecoveryPlan);
//# sourceMappingURL=recovery-plan.entity.js.map