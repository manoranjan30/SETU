import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission, PermissionScope } from './permission.entity';
import { ALL_PERMISSIONS, MIGRATION_MAP } from '../auth/permission-registry';

@Injectable()
export class PermissionsService implements OnModuleInit {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(
    @InjectRepository(Permission)
    private permissionsRepository: Repository<Permission>,
  ) {}

  async onModuleInit() {
    await this.migrateOldPermissionCodes();
    await this.registerAllPermissions();
  }

  async findAll(): Promise<Permission[]> {
    return this.permissionsRepository.find({
      order: { moduleName: 'ASC', permissionCode: 'ASC' },
    });
  }

  /**
   * Phase 1: Migrate old permission codes to new standardized ALL CAPS codes.
   * This preserves role assignments since they reference permission ID, not code.
   * Idempotent: only renames if old code exists and new code doesn't.
   */
  private async migrateOldPermissionCodes(): Promise<void> {
    for (const [oldCode, newCode] of Object.entries(MIGRATION_MAP)) {
      const oldPerm = await this.permissionsRepository.findOne({
        where: { permissionCode: oldCode },
      });

      if (!oldPerm) continue; // Old code doesn't exist, nothing to migrate

      const newPerm = await this.permissionsRepository.findOne({
        where: { permissionCode: newCode },
      });

      if (newPerm) {
        // New code already exists — old record is orphaned, deactivate it
        this.logger.warn(
          `Migration: Both '${oldCode}' and '${newCode}' exist. Deactivating old.`,
        );
        oldPerm.isActive = false;
        await this.permissionsRepository.save(oldPerm);
      } else {
        // Rename in place — preserves all role_permission foreign keys
        this.logger.log(`Migration: Renaming '${oldCode}' → '${newCode}'`);
        oldPerm.permissionCode = newCode;
        await this.permissionsRepository.save(oldPerm);
      }
    }
  }

  /**
   * Phase 2: Register all permissions from the central registry.
   * Idempotent: only creates if permissionCode doesn't already exist.
   */
  private async registerAllPermissions(): Promise<void> {
    let created = 0;

    for (const def of ALL_PERMISSIONS) {
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
          scopeLevel: def.scope ?? PermissionScope.PROJECT,
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

    this.logger.log(
      `Permission Registry: ${ALL_PERMISSIONS.length} total defined, ${created} newly created.`,
    );
  }
}
