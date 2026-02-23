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
exports.UserProjectAssignment = exports.AssignmentStatus = exports.ProjectScopeType = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("../../users/user.entity");
const eps_entity_1 = require("../../eps/eps.entity");
const role_entity_1 = require("../../roles/role.entity");
var ProjectScopeType;
(function (ProjectScopeType) {
    ProjectScopeType["FULL"] = "FULL";
    ProjectScopeType["LIMITED"] = "LIMITED";
})(ProjectScopeType || (exports.ProjectScopeType = ProjectScopeType = {}));
var AssignmentStatus;
(function (AssignmentStatus) {
    AssignmentStatus["ACTIVE"] = "ACTIVE";
    AssignmentStatus["INACTIVE"] = "INACTIVE";
})(AssignmentStatus || (exports.AssignmentStatus = AssignmentStatus = {}));
let UserProjectAssignment = class UserProjectAssignment {
    id;
    user;
    project;
    roles;
    scopeType;
    scopeNode;
    status;
    createdAt;
    updatedAt;
};
exports.UserProjectAssignment = UserProjectAssignment;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], UserProjectAssignment.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", user_entity_1.User)
], UserProjectAssignment.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => eps_entity_1.EpsNode, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'project_id' }),
    __metadata("design:type", eps_entity_1.EpsNode)
], UserProjectAssignment.prototype, "project", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => role_entity_1.Role),
    (0, typeorm_1.JoinTable)({
        name: 'user_project_assignment_roles',
        joinColumn: { name: 'assignment_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
    }),
    __metadata("design:type", Array)
], UserProjectAssignment.prototype, "roles", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ProjectScopeType,
        default: ProjectScopeType.FULL,
    }),
    __metadata("design:type", String)
], UserProjectAssignment.prototype, "scopeType", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => eps_entity_1.EpsNode, { nullable: true, onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'scope_node_id' }),
    __metadata("design:type", Object)
], UserProjectAssignment.prototype, "scopeNode", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: AssignmentStatus,
        default: AssignmentStatus.ACTIVE,
    }),
    __metadata("design:type", String)
], UserProjectAssignment.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], UserProjectAssignment.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], UserProjectAssignment.prototype, "updatedAt", void 0);
exports.UserProjectAssignment = UserProjectAssignment = __decorate([
    (0, typeorm_1.Entity)('user_project_assignment'),
    (0, typeorm_1.Index)(['status'])
], UserProjectAssignment);
//# sourceMappingURL=user-project-assignment.entity.js.map