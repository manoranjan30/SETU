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
exports.ProjectsController = void 0;
const common_1 = require("@nestjs/common");
const project_assignment_service_1 = require("./project-assignment.service");
const permission_resolution_service_1 = require("./permission-resolution.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const project_context_guard_1 = require("./guards/project-context.guard");
const project_assignment_guard_1 = require("./guards/project-assignment.guard");
const eps_permission_guard_1 = require("./guards/eps-permission.guard");
let ProjectsController = class ProjectsController {
    assignmentService;
    permissionService;
    constructor(assignmentService, permissionService) {
        this.assignmentService = assignmentService;
        this.permissionService = permissionService;
    }
    async assignUser(projectId, body, req) {
        return this.assignmentService.assignUser(projectId, body.userId, body.roleId, body.scopeType, body.scopeNodeId, req.user.sub);
    }
    async getTeam(projectId) {
        return this.assignmentService.getProjectAssignments(projectId);
    }
    async removeUser(projectId, userId, req) {
        return this.assignmentService.removeUser(projectId, userId, req.user.sub);
    }
    async checkPermission(projectId, nodeId, req) {
        const permission = req.query.code;
        return this.permissionService.hasPermission(req.user.sub, permission, nodeId);
    }
};
exports.ProjectsController = ProjectsController;
__decorate([
    (0, common_1.Post)(':projectId/assign'),
    (0, common_1.UseGuards)(eps_permission_guard_1.EpsPermissionGuard),
    (0, eps_permission_guard_1.RequireEpsPermission)('TEAM.MANAGE', 'projectId'),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "assignUser", null);
__decorate([
    (0, common_1.Get)(':projectId/team'),
    (0, common_1.UseGuards)(eps_permission_guard_1.EpsPermissionGuard),
    (0, eps_permission_guard_1.RequireEpsPermission)('EPS.VIEW', 'projectId'),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "getTeam", null);
__decorate([
    (0, common_1.Delete)(':projectId/users/:userId'),
    (0, common_1.UseGuards)(eps_permission_guard_1.EpsPermissionGuard),
    (0, eps_permission_guard_1.RequireEpsPermission)('TEAM.MANAGE', 'projectId'),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('userId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "removeUser", null);
__decorate([
    (0, common_1.Get)(':projectId/check-permission/:nodeId'),
    __param(0, (0, common_1.Param)('projectId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('nodeId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Object]),
    __metadata("design:returntype", Promise)
], ProjectsController.prototype, "checkPermission", null);
exports.ProjectsController = ProjectsController = __decorate([
    (0, common_1.Controller)('projects'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, project_context_guard_1.ProjectContextGuard, project_assignment_guard_1.ProjectAssignmentGuard),
    __metadata("design:paramtypes", [project_assignment_service_1.ProjectAssignmentService,
        permission_resolution_service_1.PermissionResolutionService])
], ProjectsController);
//# sourceMappingURL=projects.controller.js.map