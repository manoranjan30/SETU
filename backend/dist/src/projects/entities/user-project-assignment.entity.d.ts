import { User } from '../../users/user.entity';
import { EpsNode } from '../../eps/eps.entity';
import { Role } from '../../roles/role.entity';
export declare enum ProjectScopeType {
    FULL = "FULL",
    LIMITED = "LIMITED"
}
export declare enum AssignmentStatus {
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE"
}
export declare class UserProjectAssignment {
    id: string;
    user: User;
    project: EpsNode;
    roles: Role[];
    scopeType: ProjectScopeType;
    scopeNode: EpsNode | null;
    status: AssignmentStatus;
    createdAt: Date;
    updatedAt: Date;
}
