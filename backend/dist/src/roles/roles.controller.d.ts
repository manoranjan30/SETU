import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
export declare class RolesController {
    private readonly rolesService;
    constructor(rolesService: RolesService);
    create(createRoleDto: CreateRoleDto): Promise<import("./role.entity").Role>;
    findAll(): Promise<import("./role.entity").Role[]>;
    findOne(id: string): Promise<import("./role.entity").Role | null>;
    update(id: string, createRoleDto: CreateRoleDto): Promise<import("./role.entity").Role | null>;
    remove(id: string): Promise<void>;
}
