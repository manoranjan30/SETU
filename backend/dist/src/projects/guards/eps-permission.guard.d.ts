import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionResolutionService } from '../permission-resolution.service';
export declare const PERMISSION_KEY = "required_permission";
export declare const NODE_PARAM_KEY = "node_param_key";
export declare const RequireEpsPermission: (permission: string, nodeParam?: string) => (target: object, key: string | symbol, descriptor: PropertyDescriptor) => void;
export declare class EpsPermissionGuard implements CanActivate {
    private resolutionService;
    private reflector;
    constructor(resolutionService: PermissionResolutionService, reflector: Reflector);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
