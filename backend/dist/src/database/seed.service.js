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
const drawing_category_entity_1 = require("../design/entities/drawing-category.entity");
const work_doc_template_entity_1 = require("../workdoc/entities/work-doc-template.entity");
const bcrypt = __importStar(require("bcryptjs"));
let SeedService = SeedService_1 = class SeedService {
    permissionRepo;
    roleRepo;
    userRepo;
    categoryRepo;
    templateRepo;
    logger = new common_1.Logger(SeedService_1.name);
    constructor(permissionRepo, roleRepo, userRepo, categoryRepo, templateRepo) {
        this.permissionRepo = permissionRepo;
        this.roleRepo = roleRepo;
        this.userRepo = userRepo;
        this.categoryRepo = categoryRepo;
        this.templateRepo = templateRepo;
    }
    async onApplicationBootstrap() {
        await this.seedPermissions();
        await this.seedDefaultRoles();
        await this.seedDefaultUser();
        await this.seedCategories();
        await this.seedTemplates();
    }
    async seedPermissions() {
        this.logger.log('Permissions seeding handled by PermissionsService');
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
            this.logger.log('Seeded Admin Role with ALL permissions');
        }
        else {
            adminRole.permissions = allPermissions;
            await this.roleRepo.save(adminRole);
            this.logger.log('Updated Admin Role with latest permissions');
        }
        let userRole = await this.roleRepo.findOne({
            where: { name: 'User' },
            relations: ['permissions'],
        });
        if (!userRole) {
            const userPermissions = allPermissions.filter((p) => [
                'VIEW_DASHBOARD',
                'VIEW_PROJECTS',
                'Execution.Entry.Read',
                'SCHEDULE.READ',
                'BOQ.Item.Read',
                'WBS.NODE.READ',
                'WBS.ACTIVITY.READ',
            ].includes(p.permissionCode));
            userRole = await this.roleRepo.save(this.roleRepo.create({
                name: 'User',
                description: 'Standard User',
                permissions: userPermissions,
            }));
            this.logger.log('Seeded Standard User Role');
        }
        else {
            const userPermissions = allPermissions.filter((p) => [
                'VIEW_DASHBOARD',
                'VIEW_PROJECTS',
                'Execution.Entry.Read',
                'SCHEDULE.READ',
                'BOQ.Item.Read',
                'WBS.NODE.READ',
                'WBS.ACTIVITY.READ',
            ].includes(p.permissionCode));
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
    async seedCategories() {
        const CATEGORIES = [
            { name: 'Architectural', code: 'ARCH' },
            { name: 'Structural', code: 'STR' },
            { name: 'Electrical', code: 'ELE' },
            { name: 'Plumbing', code: 'PLU' },
            { name: 'Fire Fighting', code: 'FIRE' },
            { name: 'MEP (Combined)', code: 'MEP' },
            { name: 'Interiors', code: 'INT' },
            { name: 'Landscape', code: 'LAND' },
        ];
        for (const cat of CATEGORIES) {
            const exists = await this.categoryRepo.findOne({
                where: { code: cat.code },
            });
            if (!exists) {
                await this.categoryRepo.save(this.categoryRepo.create(cat));
                this.logger.log(`Seeded Category: ${cat.name}`);
            }
        }
    }
    async seedTemplates() {
        const TEMPLATES = [
            {
                name: 'Starworth SAP Standard',
                description: 'Standard layout for Starworth Infrastructure Work Orders (SAP format)',
                config: {
                    vendorRegex: 'Vendor\\s*[:#]?\\s*(\\d+)',
                    woNumberRegex: 'Order\\s*No\\.?\\s*[:]?\\s*(\\d{10})',
                    dateRegex: 'Date\\s*[:]?\\s*(\\d{2}[./-]\\d{2}[./-]\\d{4})',
                    tableConfig: {
                        startMarker: 'ITEM DETAILS',
                        rowRegex: '^\\s*(\\d+\\.\\d+|\\d+)\\s+([\\d/ ]+)\\s+(.+?)\\s+([\\d,.]+)\\s+([a-zA-Z]{2,4})\\s+([\\d,.]+)\\s+([\\d,.]+)',
                        columnMapping: {
                            itemNo: 1,
                            code: 2,
                            description: 3,
                            qty: 4,
                            uom: 5,
                            rate: 6,
                            amount: 7,
                        },
                    },
                },
            },
        ];
        for (const t of TEMPLATES) {
            const exists = await this.templateRepo.findOne({
                where: { name: t.name },
            });
            if (!exists) {
                await this.templateRepo.save(this.templateRepo.create(t));
                this.logger.log(`Seeded Template: ${t.name}`);
            }
        }
    }
};
exports.SeedService = SeedService;
exports.SeedService = SeedService = SeedService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(permission_entity_1.Permission)),
    __param(1, (0, typeorm_1.InjectRepository)(role_entity_1.Role)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(3, (0, typeorm_1.InjectRepository)(drawing_category_entity_1.DrawingCategory)),
    __param(4, (0, typeorm_1.InjectRepository)(work_doc_template_entity_1.WorkDocTemplate)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], SeedService);
//# sourceMappingURL=seed.service.js.map