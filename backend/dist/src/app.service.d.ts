import { OnModuleInit } from '@nestjs/common';
import { UsersService } from './users/users.service';
import { RolesService } from './roles/roles.service';
import { PermissionsService } from './permissions/permissions.service';
export declare class AppService implements OnModuleInit {
    private usersService;
    private rolesService;
    private permissionsService;
    constructor(usersService: UsersService, rolesService: RolesService, permissionsService: PermissionsService);
    getHello(): string;
    onModuleInit(): Promise<void>;
    seed(): Promise<void>;
}
