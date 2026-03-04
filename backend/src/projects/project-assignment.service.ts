import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  UserProjectAssignment,
  AssignmentStatus,
  ProjectScopeType,
} from './entities/user-project-assignment.entity';
import { ProjectTeamAudit } from './entities/project-team-audit.entity';
import { User } from '../users/user.entity';
import { EpsNode, EpsNodeType } from '../eps/eps.entity';
import { Role } from '../roles/role.entity';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ProjectAssignmentService {
  constructor(
    @InjectRepository(UserProjectAssignment)
    private assignmentRepo: Repository<UserProjectAssignment>,
    @InjectRepository(ProjectTeamAudit)
    private auditRepo: Repository<ProjectTeamAudit>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(EpsNode)
    private epsRepo: Repository<EpsNode>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    private readonly auditService: AuditService,
  ) {}

  async assignUser(
    projectId: number,
    userId: number,
    roleIds: number[],
    scopeType: ProjectScopeType = ProjectScopeType.FULL,
    scopeNodeId?: number,
    performedByUserId?: number,
  ): Promise<UserProjectAssignment> {
    // 1. Validate Project
    const project = await this.epsRepo.findOneBy({ id: projectId });
    if (!project || project.type !== EpsNodeType.PROJECT) {
      throw new BadRequestException(
        'Invalid Project ID or Node is not a Project',
      );
    }

    // 2. Validate User & Roles
    const user = await this.userRepo.findOneBy({ id: userId });
    const roles = await this.roleRepo.findBy({ id: In(roleIds) });
    if (!user) throw new NotFoundException('User not found');
    if (roles.length === 0)
      throw new BadRequestException('At least one valid role must be selected');

    // 3. Check existing assignment
    let assignment = await this.assignmentRepo.findOne({
      where: {
        user: { id: userId },
        project: { id: projectId },
      },
      relations: ['roles'],
    });

    const oldDetails = assignment
      ? {
          roleIds: assignment.roles?.map((r) => r.id),
          status: assignment.status,
          scopeType: assignment.scopeType,
        }
      : null;

    if (!assignment) {
      assignment = this.assignmentRepo.create({
        user,
        project,
        roles,
        scopeType,
        scopeNode: scopeNodeId
          ? ({ id: scopeNodeId } as unknown as EpsNode)
          : null,
        status: AssignmentStatus.ACTIVE,
      });
    } else {
      // Update existing
      assignment.roles = roles;
      assignment.scopeType = scopeType;
      assignment.scopeNode = scopeNodeId
        ? ({ id: scopeNodeId } as unknown as EpsNode)
        : null;
      assignment.status = AssignmentStatus.ACTIVE;
    }

    const saved = await this.assignmentRepo.save(assignment);

    // 4. Audit Log
    if (performedByUserId) {
      await this.logAudit(
        projectId,
        oldDetails ? 'UPDATE_MEMBER' : 'ADD_MEMBER',
        userId,
        performedByUserId,
        {
          old: oldDetails
            ? {
                roleIds: oldDetails.roleIds,
                scope: oldDetails.scopeType,
                status: oldDetails.status,
              }
            : null,
          new: {
            roleIds: roles.map((r) => r.id),
            scope: scopeType,
            status: saved.status,
          },
        },
      );
    }

    return saved;
  }

  async removeUser(
    projectId: number,
    userId: number,
    performedByUserId?: number,
  ): Promise<void> {
    const assignment = await this.assignmentRepo.findOne({
      where: { user: { id: userId }, project: { id: projectId } },
    });

    if (assignment) {
      await this.assignmentRepo.remove(assignment);
      if (performedByUserId) {
        await this.logAudit(
          projectId,
          'REMOVE_MEMBER',
          userId,
          performedByUserId,
          { previousRoles: assignment.roles?.map((r) => r.id) },
        );
      }
    }
  }

  async updateStatus(
    projectId: number,
    userId: number,
    status: AssignmentStatus,
    performedByUserId?: number,
  ): Promise<UserProjectAssignment> {
    const assignment = await this.assignmentRepo.findOne({
      where: { user: { id: userId }, project: { id: projectId } },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    const oldStatus = assignment.status;
    assignment.status = status;
    const saved = await this.assignmentRepo.save(assignment);

    if (performedByUserId) {
      await this.logAudit(
        projectId,
        'UPDATE_MEMBER_STATUS',
        userId,
        performedByUserId,
        { oldStatus, newStatus: status },
      );
    }

    return saved;
  }

  async getProjectAssignments(
    projectId: number,
  ): Promise<UserProjectAssignment[]> {
    return this.assignmentRepo.find({
      where: { project: { id: projectId } },
      relations: ['user', 'roles', 'scopeNode'],
    });
  }

  async getUserAssignments(userId: number): Promise<UserProjectAssignment[]> {
    return this.assignmentRepo.find({
      where: { user: { id: userId }, status: AssignmentStatus.ACTIVE },
      relations: ['project', 'roles', 'roles.permissions', 'scopeNode'],
    });
  }

  private async logAudit(
    projectId: number,
    action: string,
    targetId: number,
    performedBy: number,
    details: any,
  ) {
    // 1. Keep the specialized ProjectTeamAudit
    await this.auditRepo.save(
      this.auditRepo.create({
        projectId,
        actionType: action,
        targetUserId: targetId,
        performedByUserId: performedBy,
        details,
      }),
    );

    // 2. Also log to centralized AuditLog
    await this.auditService.log(
      performedBy,
      'TEAM',
      action,
      targetId,
      projectId,
      details,
    );
  }
}
