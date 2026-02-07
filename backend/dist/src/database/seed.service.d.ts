import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Permission } from '../permissions/permission.entity';
import { Role } from '../roles/role.entity';
import { User } from '../users/user.entity';
export declare class SeedService implements OnApplicationBootstrap {
    private permissionRepo;
    private roleRepo;
    private userRepo;
    private readonly logger;
    constructor(permissionRepo: Repository<Permission>, roleRepo: Repository<Role>, userRepo: Repository<User>);
    onApplicationBootstrap(): Promise<void>;
    private seedPermissions;
    private seedDefaultRoles;
    private seedDefaultUser;
}
