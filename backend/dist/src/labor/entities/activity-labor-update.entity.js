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
exports.ActivityLaborUpdate = void 0;
const typeorm_1 = require("typeorm");
const labor_category_entity_1 = require("./labor-category.entity");
const activity_entity_1 = require("../../wbs/entities/activity.entity");
let ActivityLaborUpdate = class ActivityLaborUpdate {
    id;
    activityId;
    activity;
    date;
    categoryId;
    category;
    count;
    createdOn;
    updatedOn;
    updatedBy;
};
exports.ActivityLaborUpdate = ActivityLaborUpdate;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], ActivityLaborUpdate.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], ActivityLaborUpdate.prototype, "activityId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => activity_entity_1.Activity),
    (0, typeorm_1.JoinColumn)({ name: 'activityId' }),
    __metadata("design:type", activity_entity_1.Activity)
], ActivityLaborUpdate.prototype, "activity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date' }),
    __metadata("design:type", String)
], ActivityLaborUpdate.prototype, "date", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], ActivityLaborUpdate.prototype, "categoryId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => labor_category_entity_1.LaborCategory),
    (0, typeorm_1.JoinColumn)({ name: 'categoryId' }),
    __metadata("design:type", labor_category_entity_1.LaborCategory)
], ActivityLaborUpdate.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], ActivityLaborUpdate.prototype, "count", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ActivityLaborUpdate.prototype, "createdOn", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ActivityLaborUpdate.prototype, "updatedOn", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ActivityLaborUpdate.prototype, "updatedBy", void 0);
exports.ActivityLaborUpdate = ActivityLaborUpdate = __decorate([
    (0, typeorm_1.Entity)('activity_labor_update')
], ActivityLaborUpdate);
//# sourceMappingURL=activity-labor-update.entity.js.map