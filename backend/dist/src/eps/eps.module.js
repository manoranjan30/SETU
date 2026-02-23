"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EpsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const eps_controller_1 = require("./eps.controller");
const eps_service_1 = require("./eps.service");
const eps_entity_1 = require("./eps.entity");
const project_profile_entity_1 = require("./project-profile.entity");
const permissions_module_1 = require("../permissions/permissions.module");
const user_role_node_assignment_entity_1 = require("./user-role-node-assignment.entity");
const user_project_assignment_entity_1 = require("../projects/entities/user-project-assignment.entity");
const user_entity_1 = require("../users/user.entity");
const projects_module_1 = require("../projects/projects.module");
let EpsModule = class EpsModule {
};
exports.EpsModule = EpsModule;
exports.EpsModule = EpsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                eps_entity_1.EpsNode,
                project_profile_entity_1.ProjectProfile,
                user_role_node_assignment_entity_1.UserRoleNodeAssignment,
                user_entity_1.User,
                user_project_assignment_entity_1.UserProjectAssignment,
            ]),
            permissions_module_1.PermissionsModule,
            projects_module_1.ProjectsModule,
        ],
        controllers: [eps_controller_1.EpsController],
        providers: [eps_service_1.EpsService],
        exports: [eps_service_1.EpsService],
    })
], EpsModule);
//# sourceMappingURL=eps.module.js.map