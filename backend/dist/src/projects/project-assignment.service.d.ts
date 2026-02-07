import { Repository } from 'typeorm';
import { UserProjectAssignment, ProjectScopeType } from './entities/user-project-assignment.entity';
import { ProjectTeamAudit } from './entities/project-team-audit.entity';
import { User } from '../users/user.entity';
import { EpsNode } from '../eps/eps.entity';
import { Role } from '../roles/role.entity';
export declare class ProjectAssignmentService {
    private assignmentRepo;
    private auditRepo;
    private userRepo;
    private epsRepo;
    private roleRepo;
    constructor(assignmentRepo: Repository<UserProjectAssignment>, auditRepo: Repository<ProjectTeamAudit>, userRepo: Repository<User>, epsRepo: Repository<EpsNode>, roleRepo: Repository<Role>);
    assignUser(projectId: number, userId: number, roleId: number, scopeType?: ProjectScopeType, scopeNodeId?: number, performedByUserId?: number): Promise<UserProjectAssignment>;
    removeUser(projectId: number, userId: number, performedByUserId?: number): Promise<void>;
    getProjectAssignments(projectId: number): Promise<UserProjectAssignment[]>;
    getUserAssignments(userId: number): Promise<UserProjectAssignment[]>;
    private logAudit;
}
