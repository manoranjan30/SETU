import { OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Permission } from './permission.entity';
export declare class PermissionsService implements OnModuleInit {
    private permissionsRepository;
    private readonly logger;
    constructor(permissionsRepository: Repository<Permission>);
    onModuleInit(): Promise<void>;
    findAll(): Promise<Permission[]>;
    private migrateOldPermissionCodes;
    private registerAllPermissions;
}
