import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('audit')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Permissions('AUDIT.READ')
  async findAll(
    @Query('projectId') projectId?: string,
    @Query('module') module?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.findAll(
      projectId ? parseInt(projectId) : undefined,
      module,
      limit ? parseInt(limit) : 100,
    );
  }

  @Get('project/:projectId')
  @Permissions('AUDIT.READ')
  async findByProject(@Param('projectId') projectId: string) {
    return this.auditService.findByProject(parseInt(projectId));
  }
}
