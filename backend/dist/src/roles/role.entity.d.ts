import { User } from '../users/user.entity';
import { Permission } from '../permissions/permission.entity';
export declare class Role {
    id: number;
    name: string;
    description: string;
    permissions: Permission[];
    users: User[];
}
