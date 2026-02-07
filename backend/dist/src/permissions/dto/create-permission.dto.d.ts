import { PermissionAction, PermissionScope } from '../permission.entity';
export declare class CreatePermissionDto {
    permissionCode: string;
    permissionName: string;
    moduleName: string;
    entityName?: string;
    actionType: PermissionAction;
    scopeLevel: PermissionScope;
    description?: string;
}
