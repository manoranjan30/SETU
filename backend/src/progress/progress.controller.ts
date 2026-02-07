import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ProgressService } from './progress.service';

@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('stats/:projectId')
  getBurnRateStats(@Param('projectId') projectId: string) {
    return this.progressService.getBurnRateStats(parseInt(projectId));
  }

  @Get('plan-vs-achieved/:projectId')
  getPlanVsAchieved(@Param('projectId') projectId: string) {
    return this.progressService.getPlanVsAchieved(parseInt(projectId));
  }

  @Get('insights/:projectId')
  getEfficiencyInsights(@Param('projectId') projectId: string) {
    return this.progressService.getEfficiencyInsights(parseInt(projectId));
  }
}
