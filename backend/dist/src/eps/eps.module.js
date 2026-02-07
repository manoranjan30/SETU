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
exports.EpsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const eps_controller_1 = require("./eps.controller");
const eps_service_1 = require("./eps.service");
const eps_entity_1 = require("./eps.entity");
const project_profile_entity_1 = require("./project-profile.entity");
const permissions_module_1 = require("../permissions/permissions.module");
const permissions_service_1 = require("../permissions/permissions.service");
const permission_entity_1 = require("../permissions/permission.entity");
const user_role_node_assignment_entity_1 = require("./user-role-node-assignment.entity");
const user_project_assignment_entity_1 = require("../projects/entities/user-project-assignment.entity");
const user_entity_1 = require("../users/user.entity");
const projects_module_1 = require("../projects/projects.module");
let EpsModule = class EpsModule {
    permissionsService;
    constructor(permissionsService) {
        this.permissionsService = permissionsService;
    }
    async onModuleInit() {
        await this.permissionsService.registerPermissions([
            {
                permissionCode: 'EPS.VIEW',
                permissionName: 'View EPS',
                moduleName: 'EPS',
                actionType: permission_entity_1.PermissionAction.READ,
                scopeLevel: permission_entity_1.PermissionScope.COMPANY,
            },
            {
                permissionCode: 'EPS.NODE.CREATE',
                permissionName: 'Create Node',
                moduleName: 'EPS',
                actionType: permission_entity_1.PermissionAction.CREATE,
                scopeLevel: permission_entity_1.PermissionScope.COMPANY,
            },
            {
                permissionCode: 'EPS.NODE.UPDATE',
                permissionName: 'Update Node',
                moduleName: 'EPS',
                actionType: permission_entity_1.PermissionAction.UPDATE,
                scopeLevel: permission_entity_1.PermissionScope.COMPANY,
            },
            {
                permissionCode: 'EPS.NODE.DELETE',
                permissionName: 'Delete Node',
                moduleName: 'EPS',
                actionType: permission_entity_1.PermissionAction.DELETE,
                scopeLevel: permission_entity_1.PermissionScope.COMPANY,
            },
            {
                permissionCode: 'PROJECT.PROPERTIES.READ',
                permissionName: 'Read Properties',
                moduleName: 'PROJECT',
                actionType: permission_entity_1.PermissionAction.READ,
                scopeLevel: permission_entity_1.PermissionScope.PROJECT,
            },
            {
                permissionCode: 'PROJECT.PROPERTIES.UPDATE',
                permissionName: 'Update Properties',
                moduleName: 'PROJECT',
                actionType: permission_entity_1.PermissionAction.UPDATE,
                scopeLevel: permission_entity_1.PermissionScope.PROJECT,
            },
        ]);
    }
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
    }),
    __metadata("design:paramtypes", [permissions_service_1.PermissionsService])
], EpsModule);
//# sourceMappingURL=eps.module.js.map