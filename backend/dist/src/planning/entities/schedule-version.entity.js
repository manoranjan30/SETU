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
exports.ScheduleVersion = exports.ScheduleVersionType = void 0;
const typeorm_1 = require("typeorm");
const activity_version_entity_1 = require("./activity-version.entity");
var ScheduleVersionType;
(function (ScheduleVersionType) {
    ScheduleVersionType["BASELINE"] = "BASELINE";
    ScheduleVersionType["REVISED"] = "REVISED";
    ScheduleVersionType["WORKING"] = "WORKING";
})(ScheduleVersionType || (exports.ScheduleVersionType = ScheduleVersionType = {}));
let ScheduleVersion = class ScheduleVersion {
    id;
    projectId;
    versionCode;
    versionType;
    sequenceNumber;
    parentVersionId;
    parentVersion;
    isActive;
    isLocked;
    remarks;
    createdBy;
    createdOn;
    updatedOn;
    activityVersions;
};
exports.ScheduleVersion = ScheduleVersion;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], ScheduleVersion.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], ScheduleVersion.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ScheduleVersion.prototype, "versionCode", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ScheduleVersionType,
        default: ScheduleVersionType.WORKING,
    }),
    __metadata("design:type", String)
], ScheduleVersion.prototype, "versionType", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], ScheduleVersion.prototype, "sequenceNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Object)
], ScheduleVersion.prototype, "parentVersionId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => ScheduleVersion, { onDelete: 'NO ACTION' }),
    (0, typeorm_1.JoinColumn)({ name: 'parentVersionId' }),
    __metadata("design:type", ScheduleVersion)
], ScheduleVersion.prototype, "parentVersion", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], ScheduleVersion.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], ScheduleVersion.prototype, "isLocked", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ScheduleVersion.prototype, "remarks", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ScheduleVersion.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ScheduleVersion.prototype, "createdOn", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ScheduleVersion.prototype, "updatedOn", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => activity_version_entity_1.ActivityVersion, (av) => av.scheduleVersion),
    __metadata("design:type", Array)
], ScheduleVersion.prototype, "activityVersions", void 0);
exports.ScheduleVersion = ScheduleVersion = __decorate([
    (0, typeorm_1.Entity)()
], ScheduleVersion);
//# sourceMappingURL=schedule-version.entity.js.map