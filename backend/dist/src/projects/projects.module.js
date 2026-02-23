"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const user_project_assignment_entity_1 = require("./entities/user-project-assignment.entity");
const project_team_audit_entity_1 = require("./entities/project-team-audit.entity");
const user_entity_1 = require("../users/user.entity");
const eps_entity_1 = require("../eps/eps.entity");
const role_entity_1 = require("../roles/role.entity");
const project_assignment_service_1 = require("./project-assignment.service");
const permission_resolution_service_1 = require("./permission-resolution.service");
const projects_controller_1 = require("./projects.controller");
let ProjectsModule = class ProjectsModule {
};
exports.ProjectsModule = ProjectsModule;
exports.ProjectsModule = ProjectsModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                user_project_assignment_entity_1.UserProjectAssignment,
                project_team_audit_entity_1.ProjectTeamAudit,
                user_entity_1.User,
                eps_entity_1.EpsNode,
                role_entity_1.Role,
            ]),
        ],
        exports: [
            typeorm_1.TypeOrmModule,
            project_assignment_service_1.ProjectAssignmentService,
            permission_resolution_service_1.PermissionResolutionService,
        ],
        providers: [project_assignment_service_1.ProjectAssignmentService, permission_resolution_service_1.PermissionResolutionService],
        controllers: [projects_controller_1.ProjectsController],
    })
], ProjectsModule);
//# sourceMappingURL=projects.module.js.map