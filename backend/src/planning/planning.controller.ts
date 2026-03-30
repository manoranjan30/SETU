import {
  Controller,
  Get,
  Post,
  Put,
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
  BadRequestException,
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
import { ReleaseStrategyService } from './release-strategy.service';
import { ApprovalContextDto, ReleaseStrategyDto } from './dto/release-strategy.dto';
import { TowerProgressService } from './tower-progress.service';
import { BuildingLineCoordinateService } from './building-line-coordinate.service';
import { IssueTrackerService } from './issue-tracker.service';
import {
  AddDeptToFlowDto,
  CloseIssueTrackerIssueDto,
  CoordinatorCloseStepDto,
  CreateIssueTrackerIssueDto,
  CreateIssueTrackerTagDto,
  ReorderDepartmentsDto,
  ReorderFlowDto,
  RespondIssueTrackerStepDto,
  SetDeptProjectConfigDto,
  UpdateCommitmentDateDto,
  UpdateIssueDto,
  UpdateIssuePriorityDto,
  UpsertGlobalDepartmentDto,
} from './dto/issue-tracker.dto';

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
    private readonly releaseStrategyService: ReleaseStrategyService,
    private readonly towerProgressService: TowerProgressService,
    private readonly buildingLineCoordinateService: BuildingLineCoordinateService,
    private readonly issueTrackerService: IssueTrackerService,
  ) {}

  // ── Tower Lens — 3D progress visualization ────────────────────────────────

  /// Returns per-floor aggregated progress data for all towers in a project.
  /// Single optimized endpoint used by the mobile Tower Lens feature.
  @Get(':projectId/tower-progress')
  @Permissions('PLANNING.MATRIX.READ')
  async getTowerProgress(
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.towerProgressService.getTowerProgress(projectId);
  }

  @Get(':projectId/release-strategies')
  @Permissions('RELEASE_STRATEGY.READ')
  getReleaseStrategies(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query('status') status?: string,
    @Query('moduleCode') moduleCode?: string,
    @Query('processCode') processCode?: string,
    @Query('search') search?: string,
  ) {
    return this.releaseStrategyService.listStrategies(projectId, {
      status,
      moduleCode,
      processCode,
      search,
    });
  }

  @Post(':projectId/release-strategies')
  @Permissions('RELEASE_STRATEGY.WRITE')
  createReleaseStrategy(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: ReleaseStrategyDto,
    @Request() req,
  ) {
    return this.releaseStrategyService.createStrategy(projectId, body, req.user?.id);
  }

  @Get(':projectId/release-strategies/:id')
  @Permissions('RELEASE_STRATEGY.READ')
  getReleaseStrategy(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.releaseStrategyService.getStrategy(projectId, id);
  }

  @Put(':projectId/release-strategies/:id')
  @Permissions('RELEASE_STRATEGY.WRITE')
  updateReleaseStrategy(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReleaseStrategyDto,
    @Request() req,
  ) {
    return this.releaseStrategyService.updateStrategy(projectId, id, body, req.user?.id);
  }

  @Delete(':projectId/release-strategies/:id')
  @Permissions('RELEASE_STRATEGY.WRITE')
  deleteReleaseStrategy(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.releaseStrategyService.deleteStrategy(projectId, id);
  }

  @Post(':projectId/release-strategies/:id/clone')
  @Permissions('RELEASE_STRATEGY.WRITE')
  cloneReleaseStrategy(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.releaseStrategyService.cloneStrategy(projectId, id, req.user?.id);
  }

  @Post(':projectId/release-strategies/:id/activate')
  @Permissions('RELEASE_STRATEGY.ACTIVATE')
  activateReleaseStrategy(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.releaseStrategyService.activateStrategy(projectId, id, req.user?.id);
  }

  @Post(':projectId/release-strategies/:id/deactivate')
  @Permissions('RELEASE_STRATEGY.ACTIVATE')
  deactivateReleaseStrategy(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.releaseStrategyService.deactivateStrategy(projectId, id);
  }

  @Post(':projectId/release-strategies/:id/simulate')
  @Permissions('RELEASE_STRATEGY.SIMULATE')
  simulateReleaseStrategy(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ApprovalContextDto,
  ) {
    return this.releaseStrategyService.simulateStrategy(projectId, id, body);
  }

  @Get(':projectId/release-strategy-actors')
  @Permissions('RELEASE_STRATEGY.READ')
  getReleaseStrategyActors(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.releaseStrategyService.getEligibleActors(projectId);
  }

  @Get(':projectId/release-strategy-conflicts')
  @Permissions('RELEASE_STRATEGY.READ')
  getReleaseStrategyConflicts(
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.releaseStrategyService.getConflicts(projectId);
  }

  @Get(':projectId/building-line-coordinates')
  @Permissions('PLANNING.MATRIX.READ')
  getBuildingLineCoordinates(
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.buildingLineCoordinateService.getStructure(projectId);
  }

  @Put(':projectId/building-line-coordinates/:epsNodeId')
  @Permissions('PLANNING.MATRIX.UPDATE')
  updateBuildingLineCoordinate(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('epsNodeId', ParseIntPipe) epsNodeId: number,
    @Body()
    body: {
      coordinatesText?: string | null;
      heightMeters?: number | null;
      customFeatures?: any[] | null;
      structureSnapshot?: any;
    },
    @Request() req,
  ) {
    return this.buildingLineCoordinateService.upsertCoordinate(
      projectId,
      epsNodeId,
      body,
      req.user?.id,
    );
  }

  @Post('release-engine/resolve-strategy')
  @Permissions('RELEASE_STRATEGY.SIMULATE')
  resolveStrategy(@Body() body: ApprovalContextDto) {
    return this.releaseStrategyService.resolveStrategy(body.projectId, body);
  }

  // ─── Issue Tracker: Users ──────────────────────────────────────────────────
  @Get(':projectId/issue-tracker/users')
  listIssueTrackerUsers(@Param('projectId', ParseIntPipe) _projectId: number) {
    return this.issueTrackerService.listUsers();
  }

  // ─── Issue Tracker: Project Dept Config ───────────────────────────────────
  @Get(':projectId/issue-tracker/dept-config')
  listDeptConfig(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.issueTrackerService.listDeptConfig(projectId);
  }

  @Post(':projectId/issue-tracker/dept-config')
  @Permissions('PLANNING.MATRIX.UPDATE')
  setDeptConfig(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: SetDeptProjectConfigDto,
  ) {
    return this.issueTrackerService.setDeptConfig(projectId, body);
  }

  @Delete(':projectId/issue-tracker/dept-config/:configId')
  @Permissions('PLANNING.MATRIX.UPDATE')
  removeDeptConfig(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('configId', ParseIntPipe) configId: number,
  ) {
    return this.issueTrackerService.removeDeptConfig(projectId, configId);
  }

  // ─── Issue Tracker: Tags ───────────────────────────────────────────────────
  @Get(':projectId/issue-tracker/tags')
  listIssueTrackerTags(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.issueTrackerService.listTags(projectId);
  }

  @Post(':projectId/issue-tracker/tags')
  @Permissions('PLANNING.MATRIX.UPDATE')
  createIssueTrackerTag(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: CreateIssueTrackerTagDto,
  ) {
    return this.issueTrackerService.createTag(projectId, body);
  }

  @Put(':projectId/issue-tracker/tags/:id')
  @Permissions('PLANNING.MATRIX.UPDATE')
  updateIssueTrackerTag(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateIssueTrackerTagDto,
  ) {
    return this.issueTrackerService.updateTag(projectId, id, body);
  }

  // ─── Issue Tracker: Issues ─────────────────────────────────────────────────
  @Get(':projectId/issue-tracker/issues')
  listIssueTrackerIssues(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query('scope') scope: string,
    @Query('status') status: string,
    @Query('priority') priority: string,
    @Query('departmentId') departmentId: string,
    @Request() req,
  ) {
    return this.issueTrackerService.listIssues(
      projectId, req.user, scope, status, priority,
      departmentId ? parseInt(departmentId) : undefined,
    );
  }

  @Get(':projectId/issue-tracker/issues/:id')
  getIssueTrackerIssue(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.issueTrackerService.getIssueDetail(projectId, id, req.user);
  }

  @Post(':projectId/issue-tracker/issues')
  createIssueTrackerIssue(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: CreateIssueTrackerIssueDto,
    @Request() req,
  ) {
    return this.issueTrackerService.createIssue(projectId, body, req.user);
  }

  @Patch(':projectId/issue-tracker/issues/:id')
  updateIssueTrackerIssue(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateIssueDto,
    @Request() req,
  ) {
    return this.issueTrackerService.updateIssue(projectId, id, body, req.user);
  }

  @Patch(':projectId/issue-tracker/issues/:id/priority')
  updateIssueTrackerPriority(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateIssuePriorityDto,
    @Request() req,
  ) {
    return this.issueTrackerService.updatePriority(projectId, id, body, req.user);
  }

  @Post(':projectId/issue-tracker/issues/:id/respond')
  respondIssueTrackerIssue(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RespondIssueTrackerStepDto,
    @Request() req,
  ) {
    return this.issueTrackerService.respondToIssue(projectId, id, body, req.user);
  }

  @Post(':projectId/issue-tracker/issues/:id/coordinator-close')
  coordinatorCloseIssueStep(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CoordinatorCloseStepDto,
    @Request() req,
  ) {
    return this.issueTrackerService.coordinatorCloseStep(projectId, id, body, req.user);
  }

  @Post(':projectId/issue-tracker/issues/:id/update-commitment')
  updateIssueCommitmentDate(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCommitmentDateDto,
    @Request() req,
  ) {
    return this.issueTrackerService.updateCommitmentDate(projectId, id, body, req.user);
  }

  @Post(':projectId/issue-tracker/issues/:id/close')
  closeIssueTrackerIssue(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CloseIssueTrackerIssueDto,
    @Request() req,
  ) {
    return this.issueTrackerService.closeIssue(projectId, id, body, req.user);
  }

  // ─── Issue Tracker: Flow Editing ──────────────────────────────────────────
  @Post(':projectId/issue-tracker/issues/:id/flow/add-dept')
  addDeptToIssueFlow(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AddDeptToFlowDto,
    @Request() req,
  ) {
    return this.issueTrackerService.addDeptToFlow(projectId, id, body, req.user);
  }

  @Delete(':projectId/issue-tracker/issues/:id/flow/step/:stepId')
  removeDeptFromIssueFlow(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('stepId', ParseIntPipe) stepId: number,
    @Request() req,
  ) {
    return this.issueTrackerService.removeDeptFromFlow(projectId, id, stepId, req.user);
  }

  @Patch(':projectId/issue-tracker/issues/:id/flow/reorder')
  reorderIssueFlow(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReorderFlowDto,
    @Request() req,
  ) {
    return this.issueTrackerService.reorderFlow(projectId, id, body, req.user);
  }

  // ─── Issue Tracker: Kanban ─────────────────────────────────────────────────
  @Get(':projectId/issue-tracker/kanban')
  getIssueTrackerKanban(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Request() req,
  ) {
    return this.issueTrackerService.getKanban(projectId, req.user);
  }

  // ─── Issue Tracker: Activity Log ──────────────────────────────────────────
  @Get(':projectId/issue-tracker/issues/:id/activity')
  getIssueActivity(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.issueTrackerService.getActivityLog(projectId, id);
  }

  // ─── Issue Tracker: Attachments ───────────────────────────────────────────
  @Get(':projectId/issue-tracker/issues/:id/attachments')
  listIssueAttachments(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.issueTrackerService.listAttachments(projectId, id);
  }

  @Delete(':projectId/issue-tracker/issues/:id/attachments/:aid')
  deleteIssueAttachment(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('aid', ParseIntPipe) aid: number,
    @Request() req,
  ) {
    return this.issueTrackerService.removeAttachment(projectId, id, aid, req.user);
  }

  // ─── Issue Tracker: Notifications ─────────────────────────────────────────
  @Get(':projectId/issue-tracker/notifications')
  getMyIssueNotifications(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Request() req,
  ) {
    return this.issueTrackerService.getMyNotifications(projectId, req.user);
  }

  @Patch(':projectId/issue-tracker/notifications/read-all')
  markAllNotificationsRead(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Request() req,
  ) {
    return this.issueTrackerService.markAllNotificationsRead(projectId, req.user);
  }

  @Patch(':projectId/issue-tracker/notifications/:nid/read')
  markNotificationRead(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('nid', ParseIntPipe) nid: number,
    @Request() req,
  ) {
    return this.issueTrackerService.markNotificationRead(projectId, nid, req.user);
  }

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

  @Post('undistribute-schedule')
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

  @Get(':projectId/distribution-matrix/export')
  @Permissions('PLANNING.MATRIX.READ')
  async exportDistributionMatrix(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query('mode') mode: 'linked' | 'template' = 'template',
    @Res() res: Response,
  ) {
    const effectiveMode = mode === 'linked' ? 'linked' : 'template';
    const buffer = await this.planningService.exportDistributionMatrixCsv(
      projectId,
      effectiveMode,
    );
    const suffix = effectiveMode === 'linked' ? 'linked' : 'template';
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="schedule_distribution_${projectId}_${suffix}.csv"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Post(':projectId/distribution-matrix/import/preview')
  @Permissions('PLANNING.MATRIX.UPDATE')
  @UseInterceptors(FileInterceptor('file'))
  async previewDistributionMatrixImport(
    @Param('projectId', ParseIntPipe) projectId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body('mapping') mappingRaw?: string,
  ): Promise<any> {
    if (!file) throw new BadRequestException('File is required');
    let mapping: Record<string, string> | undefined;
    if (mappingRaw) {
      try {
        mapping = JSON.parse(mappingRaw);
      } catch {
        throw new BadRequestException('Invalid column mapping payload');
      }
    }
    return this.planningService.previewDistributionImport(
      projectId,
      file.buffer,
      mapping,
    );
  }

  @Post(':projectId/distribution-matrix/import/commit')
  @Permissions('PLANNING.MATRIX.UPDATE')
  async commitDistributionMatrixImport(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: { data: any[] },
    @Request() req: any,
  ): Promise<any> {
    return this.planningService.commitDistributionImport(
      projectId,
      body.data || [],
      req.user,
    );
  }

  @Get(':projectId/wo-mapper/export')
  @Permissions('PLANNING.MATRIX.READ')
  async exportWoMapperMatrix(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Res() res: Response,
  ) {
    const buffer = await this.planningService.exportWoMapperMatrixWorkbook(
      projectId,
    );
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="wo_qty_mapper_${projectId}_matrix.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Post(':projectId/wo-mapper/import/preview')
  @Permissions('PLANNING.MATRIX.UPDATE')
  @UseInterceptors(FileInterceptor('file'))
  async previewWoMapperImport(
    @Param('projectId', ParseIntPipe) projectId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body('mapping') mappingRaw?: string,
  ): Promise<any> {
    if (!file) throw new BadRequestException('File is required');
    let mapping: Record<string, string> | undefined;
    if (mappingRaw) {
      try {
        mapping = JSON.parse(mappingRaw);
      } catch {
        throw new BadRequestException('Invalid column mapping payload');
      }
    }
    return this.planningService.previewWoMapperImport(
      projectId,
      file.buffer,
      mapping,
    );
  }

  @Post(':projectId/wo-mapper/import/commit')
  @Permissions('PLANNING.MATRIX.UPDATE')
  async commitWoMapperImport(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: { data: any[] },
  ): Promise<any> {
    return this.planningService.commitWoMapperImport(projectId, body.data || []);
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
