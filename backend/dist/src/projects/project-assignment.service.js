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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectAssignmentService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_project_assignment_entity_1 = require("./entities/user-project-assignment.entity");
const project_team_audit_entity_1 = require("./entities/project-team-audit.entity");
const user_entity_1 = require("../users/user.entity");
const eps_entity_1 = require("../eps/eps.entity");
const role_entity_1 = require("../roles/role.entity");
let ProjectAssignmentService = class ProjectAssignmentService {
    assignmentRepo;
    auditRepo;
    userRepo;
    epsRepo;
    roleRepo;
    constructor(assignmentRepo, auditRepo, userRepo, epsRepo, roleRepo) {
        this.assignmentRepo = assignmentRepo;
        this.auditRepo = auditRepo;
        this.userRepo = userRepo;
        this.epsRepo = epsRepo;
        this.roleRepo = roleRepo;
    }
    async assignUser(projectId, userId, roleId, scopeType = user_project_assignment_entity_1.ProjectScopeType.FULL, scopeNodeId, performedByUserId) {
        const project = await this.epsRepo.findOneBy({ id: projectId });
        if (!project || project.type !== eps_entity_1.EpsNodeType.PROJECT) {
            throw new common_1.BadRequestException('Invalid Project ID or Node is not a Project');
        }
        const user = await this.userRepo.findOneBy({ id: userId });
        const role = await this.roleRepo.findOneBy({ id: roleId });
        if (!user || !role)
            throw new common_1.NotFoundException('User or Role not found');
        let assignment = await this.assignmentRepo.findOne({
            where: {
                user: { id: userId },
                project: { id: projectId },
            },
        });
        const oldDetails = assignment ? { ...assignment } : null;
        if (!assignment) {
            assignment = this.assignmentRepo.create({
                user,
                project,
                role,
                scopeType,
                scopeNode: scopeNodeId
                    ? { id: scopeNodeId }
                    : null,
                status: user_project_assignment_entity_1.AssignmentStatus.ACTIVE,
            });
        }
        else {
            assignment.role = role;
            assignment.scopeType = scopeType;
            assignment.scopeNode = scopeNodeId
                ? { id: scopeNodeId }
                : null;
            assignment.status = user_project_assignment_entity_1.AssignmentStatus.ACTIVE;
        }
        const saved = await this.assignmentRepo.save(assignment);
        if (performedByUserId) {
            await this.logAudit(projectId, oldDetails ? 'UPDATE_MEMBER' : 'ADD_MEMBER', userId, performedByUserId, {
                old: oldDetails
                    ? { roleId: oldDetails.roleId, scope: oldDetails.scopeType }
                    : null,
                new: { roleId: role.id, scope: scopeType },
            });
        }
        return saved;
    }
    async removeUser(projectId, userId, performedByUserId) {
        const assignment = await this.assignmentRepo.findOne({
            where: { user: { id: userId }, project: { id: projectId } },
        });
        if (assignment) {
            await this.assignmentRepo.remove(assignment);
            if (performedByUserId) {
                await this.logAudit(projectId, 'REMOVE_MEMBER', userId, performedByUserId, { previousRole: assignment.roleId });
            }
        }
    }
    async getProjectAssignments(projectId) {
        return this.assignmentRepo.find({
            where: { project: { id: projectId } },
            relations: ['user', 'role', 'scopeNode'],
        });
    }
    async getUserAssignments(userId) {
        return this.assignmentRepo.find({
            where: { user: { id: userId }, status: user_project_assignment_entity_1.AssignmentStatus.ACTIVE },
            relations: ['project', 'role', 'scopeNode'],
        });
    }
    async logAudit(projectId, action, targetId, performedBy, details) {
        await this.auditRepo.save(this.auditRepo.create({
            projectId,
            actionType: action,
            targetUserId: targetId,
            performedByUserId: performedBy,
            details,
        }));
    }
};
exports.ProjectAssignmentService = ProjectAssignmentService;
exports.ProjectAssignmentService = ProjectAssignmentService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_project_assignment_entity_1.UserProjectAssignment)),
    __param(1, (0, typeorm_1.InjectRepository)(project_team_audit_entity_1.ProjectTeamAudit)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(3, (0, typeorm_1.InjectRepository)(eps_entity_1.EpsNode)),
    __param(4, (0, typeorm_1.InjectRepository)(role_entity_1.Role)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], ProjectAssignmentService);
//# sourceMappingURL=project-assignment.service.js.map