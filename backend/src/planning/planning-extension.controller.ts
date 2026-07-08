import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { ProjectAssignmentGuard } from '../projects/guards/project-assignment.guard';
import { ProjectContextGuard } from '../projects/guards/project-context.guard';
import { PlanningExtensionService } from './planning-extension.service';

@Controller('planning/projects/:projectId')
@UseGuards(
  JwtAuthGuard,
  ProjectContextGuard,
  ProjectAssignmentGuard,
  PermissionsGuard,
)
export class PlanningExtensionController {
  constructor(private readonly planningExt: PlanningExtensionService) {}

  @Get('actions/summary')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Vary', 'Authorization')
  @Permissions(
    'PLANNING.TASK.READ',
    'PLANNING.FOLLOWUP.READ',
    'PLANNING.JOURNAL.READ',
  )
  actionSummary(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.planningExt.actionSummary(projectId);
  }

  @Get('tasks')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Vary', 'Authorization')
  @Permissions('PLANNING.TASK.READ')
  listTasks(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: any,
  ) {
    return this.planningExt.listTasks(projectId, query);
  }

  @Get('tasks/assignee-options')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Vary', 'Authorization')
  @Permissions(
    'PLANNING.TASK.READ',
    'PLANNING.FOLLOWUP.READ',
    'PLANNING.JOURNAL.READ',
  )
  assigneeOptions(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.planningExt.assigneeOptions(projectId);
  }

  @Get('tasks/my')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Vary', 'Authorization')
  @Permissions('PLANNING.TASK.READ')
  myTasks(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: any,
    @Request() req,
  ) {
    return this.planningExt.myTasks(projectId, req.user?.id, query);
  }

  @Get('tasks/active')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Vary', 'Authorization')
  @Permissions('PLANNING.TASK.READ')
  activeTasks(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: any,
  ) {
    return this.planningExt.activeTasks(projectId, query);
  }

  @Get('tasks/completed')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Vary', 'Authorization')
  @Permissions('PLANNING.TASK.READ')
  completedTasks(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: any,
  ) {
    return this.planningExt.completedTasks(projectId, query);
  }

  @Get('tasks/history')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Vary', 'Authorization')
  @Permissions('PLANNING.TASK.READ')
  taskHistory(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: any,
  ) {
    return this.planningExt.taskHistory(projectId, query);
  }

  @Get('tasks/:id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Vary', 'Authorization')
  @Permissions('PLANNING.TASK.READ')
  getTask(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.planningExt.getTask(projectId, id);
  }

  @Post('tasks')
  @Permissions('PLANNING.TASK.CREATE')
  createTask(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: any,
    @Request() req,
  ) {
    return this.planningExt.createTask(projectId, body, req.user?.id);
  }

  @Patch('tasks/:id')
  @Permissions('PLANNING.TASK.UPDATE')
  updateTask(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    return this.planningExt.updateTask(projectId, id, body);
  }

  @Patch('tasks/:id/status')
  @Permissions('PLANNING.TASK.UPDATE')
  updateTaskStatus(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: string,
  ) {
    return this.planningExt.updateTaskStatus(projectId, id, status);
  }

  @Post('tasks/:id/complete')
  @Permissions('PLANNING.TASK.UPDATE')
  completeTask(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.planningExt.completeTask(projectId, id, req.user?.id);
  }

  @Post('tasks/:id/reopen')
  @Permissions('PLANNING.TASK.UPDATE')
  reopenTask(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.planningExt.reopenTask(projectId, id);
  }

  @Delete('tasks/:id')
  @Permissions('PLANNING.TASK.DELETE')
  deleteTask(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.planningExt.deleteTask(projectId, id);
  }

  @Get('tasks/:id/comments')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Vary', 'Authorization')
  @Permissions('PLANNING.TASK.READ')
  listTaskComments(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.planningExt.listTaskComments(projectId, id);
  }

  @Post('tasks/:id/comments')
  @Permissions('PLANNING.TASK.UPDATE')
  addTaskComment(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body('comment') comment: string,
    @Request() req,
  ) {
    return this.planningExt.addTaskComment(projectId, id, comment, req.user?.id);
  }

  @Get('followups')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Vary', 'Authorization')
  @Permissions('PLANNING.FOLLOWUP.READ')
  listFollowups(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: any,
  ) {
    return this.planningExt.listFollowups(projectId, query);
  }

  @Get('followups/my')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Vary', 'Authorization')
  @Permissions('PLANNING.FOLLOWUP.READ')
  myFollowups(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: any,
    @Request() req,
  ) {
    return this.planningExt.myFollowups(projectId, req.user?.id, query);
  }

  @Get('followups/overdue')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Vary', 'Authorization')
  @Permissions('PLANNING.FOLLOWUP.READ')
  overdueFollowups(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: any,
  ) {
    return this.planningExt.overdueFollowups(projectId, query);
  }

