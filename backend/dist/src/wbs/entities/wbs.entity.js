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
exports.WbsNode = exports.WbsStatus = void 0;
const typeorm_1 = require("typeorm");
const eps_entity_1 = require("../../eps/eps.entity");
const user_entity_1 = require("../../users/user.entity");
const role_entity_1 = require("../../roles/role.entity");
var WbsStatus;
(function (WbsStatus) {
    WbsStatus["ACTIVE"] = "ACTIVE";
    WbsStatus["INACTIVE"] = "INACTIVE";
})(WbsStatus || (exports.WbsStatus = WbsStatus = {}));
const activity_entity_1 = require("./activity.entity");
let WbsNode = class WbsNode {
    id;
    projectId;
    project;
    parentId;
    parent;
    children;
    wbsCode;
    wbsName;
    wbsLevel;
    sequenceNo;
    discipline;
    isControlAccount;
    responsibleRoleId;
    responsibleRole;
    responsibleUserId;
    responsibleUser;
    status;
    startDate;
    finishDate;
    startDateActual;
    finishDateActual;
    startDateBaseline;
    finishDateBaseline;
    startDatePlanned;
    finishDatePlanned;
    duration;
    percentComplete;
    budgetedValue;
    actualValue;
    createdBy;
    createdOn;
    updatedOn;
    activities;
};
exports.WbsNode = WbsNode;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], WbsNode.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'project_id' }),
    __metadata("design:type", Number)
], WbsNode.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => eps_entity_1.EpsNode, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'project_id' }),
    __metadata("design:type", eps_entity_1.EpsNode)
], WbsNode.prototype, "project", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'parent_id', nullable: true }),
    __metadata("design:type", Object)
], WbsNode.prototype, "parentId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => WbsNode, (node) => node.children, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'parent_id' }),
    __metadata("design:type", WbsNode)
], WbsNode.prototype, "parent", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => WbsNode, (node) => node.parent),
    __metadata("design:type", Array)
], WbsNode.prototype, "children", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'wbs_code' }),
    __metadata("design:type", String)
], WbsNode.prototype, "wbsCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'wbs_name' }),
    __metadata("design:type", String)
], WbsNode.prototype, "wbsName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'wbs_level', default: 1 }),
    __metadata("design:type", Number)
], WbsNode.prototype, "wbsLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sequence_no', default: 0 }),
    __metadata("design:type", Number)
], WbsNode.prototype, "sequenceNo", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], WbsNode.prototype, "discipline", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_control_account', default: false }),
    __metadata("design:type", Boolean)
], WbsNode.prototype, "isControlAccount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'responsible_role_id', nullable: true }),
    __metadata("design:type", Object)
], WbsNode.prototype, "responsibleRoleId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => role_entity_1.Role, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'responsible_role_id' }),
    __metadata("design:type", role_entity_1.Role)
], WbsNode.prototype, "responsibleRole", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'responsible_user_id', nullable: true }),
    __metadata("design:type", Object)
], WbsNode.prototype, "responsibleUserId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'responsible_user_id' }),
    __metadata("design:type", user_entity_1.User)
], WbsNode.prototype, "responsibleUser", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: WbsStatus, default: WbsStatus.ACTIVE }),
    __metadata("design:type", String)
], WbsNode.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'start_date', type: 'date', nullable: true }),
    __metadata("design:type", Object)
], WbsNode.prototype, "startDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'finish_date', type: 'date', nullable: true }),
    __metadata("design:type", Object)
], WbsNode.prototype, "finishDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'start_date_actual', type: 'date', nullable: true }),
    __metadata("design:type", Object)
], WbsNode.prototype, "startDateActual", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'finish_date_actual', type: 'date', nullable: true }),
    __metadata("design:type", Object)
], WbsNode.prototype, "finishDateActual", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'start_date_baseline', type: 'date', nullable: true }),
    __metadata("design:type", Object)
], WbsNode.prototype, "startDateBaseline", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'finish_date_baseline', type: 'date', nullable: true }),
    __metadata("design:type", Object)
], WbsNode.prototype, "finishDateBaseline", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'start_date_planned', type: 'date', nullable: true }),
    __metadata("design:type", Object)
], WbsNode.prototype, "startDatePlanned", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'finish_date_planned', type: 'date', nullable: true }),
    __metadata("design:type", Object)
], WbsNode.prototype, "finishDatePlanned", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], WbsNode.prototype, "duration", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], WbsNode.prototype, "percentComplete", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], WbsNode.prototype, "budgetedValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], WbsNode.prototype, "actualValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', nullable: true }),
    __metadata("design:type", String)
], WbsNode.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_on' }),
    __metadata("design:type", Date)
], WbsNode.prototype, "createdOn", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_on' }),
    __metadata("design:type", Date)
], WbsNode.prototype, "updatedOn", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => activity_entity_1.Activity, (activity) => activity.wbsNode),
    __metadata("design:type", Array)
], WbsNode.prototype, "activities", void 0);
exports.WbsNode = WbsNode = __decorate([
    (0, typeorm_1.Entity)()
], WbsNode);
//# sourceMappingURL=wbs.entity.js.map