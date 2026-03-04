import {
  Controller,
  Post,
  Body,
  Param,
  Delete,
  Get,
  Patch,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { ProjectAssignmentService } from './project-assignment.service';
import { PermissionResolutionService } from './permission-resolution.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectContextGuard } from './guards/project-context.guard';
import { ProjectAssignmentGuard } from './guards/project-assignment.guard';
import {
  EpsPermissionGuard,
  RequireEpsPermission,
} from './guards/eps-permission.guard';
import { ProjectScopeType } from './entities/user-project-assignment.entity';
import { Auditable } from '../audit/auditable.decorator';

@Controller('projects')
@UseGuards(JwtAuthGuard, ProjectContextGuard, ProjectAssignmentGuard)
export class ProjectsController {
  constructor(
    private readonly assignmentService: ProjectAssignmentService,
    private readonly permissionService: PermissionResolutionService,
  ) {}

  // Team Management

  @Post(':projectId/assign')
  @UseGuards(EpsPermissionGuard)
  @RequireEpsPermission('TEAM.MANAGE', 'projectId') // Custom permission check on the Project Node
  @Auditable('TEAM', 'ASSIGN_MEMBER')
  async assignUser(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body()
    body: {
      userId: number;
      roleIds: number[];
      scopeType?: ProjectScopeType;
      scopeNodeId?: number;
    },
    @Request() req,
  ) {
    return this.assignmentService.assignUser(
      projectId,
      body.userId,
      body.roleIds,
      body.scopeType,
      body.scopeNodeId,
      req.user.id,
    );
  }

  @Patch(':projectId/users/:userId/status')
  @UseGuards(EpsPermissionGuard)
  @RequireEpsPermission('TEAM.MANAGE', 'projectId')
  @Auditable('TEAM', 'UPDATE_MEMBER_STATUS', 'userId')
  async updateStatus(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body('status') status: any,
    @Request() req,
  ) {
    return this.assignmentService.updateStatus(
      projectId,
      userId,
      status,
      req.user.id,
    );
  }

  @Get(':projectId/team')
  @UseGuards(EpsPermissionGuard)
  @RequireEpsPermission('EPS.VIEW', 'projectId') // Basic view permission
  async getTeam(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.assignmentService.getProjectAssignments(projectId);
  }

  @Delete(':projectId/users/:userId')
  @UseGuards(EpsPermissionGuard)
  @RequireEpsPermission('TEAM.MANAGE', 'projectId')
  @Auditable('TEAM', 'REMOVE_MEMBER', 'userId')
  async removeUser(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Request() req,
  ) {
    return this.assignmentService.removeUser(projectId, userId, req.user.id);
  }

  // Permission Verification Endpoint (For Debugging/Frontend Checks)
  @Get(':projectId/check-permission/:nodeId')
  async checkPermission(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('nodeId', ParseIntPipe) nodeId: number,
    @Request() req,
  ) {
    // PermissionToCheck passed in query? Or body?
    // Simple boolean check
    const permission = req.query.code;
    return this.permissionService.hasPermission(
      req.user.id,
      permission,
      nodeId,
    );
  }
}
