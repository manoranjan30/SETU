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
} from '@nestjs/common';
import { PlanningService } from './planning.service';
import { PlanningBasis } from './entities/boq-activity-plan.entity';
import { ScheduleVersionService } from './schedule-version.service';
import { ImportExportService } from './import-export.service';
import { LookAheadDto } from './dto/look-ahead.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

@Controller('planning')
export class PlanningController {
  constructor(
    private readonly planningService: PlanningService,
    private readonly versionService: ScheduleVersionService,
    private readonly importService: ImportExportService,
  ) {}

  @Get(':projectId/matrix')
  async getMatrix(@Param('projectId') projectId: string) {
    return this.planningService.getProjectPlanningMatrix(parseInt(projectId));
  }

  @Get('mapper/boq/:projectId')
  async getMapperBoq(@Param('projectId') projectId: string) {
    return this.planningService.getUnmappedBoqItems(parseInt(projectId));
  }

  @Get(':projectId/stats')
  async getStats(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.planningService.getPlanningStats(projectId);
  }

  @Get(':projectId/unlinked-activities')
  async getUnlinkedActivities(
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.planningService.getUnlinkedActivities(projectId);
  }

  @Get(':projectId/gap-analysis')
  async getGapAnalysis(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.planningService.getGapAnalysis(projectId);
  }

  @Get(':projectId/execution-ready')
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

  @Post('unlink')
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

  @Get(':projectId/recovery')
  async getRecoveryPlans(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.planningService.getRecoveryPlans(projectId);
  }

  @Post('recovery')
  async createRecoveryPlan(@Body() body: any) {
    return this.planningService.createRecoveryPlan(body);
  }

  @Post('measurements')
  async recordProgress(@Body() body: any) {
    return this.planningService.recordProgress(body);
  }

  @Post('activities/:activityId/complete')
  async completeActivity(
    @Param('activityId', ParseIntPipe) activityId: number,
  ) {
    return this.planningService.completeActivity(activityId);
  }

  @Post('distribute-schedule')
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

  @Post('undistribute-schedule')
  async undistributeSchedule(
    @Body() body: { activityIds: number[]; targetEpsIds: number[] },
  ) {
    return this.planningService.undistributeActivities(
      body.activityIds,
      body.targetEpsIds,
    );
  }

  @Get('activities/repair-links')
  async repairLinks() {
    return this.planningService.repairDistributedActivitiesV6();
  }

  @Get('debug/:projectId')
  async debugProject(@Param('projectId') projectId: string) {
    return this.planningService.debugProjectActivities(+projectId);
  }

  @Get(':projectId/distribution-matrix')
  async getDistributionMatrix(@Param('projectId') projectId: string) {
    return this.planningService.getDistributionMatrix(+projectId);
  }

  @Get(':projectId/relationships')
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
  getVersions(@Param('projectId') projectId: string) {
    return this.versionService.getVersions(+projectId);
  }

  @Get('versions/:versionId/activities')
  getVersionActivities(@Param('versionId') versionId: string) {
    return this.versionService.getVersionActivities(+versionId);
  }

  @Patch('versions/:versionId/activities/:activityId')
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
  async compareVersions(@Query('v1') v1: string, @Query('v2') v2: string) {
    return this.versionService.compareVersions(+v1, +v2);
  }

  @Post('versions/:versionId/recalculate')
  async recalculateSchedule(@Param('versionId') versionId: string) {
    return this.versionService.recalculateSchedule(+versionId);
  }

  @Get('versions/:versionId/export')
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
  async getLookAhead(@Body() body: LookAheadDto) {
    return this.planningService.getLookAheadResources(
      body.projectId,
      body.startDate,
      body.endDate,
    );
  }
}
