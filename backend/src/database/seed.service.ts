import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../permissions/permission.entity';
import { Role } from '../roles/role.entity';
import { User } from '../users/user.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(Permission)
    private permissionRepo: Repository<Permission>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) { }

  async onApplicationBootstrap() {
    await this.seedPermissions();
    await this.seedDefaultRoles();
    await this.seedDefaultUser();
  }

  private async seedPermissions() {
    const PERMISSIONS = [
      // Core
      { code: 'VIEW_DASHBOARD', name: 'View Dashboard', module: 'CORE' },
      { code: 'VIEW_PROJECTS', name: 'View Projects List', module: 'CORE' },

      // Admin
      { code: 'MANAGE_USERS', name: 'Manage System Users', module: 'ADMIN' },
      { code: 'MANAGE_ROLES', name: 'Manage System Roles', module: 'ADMIN' },

      // EPS
      { code: 'MANAGE_EPS', name: 'Manage EPS Structure', module: 'EPS' },

      // Design
      { code: 'DESIGN.READ', name: 'View Drawings', module: 'DESIGN' },
      { code: 'DESIGN.UPLOAD', name: 'Upload Drawings', module: 'DESIGN' },
      { code: 'DESIGN.APPROVE', name: 'Approve Drawings (GFC)', module: 'DESIGN' },

      // Planning
      { code: 'PLANNING.READ', name: 'View Schedule', module: 'PLANNING' },
      { code: 'PLANNING.EDIT', name: 'Edit Schedule/WBS', module: 'PLANNING' },
      { code: 'PLANNING.BASELINE', name: 'Manage Baselines', module: 'PLANNING' },

      // BOQ
      { code: 'BOQ.READ', name: 'View BOQ', module: 'BOQ' },
      { code: 'BOQ.MANAGE', name: 'Manage BOQ', module: 'BOQ' },

      // Execution
      { code: 'EXECUTION.READ', name: 'View Progress', module: 'EXECUTION' },
      { code: 'EXECUTION.UPDATE', name: 'Update Daily Progress', module: 'EXECUTION' },

      // Quality
      { code: 'QUALITY.READ', name: 'View Quality Records', module: 'QUALITY' },
      { code: 'QUALITY.MANAGE', name: 'Manage Quality Records', module: 'QUALITY' },

      // EHS
      { code: 'EHS.READ', name: 'View Safety Records', module: 'EHS' },
      { code: 'EHS.MANAGE', name: 'Manage Safety Records', module: 'EHS' },

      // Labor
      { code: 'LABOR.READ', name: 'View Labor Records', module: 'LABOR' },
      { code: 'LABOR.MANAGE', name: 'Manage Labor Records', module: 'LABOR' },
    ];

    for (const p of PERMISSIONS) {
      const exists = await this.permissionRepo.findOneBy({
        permissionCode: p.code,
      });
      if (!exists) {
        // Must provide all required columns: permissionCode, permissionName, moduleName, scopeLevel(default), actionType(default)
        await this.permissionRepo.save(
          this.permissionRepo.create({
            permissionCode: p.code,
            permissionName: p.name,
            moduleName: p.module,
            description: p.name,
            isSystem: true,
          }),
        );
        this.logger.log(`Seeded permission: ${p.code}`);
      }
    }
  }

  private async seedDefaultRoles() {
    // Ensure Admin role exists
    let adminRole = await this.roleRepo.findOne({
      where: { name: 'Admin' },
      relations: ['permissions'],
    });
    const allPermissions = await this.permissionRepo.find();

    if (!adminRole) {
      adminRole = await this.roleRepo.save(
        this.roleRepo.create({
          name: 'Admin',
          description: 'System Administrator',
          permissions: allPermissions,
        }),
      );
      this.logger.log('Seeded Admin Role');
    } else {
      adminRole.permissions = allPermissions;
      await this.roleRepo.save(adminRole);
      this.logger.log('Updated Admin Role Permissions');
    }

    // Ensure Standard User role exists
    let userRole = await this.roleRepo.findOne({
      where: { name: 'User' },
      relations: ['permissions'],
    });
    if (!userRole) {
      // Assign basic permissions
      const userPermissions = allPermissions.filter((p) =>
        ['VIEW_DASHBOARD', 'VIEW_PROJECTS', 'EXECUTION.READ', 'PLANNING.READ', 'BOQ.READ'].includes(
          p.permissionCode,
        ),
      );
      userRole = await this.roleRepo.save(
        this.roleRepo.create({
          name: 'User',
          description: 'Standard User',
          permissions: userPermissions,
        }),
      );
      this.logger.log('Seeded Standard User Role');
    } else {
      // UPDATE existing User role permissions
      const userPermissions = allPermissions.filter((p) =>
        ['VIEW_DASHBOARD', 'VIEW_PROJECTS', 'EXECUTION.READ', 'PLANNING.READ', 'BOQ.READ'].includes(
          p.permissionCode,
        ),
      );
      userRole.permissions = userPermissions;
      await this.roleRepo.save(userRole);
      this.logger.log('Updated Standard User Role Permissions');
    }
  }

  private async seedDefaultUser() {
    // Seed Admin
    const adminUser = await this.userRepo.findOne({
      where: { username: 'admin' },
      relations: ['roles'],
    });
    const adminRole = await this.roleRepo.findOne({ where: { name: 'Admin' } });
    const salt = await bcrypt.genSalt(10);

    if (!adminUser) {
      const passwordHash = await bcrypt.hash('password123', salt);
      await this.userRepo.save(
        this.userRepo.create({
          username: 'admin',
          passwordHash,
          isActive: true,
          roles: adminRole ? [adminRole] : [],
        }),
      );
      this.logger.log('Seeded Default Admin User');
    }

    // Seed Standard User
    const stdUser = await this.userRepo.findOne({
      where: { username: 'user' },
      relations: ['roles'],
    });
    const userRole = await this.roleRepo.findOne({ where: { name: 'User' } });

    if (!stdUser) {
      const passwordHash = await bcrypt.hash('password123', salt);
      await this.userRepo.save(
        this.userRepo.create({
          username: 'user',
          passwordHash,
          isActive: true,
          roles: userRole ? [userRole] : [],
        }),
      );
      this.logger.log('Seeded Default Standard User');
    }
  }
}
