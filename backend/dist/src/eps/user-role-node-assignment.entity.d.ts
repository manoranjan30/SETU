import { User } from '../users/user.entity';
import { Role } from '../roles/role.entity';
import { EpsNode } from './eps.entity';
export declare enum AccessType {
    ALLOW = "ALLOW",
    DENY = "DENY"
}
export declare class UserRoleNodeAssignment {
    id: number;
    user: User;
    role: Role;
    epsNode: EpsNode;
    appliesToSubtree: boolean;
    accessType: AccessType;
    createdOn: Date;
}
