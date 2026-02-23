import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, TreeRepository } from 'typeorm';
import { ProjectAssignmentService } from '../project-assignment.service';
import { EpsNode, EpsNodeType } from '../../eps/eps.entity';

@Injectable()
export class ProjectAssignmentGuard implements CanActivate {
  constructor(
    private assignmentService: ProjectAssignmentService,
    private reflector: Reflector,
    @InjectRepository(EpsNode)
    private epsRepo: TreeRepository<EpsNode>,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Extract Project ID from params if projectContext is missing
    let projectId = request.projectContext?.projectId;
    if (!projectId && request.params && request.params.projectId) {
      projectId = Number(request.params.projectId);
    }

    if (!user || !projectId) {
      console.warn(
        `[ProjectAssignmentGuard] Failed. User: ${!!user}, ProjectId: ${projectId}`,
      );
      if (!projectId)
        console.warn(`[ProjectAssignmentGuard] Params:`, request.params);
      // If we can't find a user or a project ID, we can't validate assignment.
      // If the route doesn't have :projectId, this guard shouldn't be used, or it should pass?
      // Assuming strict security: Block if context is ambiguous.
      return false;
    }

    // 1. Admin Bypass
    // Check both array and string formats for robustness
    if (user.roles?.includes('Admin') || user.role === 'Admin') {
      // console.log(`[ProjectAssignmentGuard] Admin bypass for user: ${user.username}`);
      return true;
    }

    // 2. Check Assignment
    // Check locally from JWT first for performance
    if (user.project_ids?.includes(projectId)) {
      return true;
    }

    // Fallback: Check DB if not in JWT (maybe assigned after login)
    const assignments = await this.assignmentService.getUserAssignments(
      user.id,
    );
    let hasAssignment = assignments.some((a) => a.project?.id === projectId);

    // 3. Resolve Project Root for Sub-Nodes
    if (!hasAssignment) {
      const node = await this.epsRepo.findOne({
        where: { id: projectId },
        relations: ['parent'],
      });

      if (node && node.type !== EpsNodeType.PROJECT) {
        // Find project root for this node
        const ancestors = await this.epsRepo.findAncestors(node);
        const projectRoot = ancestors.find((a) => a.type === EpsNodeType.PROJECT);

        if (projectRoot) {
          hasAssignment = assignments.some((a) => a.project?.id === projectRoot.id);
          if (hasAssignment) {
            console.log(
              `[ProjectAssignmentGuard] Access granted for node ${projectId} via Project Root ${projectRoot.id}`,
            );
          }
        }
      }
    }

    if (!hasAssignment) {
      console.log(
        `[ProjectAssignmentGuard] User ${user.id} NOT assigned to Project ${projectId}`,
      );
      throw new ForbiddenException(
        `User is not assigned to Project ${projectId}`,
      );
    }

    return true;
  }
}
