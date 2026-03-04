import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../permissions/permission.entity';
import { Role } from '../roles/role.entity';
import { User } from '../users/user.entity';
import { DrawingCategory } from '../design/entities/drawing-category.entity';
import { WorkDocTemplate } from '../workdoc/entities/work-doc-template.entity';
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
    @InjectRepository(DrawingCategory)
    private categoryRepo: Repository<DrawingCategory>,
    @InjectRepository(WorkDocTemplate)
    private templateRepo: Repository<WorkDocTemplate>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedPermissions();
    await this.seedDefaultRoles();
    await this.seedDefaultUser();
    await this.seedCategories();
    await this.seedTemplates();
  }

  private async seedPermissions() {
    // Permissions are now handled by PermissionsService on module init
    // This function is kept for backward compatibility if needed, or can be removed.
    this.logger.log('Permissions seeding handled by PermissionsService');
  }

  private async seedDefaultRoles() {
    // Ensure Admin role exists and has ALL permissions
    let adminRole = await this.roleRepo.findOne({
      where: { name: 'Admin' },
      relations: ['permissions'],
    });

    // Re-fetch all permissions from DB to ensure we have the seed ones
    const allPermissions = await this.permissionRepo.find();

    if (!adminRole) {
      adminRole = await this.roleRepo.save(
        this.roleRepo.create({
          name: 'Admin',
          description: 'System Administrator',
          permissions: allPermissions,
        }),
      );
      this.logger.log('Seeded Admin Role with ALL permissions');
    } else {
      // Always update Admin to have ALL permissions (auto-grant new ones)
      adminRole.permissions = allPermissions;
      await this.roleRepo.save(adminRole);
      this.logger.log('Updated Admin Role with latest permissions');
    }

    // Ensure Standard User role exists
    let userRole = await this.roleRepo.findOne({
      where: { name: 'User' },
      relations: ['permissions'],
    });
    if (!userRole) {
      // Assign basic permissions
      const userPermissions = allPermissions.filter((p) =>
        [
          'VIEW_DASHBOARD',
          'VIEW_PROJECTS',
          'Execution.Entry.Read',
          'SCHEDULE.READ',
          'BOQ.Item.Read',
          'WBS.NODE.READ',
          'WBS.ACTIVITY.READ',
        ].includes(p.permissionCode),
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
        [
          'VIEW_DASHBOARD',
          'VIEW_PROJECTS',
          'Execution.Entry.Read',
          'SCHEDULE.READ',
          'BOQ.Item.Read',
          'WBS.NODE.READ',
          'WBS.ACTIVITY.READ',
        ].includes(p.permissionCode),
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

  private async seedCategories() {
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

  private async seedTemplates() {
    const TEMPLATES = [
      {
        name: 'Starworth SAP Standard',
        description:
          'Standard layout for Starworth Infrastructure Work Orders (SAP format)',
        config: {
          vendorRegex: 'Vendor\\s*[:#]?\\s*(\\d+)',
          woNumberRegex: 'Order\\s*No\\.?\\s*[:]?\\s*(\\d{10})',
          dateRegex: 'Date\\s*[:]?\\s*(\\d{2}[./-]\\d{2}[./-]\\d{4})',
          tableConfig: {
            startMarker: 'ITEM DETAILS',
            rowRegex:
              '^\\s*(\\d+\\.\\d+|\\d+)\\s+([\\d/ ]+)\\s+(.+?)\\s+([\\d,.]+)\\s+([a-zA-Z]{2,4})\\s+([\\d,.]+)\\s+([\\d,.]+)',
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
}
