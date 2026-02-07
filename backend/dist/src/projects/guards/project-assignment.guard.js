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
exports.ProjectAssignmentGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const project_assignment_service_1 = require("../project-assignment.service");
let ProjectAssignmentGuard = class ProjectAssignmentGuard {
    assignmentService;
    reflector;
    constructor(assignmentService, reflector) {
        this.assignmentService = assignmentService;
        this.reflector = reflector;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        let projectId = request.projectContext?.projectId;
        if (!projectId && request.params && request.params.projectId) {
            projectId = Number(request.params.projectId);
        }
        if (!user || !projectId) {
            console.warn(`[ProjectAssignmentGuard] Failed. User: ${!!user}, ProjectId: ${projectId}`);
            if (!projectId)
                console.warn(`[ProjectAssignmentGuard] Params:`, request.params);
            return false;
        }
        if (user.roles?.includes('Admin') || user.role === 'Admin') {
            return true;
        }
        const assignments = await this.assignmentService.getUserAssignments(user.userId);
        const hasAssignment = assignments.some((a) => a.projectId === projectId);
        if (!hasAssignment) {
            console.log(`[ProjectAssignmentGuard] User ${user.userId} NOT assigned to Project ${projectId}`);
            throw new common_1.ForbiddenException(`User is not assigned to Project ${projectId}`);
        }
        return true;
    }
};
exports.ProjectAssignmentGuard = ProjectAssignmentGuard;
exports.ProjectAssignmentGuard = ProjectAssignmentGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [project_assignment_service_1.ProjectAssignmentService,
        core_1.Reflector])
], ProjectAssignmentGuard);
//# sourceMappingURL=project-assignment.guard.js.map