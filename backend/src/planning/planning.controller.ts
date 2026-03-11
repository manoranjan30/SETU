import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Request,
  Patch,
  Delete,
  Res,
  UseInterceptors,
  UploadedFile,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlanningService } from './planning.service';
import { PlanningBasis } from './entities/boq-activity-plan.entity';
import { ScheduleVersionService } from './schedule-version.service';
import { ImportExportService } from './import-export.service';
import { LookAheadDto } from './dto/look-ahead.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectContextGuard } from '../projects/guards/project-context.guard';
import { ProjectAssignmentGuard } from '../projects/guards/project-assignment.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { Auditable } from '../audit/auditable.decorator';

@Controller('planning')
@UseGuards(
  JwtAuthGuard,
  ProjectContextGuard,
  ProjectAssignmentGuard,
  PermissionsGuard,
)
export class PlanningController {
  constructor(
    private readonly planningService: PlanningService,
    private readonly versionService: ScheduleVersionService,
    private readonly importService: ImportExportService,
  ) {}

  @Get(':projectId/matrix')
  @Permissions('PLANNING.MATRIX.READ')
  async getMatrix(@Param('projectId') projectId: string) {
    return this.planningService.getProjectPlanningMatrix(parseInt(projectId));
  }

  @Get('mapper/boq/:projectId')
  @Permissions('PLANNING.MATRIX.READ')
  async getMapperBoq(@Param('projectId') projectId: string) {
    return this.planningService.getUnmappedBoqItems(parseInt(projectId));
  }

  @Get(':projectId/stats')
  @Permissions('PLANNING.MATRIX.READ')
  async getStats(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.planningService.getPlanningStats(projectId);
  }

  @Get(':projectId/unlinked-activities')
  @Permissions('PLANNING.MATRIX.READ')
  async getUnlinkedActivities(
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.planningService.getUnlinkedActivities(projectId);
  }

  @Get(':projectId/gap-analysis')
  @Permissions('PLANNING.ANALYSIS.READ')
  async getGapAnalysis(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.planningService.getGapAnalysis(projectId);
  }

  @Get(':projectId/execution-ready')
  @Permissions('PLANNING.MATRIX.READ')
  async getExecutionReadyActivities(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query('wbsNodeId') wbsNodeId?: string,
  ) {
    return this.planningService.findActivitiesWithBoq(
      projectId,
      wbsNodeId ? parseInt(wbsNodeId) : undefined,
    );
  }

  @Post('distribute')
  @Permissions('PLANNING.MATRIX.UPDATE')
  async distributeBoq(
    @Body('boqItemId') boqItemId: number,
    @Body('activityId') activityId: number,
    @Body('quantity') quantity: number,
    @Body('basis') basis?: PlanningBasis,
    @Body('boqSubItemId') boqSubItemId?: number,
    @Body('measurementId') measurementId?: number,
  ) {
    return this.planningService.distributeBoqToActivity(
      boqItemId,
      activityId,
      quantity,
      basis,
      undefined, // mappingType default
      undefined, // mappingRules default
      boqSubItemId,
      measurementId,
    );
  }

  @Post('distribute-wo')
  @Permissions('PLANNING.MATRIX.UPDATE')
  async distributeWoItem(
    @Body('workOrderItemId') workOrderItemId: number,
    @Body('activityId') activityId: number,
    @Body('quantity') quantity: number,
  ) {
    return this.planningService.distributeWoItemToActivity(
      workOrderItemId,
      activityId,
      quantity,
    );
  }

  @Post('unlink')
  @Permissions('PLANNING.MATRIX.UPDATE')
  async unlinkBoq(
    @Body('boqItemId') boqItemId: number,
    @Body('boqSubItemId') boqSubItemId?: number,
    @Body('measurementId') measurementId?: number,
  ) {
    return this.planningService.unlinkBoq(
      boqItemId,
      boqSubItemId,
      measurementId,
    );
  }

  @Post('unlink-wo')
  @Permissions('PLANNING.MATRIX.UPDATE')
  async unlinkWoItem(@Body('workOrderItemId') workOrderItemId: number) {
    return this.planningService.unlinkWoItem(workOrderItemId);
  }

  @Get(':projectId/recovery')
  @Permissions('PLANNING.ANALYSIS.READ')
  async getRecoveryPlans(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.planningService.getRecoveryPlans(projectId);
  }

  @Post('recovery')
  @Permissions('PLANNING.RECOVERY.MANAGE')
  async createRecoveryPlan(@Body() body: any) {
    return this.planningService.createRecoveryPlan(body);
  }

  @Post('measurements')
  @Permissions('EXECUTION.ENTRY.CREATE')
  @Auditable('PROGRESS', 'RECORD_PROGRESS')
  async recordProgress(@Body() body: any) {
    return this.planningService.recordProgress(body);
  }

  @Post('activities/:activityId/complete')
  @Permissions('EXECUTION.ENTRY.UPDATE')
  @Auditable('SCHEDULE', 'COMPLETE_ACTIVITY', 'activityId')
  async completeActivity(
    @Param('activityId', ParseIntPipe) activityId: number,
  ) {
    return this.planningService.completeActivity(activityId);
  }

  @Post('distribute-schedule')
  @Permissions('PLANNING.MATRIX.UPDATE')
  @Auditable('SCHEDULE', 'DISTRIBUTE_ACTIVITIES')
  async distributeSchedule(
    @Body() body: { activityIds: number[]; targetEpsIds: number[] },
    @Request() req,
  ) {
    return this.planningService.distributeActivitiesToEps(
      body.activityIds,
      body.targetEpsIds,
      req.user,
    );
  }

