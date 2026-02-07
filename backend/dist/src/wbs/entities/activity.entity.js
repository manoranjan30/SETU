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
exports.Activity = exports.ActivityStatus = exports.ActivityType = void 0;
const typeorm_1 = require("typeorm");
const wbs_entity_1 = require("./wbs.entity");
const activity_schedule_entity_1 = require("./activity-schedule.entity");
var ActivityType;
(function (ActivityType) {
    ActivityType["TASK"] = "TASK";
    ActivityType["MILESTONE"] = "MILESTONE";
})(ActivityType || (exports.ActivityType = ActivityType = {}));
var ActivityStatus;
(function (ActivityStatus) {
    ActivityStatus["NOT_STARTED"] = "NOT_STARTED";
    ActivityStatus["IN_PROGRESS"] = "IN_PROGRESS";
    ActivityStatus["COMPLETED"] = "COMPLETED";
})(ActivityStatus || (exports.ActivityStatus = ActivityStatus = {}));
let Activity = class Activity {
    id;
    projectId;
    wbsNode;
    activityCode;
    activityName;
    activityType;
    status;
    durationPlanned;
    durationActual;
    startDatePlanned;
    finishDatePlanned;
    startDateBaseline;
    finishDateBaseline;
    startDateMSP;
    finishDateMSP;
    startDateActual;
    finishDateActual;
    isMilestone;
    percentComplete;
    budgetedValue;
    actualValue;
    responsibleRoleId;
    responsibleUserId;
    createdOn;
    createdBy;
    schedule;
    masterActivityId;
    masterActivity;
};
exports.Activity = Activity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Activity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], Activity.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => wbs_entity_1.WbsNode, (node) => node.activities, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'wbs_node_id' }),
    __metadata("design:type", wbs_entity_1.WbsNode)
], Activity.prototype, "wbsNode", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Activity.prototype, "activityCode", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Activity.prototype, "activityName", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ActivityType,
        default: ActivityType.TASK,
    }),
    __metadata("design:type", String)
], Activity.prototype, "activityType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ActivityStatus,
        default: ActivityStatus.NOT_STARTED,
    }),
    __metadata("design:type", String)
], Activity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Activity.prototype, "durationPlanned", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], Activity.prototype, "durationActual", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Object)
], Activity.prototype, "startDatePlanned", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Object)
], Activity.prototype, "finishDatePlanned", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Object)
], Activity.prototype, "startDateBaseline", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Object)
], Activity.prototype, "finishDateBaseline", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true, name: 'start_date_msp' }),
    __metadata("design:type", Object)
], Activity.prototype, "startDateMSP", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true, name: 'finish_date_msp' }),
    __metadata("design:type", Object)
], Activity.prototype, "finishDateMSP", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Object)
], Activity.prototype, "startDateActual", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Object)
], Activity.prototype, "finishDateActual", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], Activity.prototype, "isMilestone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Activity.prototype, "percentComplete", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Activity.prototype, "budgetedValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Activity.prototype, "actualValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Activity.prototype, "responsibleRoleId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Activity.prototype, "responsibleUserId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Activity.prototype, "createdOn", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Activity.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => activity_schedule_entity_1.ActivitySchedule, (schedule) => schedule.activity),
    __metadata("design:type", activity_schedule_entity_1.ActivitySchedule)
], Activity.prototype, "schedule", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Activity.prototype, "masterActivityId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Activity, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'masterActivityId' }),
    __metadata("design:type", Activity)
], Activity.prototype, "masterActivity", void 0);
exports.Activity = Activity = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Unique)(['projectId', 'activityCode'])
], Activity);
//# sourceMappingURL=activity.entity.js.map