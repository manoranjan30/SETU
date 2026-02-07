import { Injectable, OnModuleInit } from '@nestjs/common';
import { UsersService } from './users/users.service';
import { RolesService } from './roles/roles.service';

import { PermissionsService } from './permissions/permissions.service';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(
    private usersService: UsersService,
    private rolesService: RolesService,
    private permissionsService: PermissionsService,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async onModuleInit() {
    await this.seed();
  }

  async seed() {
    // 1. Create Admin Role
    let adminRole = (await this.rolesService.findAll()).find(
      (r) => r.name === 'Admin',
    );
    if (!adminRole) {
      console.log('Seeding Admin Role...');
      // Fetch all permissions to give full access
      const allPermissions = await this.permissionsService.findAll();
      const allPermissionIds = allPermissions.map((p) => p.id);
      adminRole = await this.rolesService.create({
        name: 'Admin',
        permissionIds: allPermissionIds,
      });
    }

    // 2. Create Admin User
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
    } else {
      // Force update password to ensure it is correct
      console.log('Admin user exists. Resetting password to ensure validity.');
      await this.usersService.update(adminUser.id, { password: 'password123' });
      console.log('Admin password reset to: password123');
    }
  }
}
