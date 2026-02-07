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
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
const auth_controller_1 = require("./auth.controller");
const users_module_1 = require("../users/users.module");
const passport_1 = require("@nestjs/passport");
const jwt_1 = require("@nestjs/jwt");
const jwt_strategy_1 = require("./jwt.strategy");
const permissions_module_1 = require("../permissions/permissions.module");
const permissions_service_1 = require("../permissions/permissions.service");
const permission_entity_1 = require("../permissions/permission.entity");
const local_strategy_1 = require("./local.strategy");
let AuthModule = class AuthModule {
    permissionsService;
    constructor(permissionsService) {
        this.permissionsService = permissionsService;
    }
    async onModuleInit() {
        await this.permissionsService.registerPermissions([
            {
                permissionCode: 'AUTH.LOGIN',
                permissionName: 'Login',
                moduleName: 'AUTH',
                actionType: permission_entity_1.PermissionAction.READ,
                scopeLevel: permission_entity_1.PermissionScope.SYSTEM,
            },
            {
                permissionCode: 'AUTH.USER.CREATE',
                permissionName: 'Create User',
                moduleName: 'AUTH',
                actionType: permission_entity_1.PermissionAction.CREATE,
                scopeLevel: permission_entity_1.PermissionScope.SYSTEM,
            },
            {
                permissionCode: 'AUTH.USER.READ',
                permissionName: 'Read Users',
                moduleName: 'AUTH',
                actionType: permission_entity_1.PermissionAction.READ,
                scopeLevel: permission_entity_1.PermissionScope.SYSTEM,
            },
            {
                permissionCode: 'AUTH.USER.UPDATE',
                permissionName: 'Update User',
                moduleName: 'AUTH',
                actionType: permission_entity_1.PermissionAction.UPDATE,
                scopeLevel: permission_entity_1.PermissionScope.SYSTEM,
            },
            {
                permissionCode: 'AUTH.USER.DELETE',
                permissionName: 'Delete User',
                moduleName: 'AUTH',
                actionType: permission_entity_1.PermissionAction.DELETE,
                scopeLevel: permission_entity_1.PermissionScope.SYSTEM,
            },
            {
                permissionCode: 'AUTH.ROLE.CREATE',
                permissionName: 'Create Role',
                moduleName: 'AUTH',
                actionType: permission_entity_1.PermissionAction.CREATE,
                scopeLevel: permission_entity_1.PermissionScope.SYSTEM,
            },
            {
                permissionCode: 'AUTH.ROLE.READ',
                permissionName: 'Read Roles',
                moduleName: 'AUTH',
                actionType: permission_entity_1.PermissionAction.READ,
                scopeLevel: permission_entity_1.PermissionScope.SYSTEM,
            },
            {
                permissionCode: 'AUTH.ROLE.UPDATE',
                permissionName: 'Update Role',
                moduleName: 'AUTH',
                actionType: permission_entity_1.PermissionAction.UPDATE,
                scopeLevel: permission_entity_1.PermissionScope.SYSTEM,
            },
            {
                permissionCode: 'AUTH.ROLE.DELETE',
                permissionName: 'Delete Role',
                moduleName: 'AUTH',
                actionType: permission_entity_1.PermissionAction.DELETE,
                scopeLevel: permission_entity_1.PermissionScope.SYSTEM,
            },
        ]);
    }
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            users_module_1.UsersModule,
            passport_1.PassportModule,
            permissions_module_1.PermissionsModule,
            jwt_1.JwtModule.register({
                secret: process.env.JWT_SECRET || 'supersecretkey',
                signOptions: { expiresIn: '24h' },
            }),
        ],
        providers: [auth_service_1.AuthService, jwt_strategy_1.JwtStrategy, local_strategy_1.LocalStrategy],
        controllers: [auth_controller_1.AuthController],
        exports: [auth_service_1.AuthService],
    }),
    __metadata("design:paramtypes", [permissions_service_1.PermissionsService])
], AuthModule);
//# sourceMappingURL=auth.module.js.map