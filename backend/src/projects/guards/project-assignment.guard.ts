import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProjectAssignmentService } from '../project-assignment.service';

@Injectable()
export class ProjectAssignmentGuard implements CanActivate {
  constructor(
    private assignmentService: ProjectAssignmentService,
    private reflector: Reflector,
  ) {}

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
    const assignments = await this.assignmentService.getUserAssignments(
      user.userId,
    );
    const hasAssignment = assignments.some((a) => a.projectId === projectId);

    if (!hasAssignment) {
      console.log(
        `[ProjectAssignmentGuard] User ${user.userId} NOT assigned to Project ${projectId}`,
      );
      throw new ForbiddenException(
        `User is not assigned to Project ${projectId}`,
      );
    }

    return true;
  }
}
