import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { Role } from './role.entity';
import { ActionPreset } from './action-preset.entity';
import { RoleTemplate } from './role-template.entity';

import { PermissionsModule } from '../permissions/permissions.module';
import { RoleCatalogService } from './role-catalog.service';
import { RolePresetsController } from './role-presets.controller';
import { RoleTemplatesController } from './role-templates.controller';
import { Permission } from '../permissions/permission.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role, Permission, ActionPreset, RoleTemplate]),
    PermissionsModule,
  ],
  controllers: [RolesController, RolePresetsController, RoleTemplatesController],
  providers: [RolesService, RoleCatalogService],
  exports: [RolesService, RoleCatalogService],
})
export class RolesModule {}
