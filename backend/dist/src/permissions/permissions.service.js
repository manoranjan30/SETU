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
var PermissionsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const permission_entity_1 = require("./permission.entity");
let PermissionsService = PermissionsService_1 = class PermissionsService {
    permissionsRepository;
    logger = new common_1.Logger(PermissionsService_1.name);
    constructor(permissionsRepository) {
        this.permissionsRepository = permissionsRepository;
    }
    async onModuleInit() {
        await this.registerPermissions([]);
    }
    async findAll() {
        return this.permissionsRepository.find({
            order: { moduleName: 'ASC', permissionCode: 'ASC' },
        });
    }
    async registerPermissions(permissions) {
        const systemPermissions = [
            {
                permissionCode: 'EPS.NODE.CREATE',
                permissionName: 'Create EPS Node',
                moduleName: 'EPS',
                actionType: permission_entity_1.PermissionAction.CREATE,
            },
            {
                permissionCode: 'EPS.NODE.READ',
                permissionName: 'Read EPS Node',
                moduleName: 'EPS',
                actionType: permission_entity_1.PermissionAction.READ,
            },
            {
                permissionCode: 'EPS.NODE.UPDATE',
                permissionName: 'Update EPS Node',
                moduleName: 'EPS',
                actionType: permission_entity_1.PermissionAction.UPDATE,
            },
            {
                permissionCode: 'EPS.NODE.DELETE',
                permissionName: 'Delete EPS Node',
                moduleName: 'EPS',
                actionType: permission_entity_1.PermissionAction.DELETE,
            },
            {
                permissionCode: 'PROJECT.PROPERTIES.READ',
                permissionName: 'Read Project Properties',
                moduleName: 'PROJECT',
                actionType: permission_entity_1.PermissionAction.READ,
            },
            {
                permissionCode: 'PROJECT.PROPERTIES.UPDATE',
                permissionName: 'Update Project Properties',
                moduleName: 'PROJECT',
                actionType: permission_entity_1.PermissionAction.UPDATE,
            },
            {
                permissionCode: 'WBS.NODE.CREATE',
                permissionName: 'Create WBS Node',
                moduleName: 'WBS',
                actionType: permission_entity_1.PermissionAction.CREATE,
            },
            {
                permissionCode: 'WBS.NODE.READ',
                permissionName: 'Read WBS Node',
                moduleName: 'WBS',
                actionType: permission_entity_1.PermissionAction.READ,
            },
            {
                permissionCode: 'WBS.NODE.UPDATE',
                permissionName: 'Update WBS Node',
                moduleName: 'WBS',
                actionType: permission_entity_1.PermissionAction.UPDATE,
            },
            {
                permissionCode: 'WBS.NODE.DELETE',
                permissionName: 'Delete WBS Node',
                moduleName: 'WBS',
                actionType: permission_entity_1.PermissionAction.DELETE,
            },
            {
                permissionCode: 'WBS.ACTIVITY.CREATE',
                permissionName: 'Create Activity',
                moduleName: 'WBS',
                actionType: permission_entity_1.PermissionAction.CREATE,
            },
            {
                permissionCode: 'WBS.ACTIVITY.READ',
                permissionName: 'Read Activity',
                moduleName: 'WBS',
                actionType: permission_entity_1.PermissionAction.READ,
            },
            {
                permissionCode: 'WBS.ACTIVITY.UPDATE',
                permissionName: 'Update Activity',
                moduleName: 'WBS',
                actionType: permission_entity_1.PermissionAction.UPDATE,
            },
            {
                permissionCode: 'WBS.ACTIVITY.DELETE',
                permissionName: 'Delete Activity',
                moduleName: 'WBS',
                actionType: permission_entity_1.PermissionAction.DELETE,
            },
            {
                permissionCode: 'WBS.TEMPLATE.APPLY',
                permissionName: 'Apply WBS Template',
                moduleName: 'WBS',
                actionType: permission_entity_1.PermissionAction.CREATE,
            },
            {
                permissionCode: 'WBS.TEMPLATE.MANAGE',
                permissionName: 'Manage WBS Templates',
                moduleName: 'WBS',
                actionType: permission_entity_1.PermissionAction.SPECIAL,
            },
            {
                permissionCode: 'WBS.TEMPLATE.READ',
                permissionName: 'Read WBS Templates',
                moduleName: 'WBS',
                actionType: permission_entity_1.PermissionAction.READ,
            },
            {
                permissionCode: 'SCHEDULE.READ',
                permissionName: 'Read Schedule',
                moduleName: 'SCHEDULE',
                actionType: permission_entity_1.PermissionAction.READ,
            },
            {
                permissionCode: 'SCHEDULE.UPDATE',
                permissionName: 'Update/Calculate Schedule',
                moduleName: 'SCHEDULE',
                actionType: permission_entity_1.PermissionAction.UPDATE,
            },
            {
                permissionCode: 'SCHEDULE.IMPORT',
                permissionName: 'Import Schedule',
                moduleName: 'SCHEDULE',
                actionType: permission_entity_1.PermissionAction.CREATE,
            },
            {
                permissionCode: 'CALENDAR.CREATE',
                permissionName: 'Create Calendar',
                moduleName: 'CALENDAR',
                actionType: permission_entity_1.PermissionAction.CREATE,
            },
            {
                permissionCode: 'CALENDAR.READ',
                permissionName: 'Read Calendar',
                moduleName: 'CALENDAR',
                actionType: permission_entity_1.PermissionAction.READ,
            },
            {
                permissionCode: 'CALENDAR.UPDATE',
                permissionName: 'Update Calendar',
                moduleName: 'CALENDAR',
                actionType: permission_entity_1.PermissionAction.UPDATE,
            },
            {
                permissionCode: 'CALENDAR.DELETE',
                permissionName: 'Delete Calendar',
                moduleName: 'CALENDAR',
                actionType: permission_entity_1.PermissionAction.DELETE,
            },
            {
                permissionCode: 'RESOURCES.MASTER.CREATE',
                permissionName: 'Create Resource',
                moduleName: 'RESOURCES',
                actionType: permission_entity_1.PermissionAction.CREATE,
            },
            {
                permissionCode: 'RESOURCES.MASTER.READ',
                permissionName: 'Read Resource',
                moduleName: 'RESOURCES',
                actionType: permission_entity_1.PermissionAction.READ,
            },
            {
                permissionCode: 'RESOURCES.MASTER.UPDATE',
                permissionName: 'Update Resource',
                moduleName: 'RESOURCES',
                actionType: permission_entity_1.PermissionAction.UPDATE,
            },
            {
                permissionCode: 'RESOURCES.MASTER.DELETE',
                permissionName: 'Delete Resource',
                moduleName: 'RESOURCES',
                actionType: permission_entity_1.PermissionAction.DELETE,
            },
            {
                permissionCode: 'USER.MANAGEMENT.CREATE',
                permissionName: 'Create User',
                moduleName: 'ADMIN',
                actionType: permission_entity_1.PermissionAction.CREATE,
            },
            {
                permissionCode: 'USER.MANAGEMENT.READ',
                permissionName: 'Read Users',
                moduleName: 'ADMIN',
                actionType: permission_entity_1.PermissionAction.READ,
            },
            {
                permissionCode: 'USER.MANAGEMENT.UPDATE',
                permissionName: 'Update User',
                moduleName: 'ADMIN',
                actionType: permission_entity_1.PermissionAction.UPDATE,
            },
            {
                permissionCode: 'USER.MANAGEMENT.DELETE',
                permissionName: 'Delete User',
                moduleName: 'ADMIN',
                actionType: permission_entity_1.PermissionAction.DELETE,
            },
            {
                permissionCode: 'ROLE.MANAGEMENT.CREATE',
                permissionName: 'Create Role',
                moduleName: 'ADMIN',
                actionType: permission_entity_1.PermissionAction.CREATE,
            },
            {
                permissionCode: 'ROLE.MANAGEMENT.READ',
                permissionName: 'Read Roles',
                moduleName: 'ADMIN',
                actionType: permission_entity_1.PermissionAction.READ,
            },
            {
                permissionCode: 'ROLE.MANAGEMENT.UPDATE',
                permissionName: 'Update Role',
                moduleName: 'ADMIN',
                actionType: permission_entity_1.PermissionAction.UPDATE,
            },
            {
                permissionCode: 'ROLE.MANAGEMENT.DELETE',
                permissionName: 'Delete Role',
                moduleName: 'ADMIN',
                actionType: permission_entity_1.PermissionAction.DELETE,
            },
        ];
        for (const p of systemPermissions) {
            const exists = await this.permissionsRepository.findOne({
                where: { permissionCode: p.permissionCode },
            });
            if (!exists) {
                this.logger.log(`Registering System Permission: ${p.permissionCode}`);
                const newPerm = this.permissionsRepository.create({
                    ...p,
                    scopeLevel: permission_entity_1.PermissionScope.SYSTEM,
                    isSystem: true,
                    isActive: true,
                });
                await this.permissionsRepository.save(newPerm);
            }
        }
    }
};
exports.PermissionsService = PermissionsService;
exports.PermissionsService = PermissionsService = PermissionsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(permission_entity_1.Permission)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], PermissionsService);
//# sourceMappingURL=permissions.service.js.map