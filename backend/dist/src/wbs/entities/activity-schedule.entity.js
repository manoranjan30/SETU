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
exports.ActivitySchedule = void 0;
const typeorm_1 = require("typeorm");
const activity_entity_1 = require("./activity.entity");
let ActivitySchedule = class ActivitySchedule {
    id;
    activityId;
    activity;
    earlyStart;
    earlyFinish;
    lateStart;
    lateFinish;
    totalFloat;
    freeFloat;
    isCritical;
    calculatedOn;
    createdOn;
    updatedOn;
};
exports.ActivitySchedule = ActivitySchedule;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], ActivitySchedule.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], ActivitySchedule.prototype, "activityId", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => activity_entity_1.Activity, (activity) => activity.schedule, {
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'activity_id' }),
    __metadata("design:type", activity_entity_1.Activity)
], ActivitySchedule.prototype, "activity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Date)
], ActivitySchedule.prototype, "earlyStart", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Date)
], ActivitySchedule.prototype, "earlyFinish", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Date)
], ActivitySchedule.prototype, "lateStart", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Date)
], ActivitySchedule.prototype, "lateFinish", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], ActivitySchedule.prototype, "totalFloat", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], ActivitySchedule.prototype, "freeFloat", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], ActivitySchedule.prototype, "isCritical", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], ActivitySchedule.prototype, "calculatedOn", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ActivitySchedule.prototype, "createdOn", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ActivitySchedule.prototype, "updatedOn", void 0);
exports.ActivitySchedule = ActivitySchedule = __decorate([
    (0, typeorm_1.Entity)()
], ActivitySchedule);
//# sourceMappingURL=activity-schedule.entity.js.map