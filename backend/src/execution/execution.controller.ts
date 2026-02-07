import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Get,
  Patch,
  Delete,
} from '@nestjs/common';
import { ExecutionService } from './execution.service';

@Controller('execution')
export class ExecutionController {
  constructor(private readonly service: ExecutionService) {}

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
}