  @Post('undistribute')
  @Permissions('PLANNING.MATRIX.UPDATE')
  @Auditable('SCHEDULE', 'UNDISTRIBUTE_ACTIVITIES')
  undistributeSchedule(
    @Body() body: { activityIds: number[]; targetEpsIds: number[] },
    @Request() req: any,
  ) {
    return this.planningService.undistributeActivities(
      body.activityIds,
      body.targetEpsIds,
      req.user,
    );
  }

  @Get('activities/repair-links')
  @Permissions('ADMIN.SETTINGS.MANAGE')
  async repairLinks() {
    return this.planningService.repairDistributedActivitiesV6();
  }

  @Get('debug/:projectId')
  @Permissions('ADMIN.SETTINGS.MANAGE')
  async debugProject(@Param('projectId') projectId: string) {
    return this.planningService.debugProjectActivities(+projectId);
  }

  @Get(':projectId/distribution-matrix')
  @Permissions('PLANNING.MATRIX.READ')
  async getDistributionMatrix(@Param('projectId') projectId: string) {
    return this.planningService.getDistributionMatrix(+projectId);
  }

  @Get(':projectId/relationships')
  @Permissions('PLANNING.MATRIX.READ')
  async getRelationships(@Param('projectId') projectId: string) {
    return this.planningService.getProjectRelationships(+projectId);
  }

  @Get('debug/activity/:name')
  async debugActivityByName(@Param('name') name: string) {
    return this.planningService.findActivityByName(name);
  }

  @Get('debug/search-eps/:name')
  async searchEps(@Param('name') name: string) {
    return this.planningService.searchEps(name);
  }

  @Post(':projectId/versions')
  @Permissions('SCHEDULE.VERSION.CREATE')
  createVersion(
    @Param('projectId') projectId: string,
    @Body() body: { code: string; type: string; sourceVersionId?: number },
  ) {
    // Map string to enum manually or use pipe. keeping simple for now
    return this.versionService.createVersion(
      +projectId,
      body.code,
      body.type as any,
      body.sourceVersionId,
    );
  }

  @Get(':projectId/versions')
  @Permissions('SCHEDULE.VERSION.READ')
  getVersions(@Param('projectId') projectId: string) {
    return this.versionService.getVersions(+projectId);
  }

  @Get('versions/:versionId/activities')
  @Permissions('SCHEDULE.VERSION.READ')
  getVersionActivities(@Param('versionId') versionId: string) {
    return this.versionService.getVersionActivities(+versionId);
  }

  @Delete(':projectId/versions/:versionId')
  @Permissions('SCHEDULE.VERSION.DELETE')
  deleteVersion(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('versionId', ParseIntPipe) versionId: number,
  ) {
    return this.versionService.deleteVersion(projectId, versionId);
  }

  @Patch('versions/:versionId/activities/:activityId')
  @Permissions('SCHEDULE.VERSION.UPDATE')
  updateVersionActivity(
    @Param('versionId') versionId: string,
    @Param('activityId') activityId: string,
    @Body()
    body: {
      startDate?: Date;
      finishDate?: Date;
      actualStart?: Date;
      actualFinish?: Date;
    },
  ) {
    return this.versionService.updateActivityDate(
      +versionId,
      +activityId,
      body.startDate,
      body.finishDate,
      body.actualStart,
      body.actualFinish,
    );
  }

  // ---------------------------------------------------------
  // REVISION IMPORT / EXPORT
  // ---------------------------------------------------------

  @Get('versions/compare')
  @Permissions('SCHEDULE.VERSION.READ')
  async compareVersions(@Query('v1') v1: string, @Query('v2') v2: string) {
    return this.versionService.compareVersions(+v1, +v2);
  }

  @Post('versions/:versionId/recalculate')
  @Permissions('SCHEDULE.VERSION.UPDATE')
  async recalculateSchedule(@Param('versionId') versionId: string) {
    return this.versionService.recalculateSchedule(+versionId);
  }

  @Get('versions/:versionId/export')
  @Permissions('SCHEDULE.VERSION.READ')
  async exportVersion(
    @Param('versionId') versionId: string,
    @Res() res: Response,
  ) {
    const activities =
      await this.versionService.getVersionActivities(+versionId);

    // Fetch Relationships for this project
    // Assuming all activities belong to the same project (which they should)
    let relationships: any[] = [];
    const projectId = activities[0]?.activity?.projectId; // Get from first av

    if (projectId) {
      relationships =
        await this.planningService.getProjectRelationships(projectId);
    }

    const buffer = this.importService.generateRevisionTemplate(
      activities,
      relationships,
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Schedule_R${versionId}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Post(':projectId/versions/import-revision')
  @Permissions('SCHEDULE.VERSION.CREATE')
  @UseInterceptors(FileInterceptor('file'))
  async importRevision(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { sourceVersionId: string; code: string },
  ) {
    const updates = this.importService.parseRevisionFile(file.buffer);
    return this.versionService.createRevisionWithUpdates(
      +projectId,
      +body.sourceVersionId,
      updates,
      body.code || 'Rev',
    );
  }

  @Post('look-ahead')
  @Permissions('PLANNING.LOOKAHEAD.CREATE')
  async getLookAhead(@Body() body: LookAheadDto) {
    return this.planningService.getLookAheadResources(
      body.projectId,
      body.startDate,
      body.endDate,
    );
  }
}
