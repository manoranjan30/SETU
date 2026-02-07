import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  UserProjectAssignment,
  AssignmentStatus,
  ProjectScopeType,
} from './entities/user-project-assignment.entity';
import { ProjectTeamAudit } from './entities/project-team-audit.entity';
import { User } from '../users/user.entity';
import { EpsNode, EpsNodeType } from '../eps/eps.entity';
import { Role } from '../roles/role.entity';

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
  ) {}

  async assignUser(
    projectId: number,
    userId: number,
    roleId: number,
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

    // 2. Validate User & Role
    const user = await this.userRepo.findOneBy({ id: userId });
    const role = await this.roleRepo.findOneBy({ id: roleId });
    if (!user || !role) throw new NotFoundException('User or Role not found');

    // 3. Check existing assignment
    let assignment = await this.assignmentRepo.findOne({
      where: {
        user: { id: userId },
        project: { id: projectId },
      },
    });

    const oldDetails = assignment ? { ...assignment } : null;

    if (!assignment) {
      assignment = this.assignmentRepo.create({
        user,
        project,
        role,
        scopeType,
        scopeNode: scopeNodeId
          ? ({ id: scopeNodeId } as unknown as EpsNode)
          : null,
        status: AssignmentStatus.ACTIVE,
      });
    } else {
      // Update existing
      assignment.role = role;
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
            ? { roleId: oldDetails.roleId, scope: oldDetails.scopeType }
            : null,
          new: { roleId: role.id, scope: scopeType },
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
          { previousRole: assignment.roleId },
        );
      }
    }
  }

  async getProjectAssignments(
    projectId: number,
  ): Promise<UserProjectAssignment[]> {
    return this.assignmentRepo.find({
      where: { project: { id: projectId } },
      relations: ['user', 'role', 'scopeNode'],
    });
  }

  async getUserAssignments(userId: number): Promise<UserProjectAssignment[]> {
    return this.assignmentRepo.find({
      where: { user: { id: userId }, status: AssignmentStatus.ACTIVE },
      relations: ['project', 'role', 'scopeNode'],
    });
  }

  private async logAudit(
    projectId: number,
    action: string,
    targetId: number,
    performedBy: number,
    details: any,
  ) {
    await this.auditRepo.save(
      this.auditRepo.create({
        projectId,
        actionType: action,
        targetUserId: targetId,
        performedByUserId: performedBy,
        details,
      }),
    );
  }
}
