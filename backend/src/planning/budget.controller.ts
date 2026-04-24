import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectContextGuard } from '../projects/guards/project-context.guard';
import { ProjectAssignmentGuard } from '../projects/guards/project-assignment.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { BudgetService } from './budget.service';

@Controller('planning/projects/:projectId/budget')
@UseGuards(
  JwtAuthGuard,
  ProjectContextGuard,
  ProjectAssignmentGuard,
  PermissionsGuard,
)
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Get()
  @Permissions('PLANNING.BUDGET.READ')
  listBudgets(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.budgetService.listBudgets(projectId);
  }

  @Post()
  @Permissions('PLANNING.BUDGET.CREATE')
  createBudget(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: any,
    @Request() req,
  ) {
    return this.budgetService.createBudget(projectId, body, req.user?.id);
  }

  @Get(':budgetId')
  @Permissions('PLANNING.BUDGET.READ')
  getBudget(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('budgetId', ParseIntPipe) budgetId: number,
  ) {
    return this.budgetService.getBudget(projectId, budgetId);
  }

  @Put(':budgetId')
  @Permissions('PLANNING.BUDGET.UPDATE')
  updateBudget(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('budgetId', ParseIntPipe) budgetId: number,
    @Body() body: any,
    @Request() req,
  ) {
    return this.budgetService.updateBudget(
      projectId,
      budgetId,
      body,
      req.user?.id,
    );
  }

  @Delete(':budgetId')
  @Permissions('PLANNING.BUDGET.DELETE')
  deleteBudget(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('budgetId', ParseIntPipe) budgetId: number,
  ) {
    return this.budgetService.deleteBudget(projectId, budgetId);
  }

  @Get(':budgetId/lines')
  @Permissions('PLANNING.BUDGET.READ')
  listLines(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('budgetId', ParseIntPipe) budgetId: number,
  ) {
    return this.budgetService.listBudgetLines(projectId, budgetId);
  }

  @Post(':budgetId/lines')
  @Permissions('PLANNING.BUDGET.CREATE')
  createLine(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('budgetId', ParseIntPipe) budgetId: number,
    @Body() body: any,
  ) {
    return this.budgetService.createBudgetLine(projectId, budgetId, body);
  }

  @Post(':budgetId/import')
  @Permissions('PLANNING.BUDGET.IMPORT')
  @UseInterceptors(FileInterceptor('file'))
  importLines(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('budgetId', ParseIntPipe) budgetId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.budgetService.importBudgetLines(
      projectId,
      budgetId,
      file.buffer,
    );
  }

  @Put(':budgetId/lines/:lineId')
  @Permissions('PLANNING.BUDGET.UPDATE')
  updateLine(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('budgetId', ParseIntPipe) budgetId: number,
    @Param('lineId', ParseIntPipe) lineId: number,
    @Body() body: any,
  ) {
    return this.budgetService.updateBudgetLine(
      projectId,
      budgetId,
      lineId,
      body,
    );
  }

  @Get(':budgetId/lines/:lineId/activities')
  @Permissions('PLANNING.BUDGET.READ')
  listLineActivities(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('budgetId', ParseIntPipe) budgetId: number,
    @Param('lineId', ParseIntPipe) lineId: number,
  ) {
    return this.budgetService.listBudgetLineActivities(
      projectId,
      budgetId,
      lineId,
    );
  }

  @Post(':budgetId/lines/:lineId/activities')
  @Permissions('PLANNING.BUDGET.MAP')
  addLineActivities(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('budgetId', ParseIntPipe) budgetId: number,
    @Param('lineId', ParseIntPipe) lineId: number,
    @Body('activityIds') activityIds: number[] | undefined,
    @Body('activityId') activityId: number | undefined,
    @Request() req,
  ) {
    const ids = Array.isArray(activityIds)
      ? activityIds
      : activityId
      ? [activityId]
      : [];
    return this.budgetService.addBudgetLineActivities(
      projectId,
      budgetId,
      lineId,
      ids,
      req.user?.id,
    );
  }

  @Delete(':budgetId/lines/:lineId/activities/:activityId')
  @Permissions('PLANNING.BUDGET.MAP')
  deleteLineActivity(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('budgetId', ParseIntPipe) budgetId: number,
    @Param('lineId', ParseIntPipe) lineId: number,
    @Param('activityId', ParseIntPipe) activityId: number,
  ) {
    return this.budgetService.removeBudgetLineActivity(
      projectId,
      budgetId,
      lineId,
      activityId,
    );
  }

  @Delete(':budgetId/lines/:lineId')
  @Permissions('PLANNING.BUDGET.DELETE')
  deleteLine(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('budgetId', ParseIntPipe) budgetId: number,
    @Param('lineId', ParseIntPipe) lineId: number,
  ) {
    return this.budgetService.deleteBudgetLine(projectId, budgetId, lineId);
  }

  @Post(':budgetId/boq-map')
  @Permissions('PLANNING.BUDGET.MAP')
  mapBoq(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('budgetId', ParseIntPipe) budgetId: number,
    @Body('boqItemId', ParseIntPipe) boqItemId: number,
    @Body('budgetLineItemId', ParseIntPipe) budgetLineItemId: number,
    @Request() req,
  ) {
    return this.budgetService.linkBoqToBudgetLine(
      projectId,
      budgetId,
      boqItemId,
      budgetLineItemId,
      req.user?.id,
    );
  }

  @Get(':budgetId/summary')
  @Permissions('PLANNING.BUDGET.READ')
  getSummary(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('budgetId', ParseIntPipe) budgetId: number,
  ) {
    return this.budgetService.getBudgetSummary(projectId, budgetId);
  }
}
