import { Controller, Get, Query, Request, UseGuards, ParseIntPipe } from '@nestjs/common';
import { PendingTasksService } from './pending-tasks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('pending-tasks')
export class PendingTasksController {
  constructor(private readonly service: PendingTasksService) {}

  @Get('my')
  getMyPendingTasks(
    @Query('projectId') projectId: string,
    @Request() req,
  ) {
    const userId = req.user.userId || req.user.id;
    const pId = projectId ? parseInt(projectId, 10) : undefined;
    return this.service.getPendingTasks(userId, pId);
  }
}
