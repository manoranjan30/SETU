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
exports.BoqActivityPlan = exports.MappingType = exports.PlanningBasis = void 0;
const typeorm_1 = require("typeorm");
const boq_item_entity_1 = require("../../boq/entities/boq-item.entity");
const activity_entity_1 = require("../../wbs/entities/activity.entity");
const measurement_element_entity_1 = require("../../boq/entities/measurement-element.entity");
var PlanningBasis;
(function (PlanningBasis) {
    PlanningBasis["INITIAL"] = "INITIAL";
    PlanningBasis["LOOKAHEAD"] = "LOOKAHEAD";
    PlanningBasis["RECOVERY"] = "RECOVERY";
})(PlanningBasis || (exports.PlanningBasis = PlanningBasis = {}));
var MappingType;
(function (MappingType) {
    MappingType["DIRECT"] = "DIRECT";
    MappingType["PROPORTION"] = "PROPORTION";
    MappingType["PHASED"] = "PHASED";
})(MappingType || (exports.MappingType = MappingType = {}));
let BoqActivityPlan = class BoqActivityPlan {
    id;
    projectId;
    boqItem;
    boqItemId;
    activity;
    activityId;
    boqSubItemId;
    measurement;
    measurementId;
    plannedQuantity;
    planningBasis;
    mappingType;
    mappingRules;
    plannedStart;
    plannedFinish;
    createdOn;
    updatedOn;
    createdBy;
};
exports.BoqActivityPlan = BoqActivityPlan;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], BoqActivityPlan.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], BoqActivityPlan.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => boq_item_entity_1.BoqItem, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'boq_item_id' }),
    __metadata("design:type", boq_item_entity_1.BoqItem)
], BoqActivityPlan.prototype, "boqItem", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'boq_item_id' }),
    __metadata("design:type", Number)
], BoqActivityPlan.prototype, "boqItemId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => activity_entity_1.Activity, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'activity_id' }),
    __metadata("design:type", activity_entity_1.Activity)
], BoqActivityPlan.prototype, "activity", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'activity_id' }),
    __metadata("design:type", Number)
], BoqActivityPlan.prototype, "activityId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], BoqActivityPlan.prototype, "boqSubItemId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => measurement_element_entity_1.MeasurementElement, { nullable: true, onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'measurement_id' }),
    __metadata("design:type", measurement_element_entity_1.MeasurementElement)
], BoqActivityPlan.prototype, "measurement", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'measurement_id', nullable: true }),
    __metadata("design:type", Number)
], BoqActivityPlan.prototype, "measurementId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], BoqActivityPlan.prototype, "plannedQuantity", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: PlanningBasis,
        default: PlanningBasis.INITIAL,
    }),
    __metadata("design:type", String)
], BoqActivityPlan.prototype, "planningBasis", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: MappingType,
        default: MappingType.DIRECT,
    }),
    __metadata("design:type", String)
], BoqActivityPlan.prototype, "mappingType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], BoqActivityPlan.prototype, "mappingRules", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Object)
], BoqActivityPlan.prototype, "plannedStart", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Object)
], BoqActivityPlan.prototype, "plannedFinish", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], BoqActivityPlan.prototype, "createdOn", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], BoqActivityPlan.prototype, "updatedOn", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], BoqActivityPlan.prototype, "createdBy", void 0);
exports.BoqActivityPlan = BoqActivityPlan = __decorate([
    (0, typeorm_1.Entity)('boq_activity_plan')
], BoqActivityPlan);
//# sourceMappingURL=boq-activity-plan.entity.js.map