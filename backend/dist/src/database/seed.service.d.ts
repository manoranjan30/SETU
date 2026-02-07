import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Permission } from '../permissions/permission.entity';
import { Role } from '../roles/role.entity';
import { User } from '../users/user.entity';
import { DrawingCategory } from '../design/entities/drawing-category.entity';
export declare class SeedService implements OnApplicationBootstrap {
    private permissionRepo;
    private roleRepo;
    private userRepo;
    private categoryRepo;
    private readonly logger;
    constructor(permissionRepo: Repository<Permission>, roleRepo: Repository<Role>, userRepo: Repository<User>, categoryRepo: Repository<DrawingCategory>);
    onApplicationBootstrap(): Promise<void>;
    private seedPermissions;
    private seedDefaultRoles;
    private seedDefaultUser;
    private seedCategories;
}
