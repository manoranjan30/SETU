import { Repository } from 'typeorm';
import { Role } from './role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
export declare class RolesService {
    private rolesRepository;
    constructor(rolesRepository: Repository<Role>);
    create(createRoleDto: CreateRoleDto): Promise<Role>;
    findAll(): Promise<Role[]>;
    findOne(id: number): Promise<Role | null>;
    update(id: number, createRoleDto: CreateRoleDto): Promise<Role | null>;
    remove(id: number): Promise<void>;
}
