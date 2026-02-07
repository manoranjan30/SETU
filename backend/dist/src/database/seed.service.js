"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var SeedService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeedService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const permission_entity_1 = require("../permissions/permission.entity");
const role_entity_1 = require("../roles/role.entity");
const user_entity_1 = require("../users/user.entity");
const bcrypt = __importStar(require("bcryptjs"));
let SeedService = SeedService_1 = class SeedService {
    permissionRepo;
    roleRepo;
    userRepo;
    logger = new common_1.Logger(SeedService_1.name);
    constructor(permissionRepo, roleRepo, userRepo) {
        this.permissionRepo = permissionRepo;
        this.roleRepo = roleRepo;
        this.userRepo = userRepo;
    }
    async onApplicationBootstrap() {
        await this.seedPermissions();
        await this.seedDefaultRoles();
        await this.seedDefaultUser();
    }
    async seedPermissions() {
        const PERMISSIONS = [
            { code: 'VIEW_DASHBOARD', name: 'View Dashboard', module: 'CORE' },
            { code: 'VIEW_PROJECTS', name: 'View Projects List', module: 'CORE' },
            { code: 'MANAGE_USERS', name: 'Manage System Users', module: 'ADMIN' },
            { code: 'MANAGE_ROLES', name: 'Manage System Roles', module: 'ADMIN' },
            { code: 'MANAGE_EPS', name: 'Manage EPS Structure', module: 'EPS' },
            { code: 'DESIGN.READ', name: 'View Drawings', module: 'DESIGN' },
            { code: 'DESIGN.UPLOAD', name: 'Upload Drawings', module: 'DESIGN' },
            { code: 'DESIGN.APPROVE', name: 'Approve Drawings (GFC)', module: 'DESIGN' },
            { code: 'PLANNING.READ', name: 'View Schedule', module: 'PLANNING' },
            { code: 'PLANNING.EDIT', name: 'Edit Schedule/WBS', module: 'PLANNING' },
            { code: 'PLANNING.BASELINE', name: 'Manage Baselines', module: 'PLANNING' },
            { code: 'BOQ.READ', name: 'View BOQ', module: 'BOQ' },
            { code: 'BOQ.MANAGE', name: 'Manage BOQ', module: 'BOQ' },
            { code: 'EXECUTION.READ', name: 'View Progress', module: 'EXECUTION' },
            { code: 'EXECUTION.UPDATE', name: 'Update Daily Progress', module: 'EXECUTION' },
            { code: 'QUALITY.READ', name: 'View Quality Records', module: 'QUALITY' },
            { code: 'QUALITY.MANAGE', name: 'Manage Quality Records', module: 'QUALITY' },
            { code: 'EHS.READ', name: 'View Safety Records', module: 'EHS' },
            { code: 'EHS.MANAGE', name: 'Manage Safety Records', module: 'EHS' },
            { code: 'LABOR.READ', name: 'View Labor Records', module: 'LABOR' },
            { code: 'LABOR.MANAGE', name: 'Manage Labor Records', module: 'LABOR' },
        ];
        for (const p of PERMISSIONS) {
            const exists = await this.permissionRepo.findOneBy({
                permissionCode: p.code,
            });
            if (!exists) {
                await this.permissionRepo.save(this.permissionRepo.create({
                    permissionCode: p.code,
                    permissionName: p.name,
                    moduleName: p.module,
                    description: p.name,
                    isSystem: true,
                }));
                this.logger.log(`Seeded permission: ${p.code}`);
            }
        }
    }
    async seedDefaultRoles() {
        let adminRole = await this.roleRepo.findOne({
            where: { name: 'Admin' },
            relations: ['permissions'],
        });
        const allPermissions = await this.permissionRepo.find();
        if (!adminRole) {
            adminRole = await this.roleRepo.save(this.roleRepo.create({
                name: 'Admin',
                description: 'System Administrator',
                permissions: allPermissions,
            }));
            this.logger.log('Seeded Admin Role');
        }
        else {
            adminRole.permissions = allPermissions;
            await this.roleRepo.save(adminRole);
            this.logger.log('Updated Admin Role Permissions');
        }
        let userRole = await this.roleRepo.findOne({
            where: { name: 'User' },
            relations: ['permissions'],
        });
        if (!userRole) {
            const userPermissions = allPermissions.filter((p) => ['VIEW_DASHBOARD', 'VIEW_PROJECTS', 'EXECUTION.READ', 'PLANNING.READ', 'BOQ.READ'].includes(p.permissionCode));
            userRole = await this.roleRepo.save(this.roleRepo.create({
                name: 'User',
                description: 'Standard User',
                permissions: userPermissions,
            }));
            this.logger.log('Seeded Standard User Role');
        }
        else {
            const userPermissions = allPermissions.filter((p) => ['VIEW_DASHBOARD', 'VIEW_PROJECTS', 'EXECUTION.READ', 'PLANNING.READ', 'BOQ.READ'].includes(p.permissionCode));
            userRole.permissions = userPermissions;
            await this.roleRepo.save(userRole);
            this.logger.log('Updated Standard User Role Permissions');
        }
    }
    async seedDefaultUser() {
        const adminUser = await this.userRepo.findOne({
            where: { username: 'admin' },
            relations: ['roles'],
        });
        const adminRole = await this.roleRepo.findOne({ where: { name: 'Admin' } });
        const salt = await bcrypt.genSalt(10);
        if (!adminUser) {
            const passwordHash = await bcrypt.hash('password123', salt);
            await this.userRepo.save(this.userRepo.create({
                username: 'admin',
                passwordHash,
                isActive: true,
                roles: adminRole ? [adminRole] : [],
            }));
            this.logger.log('Seeded Default Admin User');
        }
        const stdUser = await this.userRepo.findOne({
            where: { username: 'user' },
            relations: ['roles'],
        });
        const userRole = await this.roleRepo.findOne({ where: { name: 'User' } });
        if (!stdUser) {
            const passwordHash = await bcrypt.hash('password123', salt);
            await this.userRepo.save(this.userRepo.create({
                username: 'user',
                passwordHash,
                isActive: true,
                roles: userRole ? [userRole] : [],
            }));
            this.logger.log('Seeded Default Standard User');
        }
    }
};
exports.SeedService = SeedService;
exports.SeedService = SeedService = SeedService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(permission_entity_1.Permission)),
    __param(1, (0, typeorm_1.InjectRepository)(role_entity_1.Role)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], SeedService);
//# sourceMappingURL=seed.service.js.map