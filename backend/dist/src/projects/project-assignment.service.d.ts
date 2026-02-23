import { Repository } from 'typeorm';
import { UserProjectAssignment, AssignmentStatus, ProjectScopeType } from './entities/user-project-assignment.entity';
import { ProjectTeamAudit } from './entities/project-team-audit.entity';
import { User } from '../users/user.entity';
import { EpsNode } from '../eps/eps.entity';
import { Role } from '../roles/role.entity';
import { AuditService } from '../audit/audit.service';
export declare class ProjectAssignmentService {
    private assignmentRepo;
    private auditRepo;
    private userRepo;
    private epsRepo;
    private roleRepo;
    private readonly auditService;
    constructor(assignmentRepo: Repository<UserProjectAssignment>, auditRepo: Repository<ProjectTeamAudit>, userRepo: Repository<User>, epsRepo: Repository<EpsNode>, roleRepo: Repository<Role>, auditService: AuditService);
    assignUser(projectId: number, userId: number, roleIds: number[], scopeType?: ProjectScopeType, scopeNodeId?: number, performedByUserId?: number): Promise<UserProjectAssignment>;
    removeUser(projectId: number, userId: number, performedByUserId?: number): Promise<void>;
    updateStatus(projectId: number, userId: number, status: AssignmentStatus, performedByUserId?: number): Promise<UserProjectAssignment>;
    getProjectAssignments(projectId: number): Promise<UserProjectAssignment[]>;
    getUserAssignments(userId: number): Promise<UserProjectAssignment[]>;
    private logAudit;
}
