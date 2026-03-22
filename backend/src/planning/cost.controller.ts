import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectContextGuard } from '../projects/guards/project-context.guard';
import { CostService } from './cost.service';

@Controller('planning/projects/:projectId/cost')
@UseGuards(JwtAuthGuard, ProjectContextGuard)
export class CostController {
  constructor(private readonly costService: CostService) {}

  /** GET /planning/projects/:projectId/cost/summary */
  @Get('summary')
  getSummary(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.costService.getSummary(projectId);
  }

  /**
   * GET /planning/projects/:projectId/cost/cashflow
   * Query params: fromMonth=2026-04, toMonth=2027-03
   */
  @Get('cashflow')
  getCashflow(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query('fromMonth') fromMonth?: string,
    @Query('toMonth') toMonth?: string,
  ) {
    return this.costService.getCashflow(projectId, fromMonth, toMonth);
  }

  /**
   * GET /planning/projects/:projectId/cost/aop
   * Query param: fy=2025 (financial year start, Apr 2025 – Mar 2026)
   */
  @Get('aop')
  getAop(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query('fy') fy?: string,
  ) {
    return this.costService.getAop(projectId, fy ? parseInt(fy) : undefined);
  }
}
