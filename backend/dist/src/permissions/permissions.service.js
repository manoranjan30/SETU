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
const permission_registry_1 = require("../auth/permission-registry");
let PermissionsService = PermissionsService_1 = class PermissionsService {
    permissionsRepository;
    logger = new common_1.Logger(PermissionsService_1.name);
    constructor(permissionsRepository) {
        this.permissionsRepository = permissionsRepository;
    }
    async onModuleInit() {
        await this.migrateOldPermissionCodes();
        await this.registerAllPermissions();
    }
    async findAll() {
        return this.permissionsRepository.find({
            order: { moduleName: 'ASC', permissionCode: 'ASC' },
        });
    }
    async migrateOldPermissionCodes() {
        for (const [oldCode, newCode] of Object.entries(permission_registry_1.MIGRATION_MAP)) {
            const oldPerm = await this.permissionsRepository.findOne({
                where: { permissionCode: oldCode },
            });
            if (!oldPerm)
                continue;
            const newPerm = await this.permissionsRepository.findOne({
                where: { permissionCode: newCode },
            });
            if (newPerm) {
                this.logger.warn(`Migration: Both '${oldCode}' and '${newCode}' exist. Deactivating old.`);
                oldPerm.isActive = false;
                await this.permissionsRepository.save(oldPerm);
            }
            else {
                this.logger.log(`Migration: Renaming '${oldCode}' → '${newCode}'`);
                oldPerm.permissionCode = newCode;
                await this.permissionsRepository.save(oldPerm);
            }
        }
    }
    async registerAllPermissions() {
        let created = 0;
        for (const def of permission_registry_1.ALL_PERMISSIONS) {
            const exists = await this.permissionsRepository.findOne({
                where: { permissionCode: def.code },
            });
            if (!exists) {
                this.logger.log(`Registering Permission: ${def.code}`);
                const newPerm = this.permissionsRepository.create({
                    permissionCode: def.code,
                    permissionName: def.name,
                    moduleName: def.module,
                    actionType: def.action,
                    scopeLevel: def.scope ?? permission_entity_1.PermissionScope.PROJECT,
                    isSystem: true,
                    isActive: true,
                });
                await this.permissionsRepository.save(newPerm);
                created++;
            }
        }
        if (created > 0) {
            this.logger.log(`Registered ${created} new permissions from registry.`);
        }
        this.logger.log(`Permission Registry: ${permission_registry_1.ALL_PERMISSIONS.length} total defined, ${created} newly created.`);
    }
};
exports.PermissionsService = PermissionsService;
exports.PermissionsService = PermissionsService = PermissionsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(permission_entity_1.Permission)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], PermissionsService);
//# sourceMappingURL=permissions.service.js.map