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
exports.ActivityVersion = void 0;
const typeorm_1 = require("typeorm");
const schedule_version_entity_1 = require("./schedule-version.entity");
const activity_entity_1 = require("../../wbs/entities/activity.entity");
let ActivityVersion = class ActivityVersion {
    id;
    versionId;
    scheduleVersion;
    activityId;
    activity;
    startDate;
    finishDate;
    duration;
    isCritical;
    totalFloat;
    freeFloat;
    remarks;
};
exports.ActivityVersion = ActivityVersion;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], ActivityVersion.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], ActivityVersion.prototype, "versionId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => schedule_version_entity_1.ScheduleVersion, (version) => version.activityVersions, {
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'versionId' }),
    __metadata("design:type", schedule_version_entity_1.ScheduleVersion)
], ActivityVersion.prototype, "scheduleVersion", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], ActivityVersion.prototype, "activityId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => activity_entity_1.Activity, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'activityId' }),
    __metadata("design:type", activity_entity_1.Activity)
], ActivityVersion.prototype, "activity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Object)
], ActivityVersion.prototype, "startDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Object)
], ActivityVersion.prototype, "finishDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], ActivityVersion.prototype, "duration", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], ActivityVersion.prototype, "isCritical", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], ActivityVersion.prototype, "totalFloat", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], ActivityVersion.prototype, "freeFloat", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ActivityVersion.prototype, "remarks", void 0);
exports.ActivityVersion = ActivityVersion = __decorate([
    (0, typeorm_1.Entity)()
], ActivityVersion);
//# sourceMappingURL=activity-version.entity.js.map