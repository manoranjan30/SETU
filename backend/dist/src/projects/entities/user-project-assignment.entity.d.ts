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
    userId: number;
    project: EpsNode;
    projectId: number;
    role: Role;
    roleId: number;
    scopeType: ProjectScopeType;
    scopeNode: EpsNode | null;
    scopeNodeId: number | null;
    status: AssignmentStatus;
    createdAt: Date;
    updatedAt: Date;
}
