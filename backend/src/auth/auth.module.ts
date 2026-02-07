import { Module, OnModuleInit } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { PermissionsModule } from '../permissions/permissions.module';
import { PermissionsService } from '../permissions/permissions.service';
import {
  PermissionAction,
  PermissionScope,
} from '../permissions/permission.entity';
import { LocalStrategy } from './local.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    PermissionsModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'supersecretkey',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  providers: [AuthService, JwtStrategy, LocalStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule implements OnModuleInit {
  constructor(private permissionsService: PermissionsService) {}

  async onModuleInit() {
    await this.permissionsService.registerPermissions([
      {
        permissionCode: 'AUTH.LOGIN',
        permissionName: 'Login',
        moduleName: 'AUTH',
        actionType: PermissionAction.READ,
        scopeLevel: PermissionScope.SYSTEM,
      },
      {
        permissionCode: 'AUTH.USER.CREATE',
        permissionName: 'Create User',
        moduleName: 'AUTH',
        actionType: PermissionAction.CREATE,
        scopeLevel: PermissionScope.SYSTEM,
      },
      {
        permissionCode: 'AUTH.USER.READ',
        permissionName: 'Read Users',
        moduleName: 'AUTH',
        actionType: PermissionAction.READ,
        scopeLevel: PermissionScope.SYSTEM,
      },
      {
        permissionCode: 'AUTH.USER.UPDATE',
        permissionName: 'Update User',
        moduleName: 'AUTH',
        actionType: PermissionAction.UPDATE,
        scopeLevel: PermissionScope.SYSTEM,
      },
      {
        permissionCode: 'AUTH.USER.DELETE',
        permissionName: 'Delete User',
        moduleName: 'AUTH',
        actionType: PermissionAction.DELETE,
        scopeLevel: PermissionScope.SYSTEM,
      },
      {
        permissionCode: 'AUTH.ROLE.CREATE',
        permissionName: 'Create Role',
        moduleName: 'AUTH',
        actionType: PermissionAction.CREATE,
        scopeLevel: PermissionScope.SYSTEM,
      },
      {
        permissionCode: 'AUTH.ROLE.READ',
        permissionName: 'Read Roles',
        moduleName: 'AUTH',
        actionType: PermissionAction.READ,
        scopeLevel: PermissionScope.SYSTEM,
      },
      {
        permissionCode: 'AUTH.ROLE.UPDATE',
        permissionName: 'Update Role',
        moduleName: 'AUTH',
        actionType: PermissionAction.UPDATE,
        scopeLevel: PermissionScope.SYSTEM,
      },
      {
        permissionCode: 'AUTH.ROLE.DELETE',
        permissionName: 'Delete Role',
        moduleName: 'AUTH',
        actionType: PermissionAction.DELETE,
        scopeLevel: PermissionScope.SYSTEM,
      },
    ]);
  }
}
