import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EpsController } from './eps.controller';

import { EpsService } from './eps.service';
import { EpsNode } from './eps.entity';
import { ProjectProfile } from './project-profile.entity';
import { PermissionsModule } from '../permissions/permissions.module';
import { PermissionsService } from '../permissions/permissions.service';
import {
  PermissionAction,
  PermissionScope,
} from '../permissions/permission.entity';
import { UserRoleNodeAssignment } from './user-role-node-assignment.entity';
import { UserProjectAssignment } from '../projects/entities/user-project-assignment.entity';
import { PermissionResolutionService } from '../projects/permission-resolution.service';
import { User } from '../users/user.entity';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EpsNode,
      ProjectProfile,
      UserRoleNodeAssignment,
      User,
      UserProjectAssignment,
    ]),
    PermissionsModule,
    ProjectsModule,
  ],
  controllers: [EpsController],
  providers: [EpsService],
  exports: [EpsService],
})
export class EpsModule implements OnModuleInit {
  constructor(private permissionsService: PermissionsService) {}

  async onModuleInit() {
    await this.permissionsService.registerPermissions([
      {
        permissionCode: 'EPS.VIEW',
        permissionName: 'View EPS',
        moduleName: 'EPS',
        actionType: PermissionAction.READ,
        scopeLevel: PermissionScope.COMPANY,
      },
      {
        permissionCode: 'EPS.NODE.CREATE',
        permissionName: 'Create Node',
        moduleName: 'EPS',
        actionType: PermissionAction.CREATE,
        scopeLevel: PermissionScope.COMPANY,
      },
      {
        permissionCode: 'EPS.NODE.UPDATE',
        permissionName: 'Update Node',
        moduleName: 'EPS',
        actionType: PermissionAction.UPDATE,
        scopeLevel: PermissionScope.COMPANY,
      },
      {
        permissionCode: 'EPS.NODE.DELETE',
        permissionName: 'Delete Node',
        moduleName: 'EPS',
        actionType: PermissionAction.DELETE,
        scopeLevel: PermissionScope.COMPANY,
      },
      {
        permissionCode: 'PROJECT.PROPERTIES.READ',
        permissionName: 'Read Properties',
        moduleName: 'PROJECT',
        actionType: PermissionAction.READ,
        scopeLevel: PermissionScope.PROJECT,
      },
      {
        permissionCode: 'PROJECT.PROPERTIES.UPDATE',
        permissionName: 'Update Properties',
        moduleName: 'PROJECT',
        actionType: PermissionAction.UPDATE,
        scopeLevel: PermissionScope.PROJECT,
      },
    ]);
  }
}
