import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler(),
    );
    if (!requiredPermissions) {
      return true; // No permissions required
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      console.log('[PermissionsGuard] No user attached to request');
      return false;
    }

    // Admin Bypass Logic (Strict Rule)
    if (user.roles?.includes('Admin') || user.role === 'Admin') {
      console.log(`[PermissionsGuard] Admin bypass for user: ${user.username}`);
      return true;
    }

    // Check permissions
    if (!user.permissions || !Array.isArray(user.permissions)) {
      console.warn(
        '[PermissionsGuard] User object missing permissions array or invalid format.',
      );
      console.log('[PermissionsGuard] User keys:', Object.keys(user));
      return false;
    }

    const hasPermission = requiredPermissions.some((permission) =>
      user.permissions.includes(permission),
    );

    if (!hasPermission) {
      console.log(
        `[PermissionsGuard] User ${user.username} missing required permissions: ${requiredPermissions.join(', ')}`,
      );
      console.log(
        `[PermissionsGuard] User has: ${user.permissions.join(', ')}`,
      );
      throw new ForbiddenException('Insufficient Permissions');
    }

    return true;
  }
}
