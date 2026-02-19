import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Get,
  Query,
  Patch,
  Delete,
} from '@nestjs/common';
import { ExecutionService } from './execution.service';
import { ExecutionBreakdownService } from './execution-breakdown.service';
import { FEATURES } from '../config/features.config';

@Controller('execution')
export class ExecutionController {
  constructor(
    private readonly service: ExecutionService,
    private readonly breakdownService: ExecutionBreakdownService,
  ) {}

  @Post(':projectId/measurements')
  async saveMeasurements(
    @Param('projectId') projectId: string,
    @Body() body: { entries: any[] },
    @Request() req,
  ) {
    // userId from Auth Guard (mocked as 1 for now if not found)
    const userId = req.user?.id || 1;
    return this.service.batchSaveMeasurements(+projectId, body.entries, userId);
  }

  @Get(':projectId/logs')
  async getLogs(@Param('projectId') projectId: string) {
    return this.service.getProjectProgressLogs(+projectId);
  }

  @Patch('logs/:logId')
  async updateLog(
    @Param('logId') logId: string,
    @Body() body: { newQty: number },
    @Request() req,
  ) {
    const userId = req.user?.id || 1;
    return this.service.updateProgressLog(+logId, body.newQty, userId);
  }

  @Delete('logs/:logId')
  async deleteLog(@Param('logId') logId: string) {
    return this.service.deleteProgressLog(+logId);
  }

  /**
   * NEW: Get execution breakdown (Micro + Balance)
   * Protected by feature flag
   */
  @Get('breakdown')
  async getExecutionBreakdown(
    @Query() query: { activityId: string; epsNodeId: string },
  ) {
    if (!FEATURES.ENABLE_MICRO_PROGRESS) {
      return { error: 'Feature not enabled', enabled: false };
    }

    return this.breakdownService.getBreakdown(
      +query.activityId,
      +query.epsNodeId,
    );
  }

  /**
   * Check if activity has micro schedule
   */
  @Get('has-micro/:activityId')
  async hasMicroSchedule(@Param('activityId') activityId: string) {
    if (!FEATURES.ENABLE_MICRO_PROGRESS) {
      return { hasMicro: false };
    }

    const hasMicro = await this.breakdownService.hasMicroSchedule(+activityId);
    return { hasMicro };
  }

  /**
   * NEW: Save micro progress (Micro Activities + Direct Execution)
   * Protected by feature flag
   */
  @Post('progress/micro')
  async saveMicroProgress(
    @Body() dto: any, // Will be typed properly
    @Request() req,
  ) {
    if (!FEATURES.ENABLE_MICRO_PROGRESS) {
      throw new Error('Feature not enabled');
    }

    const userId = req.user?.id || 1;

    // Transform entries to standard format
    const entries = dto.entries.map((entry: any) => ({
      boqItemId: entry.boqItemId,
      activityId: dto.activityId,
      projectId: dto.projectId || req.params.projectId,
      wbsNodeId: dto.epsNodeId,
      microActivityId: entry.microActivityId || null,
      executedQty: Number(entry.quantity),
      date: dto.date,
      notes: dto.remarks || '',
    }));

    // Use existing batch save logic
    return await this.service.batchSaveMeasurements(
      dto.projectId || req.params.projectId,
      entries,
      userId,
    );
  }
  @Get(':projectId/approvals/pending')
  async getPendingApprovals(@Param('projectId') projectId: string) {
    return this.service.getPendingProgressLogs(+projectId);
  }

  @Post('approve')
  async approveMeasurements(
    @Body() body: { logIds: number[] },
    @Request() req,
  ) {
    const userId = req.user?.id || 1;
    return this.service.approveProgress(body.logIds, userId);
  }

  @Post('reject')
  async rejectMeasurements(
    @Body() body: { logIds: number[]; reason: string },
    @Request() req,
  ) {
    const userId = req.user?.id || 1;
    return this.service.rejectProgress(body.logIds, userId, body.reason);
  }
}