  @Get('followups/due-today')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Vary', 'Authorization')
  @Permissions('PLANNING.FOLLOWUP.READ')
  dueTodayFollowups(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: any,
  ) {
    return this.planningExt.dueTodayFollowups(projectId, query);
  }

  @Get('followups/history')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Vary', 'Authorization')
  @Permissions('PLANNING.FOLLOWUP.READ')
  followupHistory(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: any,
  ) {
    return this.planningExt.followupHistory(projectId, query);
  }

  @Get('followups/:id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Vary', 'Authorization')
  @Permissions('PLANNING.FOLLOWUP.READ')
  getFollowup(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.planningExt.getFollowup(projectId, id);
  }

  @Post('followups')
  @Permissions('PLANNING.FOLLOWUP.CREATE')
  createFollowup(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: any,
    @Request() req,
  ) {
    return this.planningExt.createFollowup(projectId, body, req.user?.id);
  }

  @Patch('followups/:id')
  @Permissions('PLANNING.FOLLOWUP.UPDATE')
  updateFollowup(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    return this.planningExt.updateFollowup(projectId, id, body);
  }

  @Post('followups/:id/close')
  @Permissions('PLANNING.FOLLOWUP.UPDATE')
  closeFollowup(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body('remarks') remarks: string,
    @Request() req,
  ) {
    return this.planningExt.closeFollowup(projectId, id, remarks, req.user?.id);
  }

  @Post('followups/:id/reopen')
  @Permissions('PLANNING.FOLLOWUP.UPDATE')
  reopenFollowup(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.planningExt.reopenFollowup(projectId, id);
  }

  @Post('followups/:id/snooze')
  @Permissions('PLANNING.FOLLOWUP.UPDATE')
  snoozeFollowup(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    return this.planningExt.snoozeFollowup(
      projectId,
      id,
      body.reminderAt,
      body.dueDate,
    );
  }

  @Post('followups/:id/convert-to-task')
  @Permissions('PLANNING.TASK.CREATE', 'PLANNING.FOLLOWUP.UPDATE')
  convertFollowupToTask(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.planningExt.convertFollowupToTask(projectId, id, req.user?.id);
  }

  @Delete('followups/:id')
  @Permissions('PLANNING.FOLLOWUP.DELETE')
  deleteFollowup(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.planningExt.deleteFollowup(projectId, id);
  }

  @Get('journal')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Vary', 'Authorization')
  @Permissions('PLANNING.JOURNAL.READ')
  listJournal(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: any,
  ) {
    return this.planningExt.listJournal(projectId, query);
  }

  @Get('journal/today')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Vary', 'Authorization')
  @Permissions('PLANNING.JOURNAL.READ')
  todayJournal(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.planningExt.todayJournal(projectId);
  }

  @Get('journal/calendar')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Vary', 'Authorization')
  @Permissions('PLANNING.JOURNAL.READ')
  journalCalendar(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: any,
  ) {
    return this.planningExt.journalCalendar(projectId, query);
  }

  @Get('journal/search')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Vary', 'Authorization')
  @Permissions('PLANNING.JOURNAL.READ')
  searchJournal(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() query: any,
  ) {
    return this.planningExt.searchJournal(projectId, query);
  }

  @Get('journal/:id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Vary', 'Authorization')
  @Permissions('PLANNING.JOURNAL.READ')
  getJournal(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.planningExt.getJournal(projectId, id);
  }

  @Post('journal')
  @Permissions('PLANNING.JOURNAL.CREATE')
  upsertJournal(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: any,
    @Request() req,
  ) {
    return this.planningExt.upsertJournal(projectId, body, req.user?.id);
  }

  @Patch('journal/:id')
  @Permissions('PLANNING.JOURNAL.UPDATE')
  updateJournal(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    return this.planningExt.updateJournal(projectId, id, body);
  }

  @Post('journal/:id/submit')
  @Permissions('PLANNING.JOURNAL.UPDATE')
  submitJournal(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.planningExt.submitJournal(projectId, id);
  }

  @Post('journal/:id/lock')
  @Permissions('PLANNING.JOURNAL.UPDATE')
  lockJournal(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.planningExt.lockJournal(projectId, id);
  }

  @Post('journal/:id/reopen')
  @Permissions('PLANNING.JOURNAL.UPDATE')
  reopenJournal(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.planningExt.reopenJournal(projectId, id);
  }

  @Delete('journal/:id')
  @Permissions('PLANNING.JOURNAL.DELETE')
  deleteJournal(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.planningExt.deleteJournal(projectId, id);
  }

  @Post('journal/:id/photos')
  @Permissions('PLANNING.JOURNAL.UPDATE')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  addJournalPhotos(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.planningExt.addJournalPhotos(projectId, id, files);
  }
}
