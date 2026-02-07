export declare enum PermissionAction {
    CREATE = "CREATE",
    READ = "READ",
    UPDATE = "UPDATE",
    DELETE = "DELETE",
    SPECIAL = "SPECIAL"
}
export declare enum PermissionScope {
    SYSTEM = "SYSTEM",
    COMPANY = "COMPANY",
    PROJECT = "PROJECT",
    NODE = "NODE"
}
export declare class Permission {
    id: number;
    permissionCode: string;
    permissionName: string;
    moduleName: string;
    entityName: string;
    actionType: PermissionAction;
    scopeLevel: PermissionScope;
    description: string;
    isSystem: boolean;
    isActive: boolean;
    createdOn: Date;
    updatedOn: Date;
}
