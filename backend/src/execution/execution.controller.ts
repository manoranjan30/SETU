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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('execution')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExecutionController {
  constructor(
    private readonly service: ExecutionService,
    private readonly breakdownService: ExecutionBreakdownService,
  ) {}

  @Post(':projectId/measurements')
  @Permissions('EXECUTION.ENTRY.CREATE')
  async saveMeasurements(
    @Param('projectId') projectId: string,
    @Body() body: { entries: any[] },
    @Request() req,
  ) {
    const userId = req.user?.id || 1;
    return this.service.batchSaveMeasurements(+projectId, body.entries, userId);
  }

  @Get(':projectId/logs')
  @Permissions('EXECUTION.ENTRY.READ')
  async getLogs(@Param('projectId') projectId: string) {
    return this.service.getProjectProgressLogs(+projectId);
  }

  @Patch('logs/:logId')
  @Permissions('EXECUTION.ENTRY.UPDATE')
  async updateLog(
    @Param('logId') logId: string,
    @Body() body: { newQty: number },
    @Request() req,
  ) {
    const userId = req.user?.id || 1;
    return this.service.updateProgressLog(+logId, body.newQty, userId);
  }

  @Delete('logs/:logId')
  @Permissions('EXECUTION.ENTRY.DELETE')
  async deleteLog(@Param('logId') logId: string) {
    return this.service.deleteProgressLog(+logId);
  }

  @Get('breakdown/:activityId/:epsNodeId')
  @Permissions('EXECUTION.ENTRY.READ')
  async getExecutionBreakdown(
    @Param('activityId') activityId: string,
    @Param('epsNodeId') epsNodeId: string,
  ) {
    if (!FEATURES.ENABLE_MICRO_PROGRESS) {
      return { error: 'Feature not enabled', enabled: false };
    }

    return this.breakdownService.getBreakdown(
      +activityId,
      +epsNodeId,
    );
  }

  @Get('has-micro/:activityId')
  @Permissions('EXECUTION.ENTRY.READ')
  async hasMicroSchedule(@Param('activityId') activityId: string) {
    if (!FEATURES.ENABLE_MICRO_PROGRESS) {
      return { hasMicro: false };
    }

    const hasMicro = await this.breakdownService.hasMicroSchedule(+activityId);
    return { hasMicro };
  }

  @Post('progress/micro')
  @Permissions('EXECUTION.MICRO.CREATE')
  async saveMicroProgress(@Body() dto: any, @Request() req) {
    if (!FEATURES.ENABLE_MICRO_PROGRESS) {
      throw new Error('Feature not enabled');
    }

    const userId = req.user?.id || 1;
    const projectId = dto.projectId;

    const entries = dto.entries.map((entry: any) => ({
      boqItemId: entry.boqItemId,
      workOrderItemId: entry.workOrderItemId,
      vendorId: entry.vendorId,
      activityId: dto.activityId,
      projectId: projectId,
      wbsNodeId: dto.epsNodeId,
      microActivityId: entry.microActivityId || null,
      executedQty: Number(entry.quantity),
      date: dto.date,
      notes: dto.remarks || '',
    }));

    return await this.service.batchSaveMeasurements(
      projectId,
      entries,
      userId,
    );
  }

  @Get(':projectId/approvals/pending')
  @Permissions('EXECUTION.ENTRY.APPROVE')
  async getPendingApprovals(@Param('projectId') projectId: string) {
    return this.service.getPendingProgressLogs(+projectId);
  }

  @Post('approve')
  @Permissions('EXECUTION.ENTRY.APPROVE')
  async approveMeasurements(
    @Body() body: { logIds: number[] },
    @Request() req,
  ) {
    const userId = req.user?.id || 1;
    return this.service.approveProgress(body.logIds, userId);
  }

  @Post('reject')
  @Permissions('EXECUTION.ENTRY.APPROVE')
  async rejectMeasurements(
    @Body() body: { logIds: number[]; reason: string },
    @Request() req,
  ) {
    const userId = req.user?.id || 1;
    return this.service.rejectProgress(body.logIds, userId, body.reason);
  }
}
