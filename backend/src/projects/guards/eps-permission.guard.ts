import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionResolutionService } from '../permission-resolution.service';

export const PERMISSION_KEY = 'required_permission';
export const NODE_PARAM_KEY = 'node_param_key';

export const RequireEpsPermission = (
  permission: string,
  nodeParam: string = 'id',
) => {
  return (
    target: object,
    key: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    SetMetadata(PERMISSION_KEY, permission)(target, key, descriptor);
    SetMetadata(NODE_PARAM_KEY, nodeParam)(target, key, descriptor);
  };
};

@Injectable()
export class EpsPermissionGuard implements CanActivate {
  constructor(
    private resolutionService: PermissionResolutionService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<string>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!permission) return true; // No permission required

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Admin Bypass
    if (user?.roles?.includes('Admin')) return true;

    const nodeParam =
      this.reflector.getAllAndOverride<string>(NODE_PARAM_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || 'id';

    const nodeIdRaw =
      request.params[nodeParam] ||
      request.query[nodeParam] ||
      request.body[nodeParam];

    if (!nodeIdRaw) {
      // If NO node ID is present, we might technically fail or skip.
      // But if this guard is used, it implies we NEED to check permission on A NODE.
      // Exception: Creating a Root Project (no parent)? Handled separately.
      return false;
    }

    const nodeId = parseInt(String(nodeIdRaw), 10);
    if (isNaN(nodeId)) return false;

    const authorized = await this.resolutionService.hasPermission(
      user.sub,
      permission,
      nodeId,
    ); // user.sub is ID
    if (!authorized) {
      throw new ForbiddenException(
        `Missing permission: ${permission} on Node ${nodeId}`,
      );
    }

    return true;
  }
}
