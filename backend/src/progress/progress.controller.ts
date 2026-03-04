import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('progress')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('stats/:projectId')
  @Permissions('PROGRESS.DASHBOARD.READ')
  getBurnRateStats(@Param('projectId') projectId: string) {
    return this.progressService.getBurnRateStats(parseInt(projectId));
  }

  @Get('plan-vs-achieved/:projectId')
  @Permissions('PROGRESS.INSIGHTS.READ')
  getPlanVsAchieved(@Param('projectId') projectId: string) {
    return this.progressService.getPlanVsAchieved(parseInt(projectId));
  }

  @Get('insights/:projectId')
  @Permissions('PROGRESS.INSIGHTS.READ')
  getEfficiencyInsights(@Param('projectId') projectId: string) {
    return this.progressService.getEfficiencyInsights(parseInt(projectId));
  }
}
