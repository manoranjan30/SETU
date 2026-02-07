import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Permission,
  PermissionAction,
  PermissionScope,
} from './permission.entity';
import { CreatePermissionDto } from './dto/create-permission.dto';

@Injectable()
export class PermissionsService implements OnModuleInit {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(
    @InjectRepository(Permission)
    private permissionsRepository: Repository<Permission>,
  ) {}

  async onModuleInit() {
    await this.registerPermissions([]);
  }

  async findAll(): Promise<Permission[]> {
    return this.permissionsRepository.find({
      order: { moduleName: 'ASC', permissionCode: 'ASC' },
    });
  }

  /**
   * Auto-registers a list of permissions.
   * Idempotent: Only creates if permissionCode doesn't exist.
   */
  async registerPermissions(permissions: CreatePermissionDto[]): Promise<void> {
    // Governance: Full list of System Permissions
    // We ignore the incoming argument 'permissions' for now or merge it,
    // but strictly we want to ensure THESE exist.
    const systemPermissions = [
      // EPS
      {
        permissionCode: 'EPS.NODE.CREATE',
        permissionName: 'Create EPS Node',
        moduleName: 'EPS',
        actionType: PermissionAction.CREATE,
      },
      {
        permissionCode: 'EPS.NODE.READ',
        permissionName: 'Read EPS Node',
        moduleName: 'EPS',
        actionType: PermissionAction.READ,
      },
      {
        permissionCode: 'EPS.NODE.UPDATE',
        permissionName: 'Update EPS Node',
        moduleName: 'EPS',
        actionType: PermissionAction.UPDATE,
      },
      {
        permissionCode: 'EPS.NODE.DELETE',
        permissionName: 'Delete EPS Node',
        moduleName: 'EPS',
        actionType: PermissionAction.DELETE,
      },

      // Project Properties
      {
        permissionCode: 'PROJECT.PROPERTIES.READ',
        permissionName: 'Read Project Properties',
        moduleName: 'PROJECT',
        actionType: PermissionAction.READ,
      },
      {
        permissionCode: 'PROJECT.PROPERTIES.UPDATE',
        permissionName: 'Update Project Properties',
        moduleName: 'PROJECT',
        actionType: PermissionAction.UPDATE,
      },

      // WBS
      {
        permissionCode: 'WBS.NODE.CREATE',
        permissionName: 'Create WBS Node',
        moduleName: 'WBS',
        actionType: PermissionAction.CREATE,
      },
      {
        permissionCode: 'WBS.NODE.READ',
        permissionName: 'Read WBS Node',
        moduleName: 'WBS',
        actionType: PermissionAction.READ,
      },
      {
        permissionCode: 'WBS.NODE.UPDATE',
        permissionName: 'Update WBS Node',
        moduleName: 'WBS',
        actionType: PermissionAction.UPDATE,
      },
      {
        permissionCode: 'WBS.NODE.DELETE',
        permissionName: 'Delete WBS Node',
        moduleName: 'WBS',
        actionType: PermissionAction.DELETE,
      },

      {
        permissionCode: 'WBS.ACTIVITY.CREATE',
        permissionName: 'Create Activity',
        moduleName: 'WBS',
        actionType: PermissionAction.CREATE,
      },
      {
        permissionCode: 'WBS.ACTIVITY.READ',
        permissionName: 'Read Activity',
        moduleName: 'WBS',
        actionType: PermissionAction.READ,
      },
      {
        permissionCode: 'WBS.ACTIVITY.UPDATE',
        permissionName: 'Update Activity',
        moduleName: 'WBS',
        actionType: PermissionAction.UPDATE,
      },
      {
        permissionCode: 'WBS.ACTIVITY.DELETE',
        permissionName: 'Delete Activity',
        moduleName: 'WBS',
        actionType: PermissionAction.DELETE,
      },

      // WBS Templates
      {
        permissionCode: 'WBS.TEMPLATE.APPLY',
        permissionName: 'Apply WBS Template',
        moduleName: 'WBS',
        actionType: PermissionAction.CREATE,
      },
      {
        permissionCode: 'WBS.TEMPLATE.MANAGE',
        permissionName: 'Manage WBS Templates',
        moduleName: 'WBS',
        actionType: PermissionAction.SPECIAL,
      },
      {
        permissionCode: 'WBS.TEMPLATE.READ',
        permissionName: 'Read WBS Templates',
        moduleName: 'WBS',
        actionType: PermissionAction.READ,
      },

      // Schedule & Calendar
      {
        permissionCode: 'SCHEDULE.READ',
        permissionName: 'Read Schedule',
        moduleName: 'SCHEDULE',
        actionType: PermissionAction.READ,
      },
      {
        permissionCode: 'SCHEDULE.UPDATE',
        permissionName: 'Update/Calculate Schedule',
        moduleName: 'SCHEDULE',
        actionType: PermissionAction.UPDATE,
      },
      {
        permissionCode: 'SCHEDULE.IMPORT',
        permissionName: 'Import Schedule',
        moduleName: 'SCHEDULE',
        actionType: PermissionAction.CREATE,
      },

      {
        permissionCode: 'CALENDAR.CREATE',
        permissionName: 'Create Calendar',
        moduleName: 'CALENDAR',
        actionType: PermissionAction.CREATE,
      },
      {
        permissionCode: 'CALENDAR.READ',
        permissionName: 'Read Calendar',
        moduleName: 'CALENDAR',
        actionType: PermissionAction.READ,
      },
      {
        permissionCode: 'CALENDAR.UPDATE',
        permissionName: 'Update Calendar',
        moduleName: 'CALENDAR',
        actionType: PermissionAction.UPDATE,
      },
      {
        permissionCode: 'CALENDAR.DELETE',
        permissionName: 'Delete Calendar',
        moduleName: 'CALENDAR',
        actionType: PermissionAction.DELETE,
      },

      // Resources
      {
        permissionCode: 'RESOURCES.MASTER.CREATE',
        permissionName: 'Create Resource',
        moduleName: 'RESOURCES',
        actionType: PermissionAction.CREATE,
      },
      {
        permissionCode: 'RESOURCES.MASTER.READ',
        permissionName: 'Read Resource',
        moduleName: 'RESOURCES',
        actionType: PermissionAction.READ,
      },
      {
        permissionCode: 'RESOURCES.MASTER.UPDATE',
        permissionName: 'Update Resource',
        moduleName: 'RESOURCES',
        actionType: PermissionAction.UPDATE,
      },
      {
        permissionCode: 'RESOURCES.MASTER.DELETE',
        permissionName: 'Delete Resource',
        moduleName: 'RESOURCES',
        actionType: PermissionAction.DELETE,
      },

      // User & Roles
      {
        permissionCode: 'USER.MANAGEMENT.CREATE',
        permissionName: 'Create User',
        moduleName: 'ADMIN',
        actionType: PermissionAction.CREATE,
      },
      {
        permissionCode: 'USER.MANAGEMENT.READ',
        permissionName: 'Read Users',
        moduleName: 'ADMIN',
        actionType: PermissionAction.READ,
      },
      {
        permissionCode: 'USER.MANAGEMENT.UPDATE',
        permissionName: 'Update User',
        moduleName: 'ADMIN',
        actionType: PermissionAction.UPDATE,
      },
      {
        permissionCode: 'USER.MANAGEMENT.DELETE',
        permissionName: 'Delete User',
        moduleName: 'ADMIN',
        actionType: PermissionAction.DELETE,
      },

      {
        permissionCode: 'ROLE.MANAGEMENT.CREATE',
        permissionName: 'Create Role',
        moduleName: 'ADMIN',
        actionType: PermissionAction.CREATE,
      },
      {
        permissionCode: 'ROLE.MANAGEMENT.READ',
        permissionName: 'Read Roles',
        moduleName: 'ADMIN',
        actionType: PermissionAction.READ,
      },
      {
        permissionCode: 'ROLE.MANAGEMENT.UPDATE',
        permissionName: 'Update Role',
        moduleName: 'ADMIN',
        actionType: PermissionAction.UPDATE,
      },
      {
        permissionCode: 'ROLE.MANAGEMENT.DELETE',
        permissionName: 'Delete Role',
        moduleName: 'ADMIN',
        actionType: PermissionAction.DELETE,
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
          scopeLevel: PermissionScope.SYSTEM, // Default to system, refined later if needed
          isSystem: true,
          isActive: true,
        } as unknown as Partial<Permission>); // Cast to avoid partial match issues
        await this.permissionsRepository.save(newPerm);
      }
    }
  }
}
