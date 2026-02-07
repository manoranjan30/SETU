import { OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Permission } from './permission.entity';
import { CreatePermissionDto } from './dto/create-permission.dto';
export declare class PermissionsService implements OnModuleInit {
    private permissionsRepository;
    private readonly logger;
    constructor(permissionsRepository: Repository<Permission>);
    onModuleInit(): Promise<void>;
    findAll(): Promise<Permission[]>;
    registerPermissions(permissions: CreatePermissionDto[]): Promise<void>;
}
