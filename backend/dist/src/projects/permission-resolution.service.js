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
exports.PermissionResolutionService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_project_assignment_entity_1 = require("./entities/user-project-assignment.entity");
const eps_entity_1 = require("../eps/eps.entity");
let PermissionResolutionService = class PermissionResolutionService {
    assignmentRepo;
    epsRepo;
    constructor(assignmentRepo, epsRepo) {
        this.assignmentRepo = assignmentRepo;
        this.epsRepo = epsRepo;
    }
    async hasPermission(userId, permissionCode, nodeId) {
        const node = await this.epsRepo.findOne({
            where: { id: nodeId },
            relations: ['parent'],
        });
        if (!node)
            return false;
        const projectNode = await this.findProjectRoot(node);
        if (!projectNode)
            return false;
        const assignment = await this.assignmentRepo.findOne({
            where: {
                user: { id: userId },
                project: { id: projectNode.id },
            },
            relations: ['roles', 'roles.permissions', 'scopeNode'],
        });
        if (!assignment)
            return false;
        if (assignment.scopeType === user_project_assignment_entity_1.ProjectScopeType.LIMITED) {
            if (!assignment.scopeNode)
                return false;
            if (node.id !== assignment.scopeNode.id) {
                const isDescendant = await this.isDescendant(node, assignment.scopeNode.id);
                if (!isDescendant)
                    return false;
            }
        }
        const hasPerm = assignment.roles.some((role) => role.permissions.some((p) => p.permissionCode === permissionCode));
        return hasPerm;
    }
    async findProjectRoot(node) {
        if (node.type === eps_entity_1.EpsNodeType.PROJECT)
            return node;
        const ancestors = await this.epsRepo.findAncestors(node);
        return ancestors.find((a) => a.type === eps_entity_1.EpsNodeType.PROJECT) || null;
    }
    async isDescendant(targetNode, scopeNodeId) {
        const ancestors = await this.epsRepo.findAncestors(targetNode);
        return ancestors.some((a) => a.id === scopeNodeId);
    }
};
exports.PermissionResolutionService = PermissionResolutionService;
exports.PermissionResolutionService = PermissionResolutionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_project_assignment_entity_1.UserProjectAssignment)),
    __param(1, (0, typeorm_1.InjectRepository)(eps_entity_1.EpsNode)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.TreeRepository])
], PermissionResolutionService);
//# sourceMappingURL=permission-resolution.service.js.map