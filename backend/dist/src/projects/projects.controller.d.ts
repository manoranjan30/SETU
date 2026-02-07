import { ProjectAssignmentService } from './project-assignment.service';
import { PermissionResolutionService } from './permission-resolution.service';
import { ProjectScopeType } from './entities/user-project-assignment.entity';
export declare class ProjectsController {
    private readonly assignmentService;
    private readonly permissionService;
    constructor(assignmentService: ProjectAssignmentService, permissionService: PermissionResolutionService);
    assignUser(projectId: number, body: {
        userId: number;
        roleId: number;
        scopeType?: ProjectScopeType;
        scopeNodeId?: number;
    }, req: any): Promise<import("./entities/user-project-assignment.entity").UserProjectAssignment>;
    getTeam(projectId: number): Promise<import("./entities/user-project-assignment.entity").UserProjectAssignment[]>;
    removeUser(projectId: number, userId: number, req: any): Promise<void>;
    checkPermission(projectId: number, nodeId: number, req: any): Promise<boolean>;
}
