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
exports.ProjectTeamAudit = void 0;
const typeorm_1 = require("typeorm");
let ProjectTeamAudit = class ProjectTeamAudit {
    id;
    projectId;
    actionType;
    performedByUserId;
    targetUserId;
    details;
    performedAt;
};
exports.ProjectTeamAudit = ProjectTeamAudit;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ProjectTeamAudit.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'project_id', nullable: true }),
    __metadata("design:type", Number)
], ProjectTeamAudit.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'action_type', nullable: true }),
    __metadata("design:type", String)
], ProjectTeamAudit.prototype, "actionType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'performed_by_user_id', nullable: true }),
    __metadata("design:type", Number)
], ProjectTeamAudit.prototype, "performedByUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'target_user_id', nullable: true }),
    __metadata("design:type", Number)
], ProjectTeamAudit.prototype, "targetUserId", void 0);
__decorate([
    (0, typeorm_1.Column)('jsonb', { nullable: true }),
    __metadata("design:type", Object)
], ProjectTeamAudit.prototype, "details", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'performed_at' }),
    __metadata("design:type", Date)
], ProjectTeamAudit.prototype, "performedAt", void 0);
exports.ProjectTeamAudit = ProjectTeamAudit = __decorate([
    (0, typeorm_1.Entity)('project_team_audit')
], ProjectTeamAudit);
//# sourceMappingURL=project-team-audit.entity.js.map