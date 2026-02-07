import { Repository, TreeRepository } from 'typeorm';
import { UserProjectAssignment } from './entities/user-project-assignment.entity';
import { EpsNode } from '../eps/eps.entity';
export declare class PermissionResolutionService {
    private assignmentRepo;
    private epsRepo;
    constructor(assignmentRepo: Repository<UserProjectAssignment>, epsRepo: TreeRepository<EpsNode>);
    hasPermission(userId: number, permissionCode: string, nodeId: number): Promise<boolean>;
    private findProjectRoot;
    private isDescendant;
}
