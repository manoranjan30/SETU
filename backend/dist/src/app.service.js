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
exports.AppService = void 0;
const common_1 = require("@nestjs/common");
const users_service_1 = require("./users/users.service");
const roles_service_1 = require("./roles/roles.service");
const permissions_service_1 = require("./permissions/permissions.service");
let AppService = class AppService {
    usersService;
    rolesService;
    permissionsService;
    constructor(usersService, rolesService, permissionsService) {
        this.usersService = usersService;
        this.rolesService = rolesService;
        this.permissionsService = permissionsService;
    }
    getHello() {
        return 'Hello World!';
    }
    async onModuleInit() {
        await this.seed();
    }
    async seed() {
        let adminRole = (await this.rolesService.findAll()).find((r) => r.name === 'Admin');
        if (!adminRole) {
            console.log('Seeding Admin Role...');
            const allPermissions = await this.permissionsService.findAll();
            const allPermissionIds = allPermissions.map((p) => p.id);
            adminRole = await this.rolesService.create({
                name: 'Admin',
                permissionIds: allPermissionIds,
            });
        }
        const adminUser = await this.usersService.findOne('admin');
        if (!adminUser) {
            console.log('Seeding Admin User...');
            await this.usersService.create({
                username: 'admin',
                password: 'password123',
                isActive: true,
                roles: [adminRole.id],
            });
            console.log('Admin User created: admin / password123');
        }
        else {
            console.log('Admin user exists. Resetting password to ensure validity.');
            await this.usersService.update(adminUser.id, { password: 'password123' });
            console.log('Admin password reset to: password123');
        }
    }
};
exports.AppService = AppService;
exports.AppService = AppService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        roles_service_1.RolesService,
        permissions_service_1.PermissionsService])
], AppService);
//# sourceMappingURL=app.service.js.map