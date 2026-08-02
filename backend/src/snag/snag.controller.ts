import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectContextGuard } from '../projects/guards/project-context.guard';
import { ProjectAssignmentGuard } from '../projects/guards/project-assignment.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { SnagService } from './snag.service';
import {
  AdvanceApprovalDto,
  BulkCloseSnagItemsDto,
  BulkRectifySnagItemsDto,
  CloseSnagItemDto,
  CreateSnagProcessActivityDto,
  CreateSnagItemDto,
  CreateSnagListDto,
  FinalClosureSnagRoundDto,
  HoldSnagItemDto,
  MoveSnagProcessActivityDto,
  RectifySnagItemDto,
  RejectSnagRectificationDto,
  ReorderSnagProcessActivitiesDto,
  ReorderSnagProcessStepsDto,
  ResetSnagRoundDto,
  SkipSnagRoundDto,
  SubmitDesnagApprovalDto,
  SubmitSnagPhaseDto,
  UpsertSnagCommonPointDto,
  UpsertSnagProcessStepDto,
  UpdateSnagCommonChecklistDto,
} from './dto/snag.dto';

@Controller('snag')
@UseGuards(
  JwtAuthGuard,
  ProjectContextGuard,
  ProjectAssignmentGuard,
  PermissionsGuard,
)
export class SnagController {
  constructor(private readonly service: SnagService) {}

  @Get(':projectId/config/process-steps')
  @Permissions('QUALITY.SNAG_CONFIG.READ')
  listProcessSteps(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.service.listProcessSteps(projectId);
  }

  @Post(':projectId/config/process-steps')
  @Permissions('QUALITY.SNAG_CONFIG.MANAGE')
  createProcessStep(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: UpsertSnagProcessStepDto,
  ) {
    return this.service.saveProcessStep(projectId, dto);
  }

  @Post(':projectId/config/process-steps/:stepId')
  @Permissions('QUALITY.SNAG_CONFIG.MANAGE')
  updateProcessStep(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('stepId', ParseIntPipe) stepId: number,
    @Body() dto: UpsertSnagProcessStepDto,
  ) {
    return this.service.saveProcessStep(projectId, dto, stepId);
  }

  @Delete(':projectId/config/process-steps/:stepId')
  @Permissions('QUALITY.SNAG_CONFIG.MANAGE')
  deleteProcessStep(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('stepId', ParseIntPipe) stepId: number,
  ) {
    return this.service.deleteProcessStep(projectId, stepId);
  }

  @Post(':projectId/config/process-step-order')
  @Permissions('QUALITY.SNAG_CONFIG.MANAGE')
  reorderProcessSteps(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: ReorderSnagProcessStepsDto,
  ) {
    return this.service.reorderProcessSteps(projectId, dto);
  }

  @Get(':projectId/config/activity-map')
  @Permissions('QUALITY.SNAG_CONFIG.READ')
  listActivityMap(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.service.listActivityMap(projectId);
  }

  @Post(':projectId/config/activity-map')
  @Permissions('QUALITY.SNAG_CONFIG.MANAGE')
  addProcessActivity(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateSnagProcessActivityDto,
  ) {
    return this.service.addProcessActivity(projectId, dto);
  }

  @Post(':projectId/config/activity-map/reorder')
  @Permissions('QUALITY.SNAG_CONFIG.MANAGE')
  reorderProcessActivities(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: ReorderSnagProcessActivitiesDto,
  ) {
    return this.service.reorderProcessActivities(projectId, dto);
  }

  @Post(':projectId/config/activity-map/:mappingId/move')
  @Permissions('QUALITY.SNAG_CONFIG.MANAGE')
  moveProcessActivity(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('mappingId', ParseIntPipe) mappingId: number,
    @Body() dto: MoveSnagProcessActivityDto,
  ) {
    return this.service.moveProcessActivity(projectId, mappingId, dto);
  }

  @Delete(':projectId/config/activity-map/:mappingId')
  @Permissions('QUALITY.SNAG_CONFIG.MANAGE')
  deleteProcessActivity(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('mappingId', ParseIntPipe) mappingId: number,
  ) {
    return this.service.deleteProcessActivity(projectId, mappingId);
  }

  @Post(':projectId/config/activity-map/:mappingId/common-points')
  @Permissions('QUALITY.SNAG_CONFIG.MANAGE')
  createCommonPoint(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('mappingId', ParseIntPipe) mappingId: number,
    @Body() dto: UpsertSnagCommonPointDto,
  ) {
    return this.service.saveCommonPoint(projectId, mappingId, dto);
  }

  @Post(':projectId/config/activity-map/:mappingId/common-points/:pointId')
  @Permissions('QUALITY.SNAG_CONFIG.MANAGE')
  updateCommonPoint(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('mappingId', ParseIntPipe) mappingId: number,
    @Param('pointId', ParseIntPipe) pointId: number,
    @Body() dto: UpsertSnagCommonPointDto,
  ) {
    return this.service.saveCommonPoint(projectId, mappingId, dto, pointId);
  }

  @Delete(':projectId/config/common-points/:pointId')
  @Permissions('QUALITY.SNAG_CONFIG.MANAGE')
  deleteCommonPoint(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('pointId', ParseIntPipe) pointId: number,
  ) {
    return this.service.deleteCommonPoint(projectId, pointId);
  }

  @Get(':projectId/units')
  @Permissions('QUALITY.SNAG.READ')
  listUnits(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.service.listUnits(projectId);
  }

  @Get(':projectId/analytics')
  @Permissions('QUALITY.SNAG.READ')
  getAnalytics(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.service.getProjectAnalytics(projectId);
  }

  @Post(':projectId/lists')
  @Permissions('QUALITY.SNAG.CREATE')
  createList(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateSnagListDto,
    @Request() req: any,
  ) {
    return this.service.createOrGetList(projectId, dto, req.user?.id);
  }

  @Post(':projectId/lists/:listId/reset-ready')
  @Permissions('QUALITY.SNAG.APPROVE')
  resetReady(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('listId', ParseIntPipe) listId: number,
  ) {
    return this.service.resetReadyForSnag(projectId, listId);
  }

  @Post(':projectId/lists/:listId/mark-current-round-ready')
  @Permissions('QUALITY.SNAG.CREATE')
  markCurrentRoundReady(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Request() req: any,
  ) {
    return this.service.markCurrentRoundReady(projectId, listId, req.user?.id);
  }

  @Get(':projectId/lists/:listId')
  @Permissions('QUALITY.SNAG.READ')
  getList(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('listId', ParseIntPipe) listId: number,
  ) {
    return this.service.getListDetail(projectId, listId);
  }

  @Get(':projectId/lists/:listId/rounds/:roundNumber/status-report.pdf')
  @Permissions('QUALITY.SNAG.READ')
  async downloadStatusReport(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Param('roundNumber', ParseIntPipe) roundNumber: number,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.service.generateStatusReportPdf(
      projectId,
      listId,
      roundNumber,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="snag-status-${listId}-round-${roundNumber}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  }

  @Post(':projectId/lists/:listId/common-checklist')
  @Permissions('QUALITY.SNAG.UPDATE')
  updateCommonChecklist(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Body() dto: UpdateSnagCommonChecklistDto,
    @Request() req: any,
  ) {
    return this.service.updateCommonChecklist(
      projectId,
      listId,
      dto,
      req.user?.id,
    );
  }

  @Post(':projectId/lists/:listId/rounds/:roundNumber/items')
  @Permissions('QUALITY.SNAG.APPROVE')
  addItem(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Param('roundNumber', ParseIntPipe) roundNumber: number,
    @Body() dto: CreateSnagItemDto,
    @Request() req: any,
  ) {
    return this.service.addSnagItem(projectId, listId, roundNumber, dto, req.user?.id);
  }

  @Post(':projectId/lists/:listId/rounds/:roundNumber/items/bulk-rectify')
  @Permissions('QUALITY.SNAG.UPDATE')
  bulkRectifyItems(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Param('roundNumber', ParseIntPipe) roundNumber: number,
    @Body() dto: BulkRectifySnagItemsDto,
    @Request() req: any,
  ) {
    return this.service.bulkRectifyItems(
      projectId,
      listId,
      roundNumber,
      dto,
      req.user?.id,
    );
  }

  @Post(':projectId/lists/:listId/rounds/:roundNumber/items/bulk-close')
  @Permissions('QUALITY.SNAG.APPROVE')
  bulkCloseItems(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('listId', ParseIntPipe) listId: number,
    @Param('roundNumber', ParseIntPipe) roundNumber: number,
    @Body() dto: BulkCloseSnagItemsDto,
    @Request() req: any,
  ) {
    return this.service.bulkCloseItems(
      projectId,
      listId,
      roundNumber,
      dto,
      req.user?.id,
    );
  }

  @Post(':projectId/items/:itemId/rectify')
  @Permissions('QUALITY.SNAG.UPDATE')
  rectifyItem(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: RectifySnagItemDto,
    @Request() req: any,
  ) {
    return this.service.rectifyItem(projectId, itemId, dto, req.user?.id);
  }

  @Post(':projectId/items/:itemId/close')
  @Permissions('QUALITY.SNAG.APPROVE')
  closeItem(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: CloseSnagItemDto,
    @Request() req: any,
  ) {
    return this.service.closeItem(projectId, itemId, dto, req.user?.id);
  }

  @Post(':projectId/items/:itemId/reject-rectification')
  @Permissions('QUALITY.SNAG.APPROVE')
  rejectRectification(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: RejectSnagRectificationDto,
    @Request() req: any,
  ) {
    return this.service.rejectRectification(projectId, itemId, dto, req.user?.id);
  }

  @Post(':projectId/items/:itemId/hold')
  @Permissions('QUALITY.SNAG.UPDATE')
  holdItem(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: HoldSnagItemDto,
  ) {
    return this.service.holdItem(projectId, itemId, dto);
  }

  @Delete(':projectId/items/:itemId')
  @Permissions('QUALITY.SNAG.DELETE')
  deleteItem(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Request() req: any,
  ) {
    return this.service.deleteItem(projectId, itemId, req.user);
  }

  @Post(':projectId/rounds/:roundId/submit-snag')
  @Permissions('QUALITY.SNAG.UPDATE')
  submitSnagPhase(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('roundId', ParseIntPipe) roundId: number,
    @Body() dto: SubmitSnagPhaseDto,
    @Request() req: any,
  ) {
    return this.service.submitSnagPhase(projectId, roundId, dto, req.user?.id);
  }

  @Post(':projectId/rounds/:roundId/submit-release')
  @Permissions('QUALITY.SNAG.UPDATE')
  submitRelease(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('roundId', ParseIntPipe) roundId: number,
    @Body() dto: SubmitDesnagApprovalDto,
    @Request() req: any,
  ) {
    return this.service.submitDesnagForApproval(projectId, roundId, dto, req.user?.id);
  }

  @Post(':projectId/rounds/:roundId/final-closure')
  @Permissions('QUALITY.SNAG.APPROVE')
  finalClosure(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('roundId', ParseIntPipe) roundId: number,
    @Body() dto: FinalClosureSnagRoundDto,
    @Request() req: any,
  ) {
    return this.service.finalClosureRound(projectId, roundId, dto, req.user?.id);
  }

  @Post(':projectId/rounds/:roundId/levels/:levelOrder/close')
  @Permissions('QUALITY.SNAG.APPROVE')
  closeLevel(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('roundId', ParseIntPipe) roundId: number,
    @Param('levelOrder', ParseIntPipe) levelOrder: number,
    @Body() dto: FinalClosureSnagRoundDto,
    @Request() req: any,
  ) {
    return this.service.closeVerifierLevel(
      projectId,
      roundId,
      dto,
      req.user?.id,
      levelOrder,
    );
  }

  @Post(':projectId/rounds/:roundId/skip')
  @Permissions('QUALITY.SNAG.APPROVE')
  skipRound(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('roundId', ParseIntPipe) roundId: number,
    @Body() dto: SkipSnagRoundDto,
    @Request() req: any,
  ) {
    return this.service.skipRound(projectId, roundId, dto, req.user?.id);
  }

  @Post(':projectId/rounds/:roundId/reset')
  @Permissions('QUALITY.SNAG.DELETE')
  resetRound(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('roundId', ParseIntPipe) roundId: number,
    @Body() dto: ResetSnagRoundDto,
    @Request() req: any,
  ) {
    return this.service.resetRound(projectId, roundId, dto, req.user?.id);
  }

  @Post(':projectId/approvals/:approvalId/advance')
  @Permissions('QUALITY.SNAG.APPROVE')
  advanceApproval(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('approvalId', ParseIntPipe) approvalId: number,
    @Body() dto: AdvanceApprovalDto,
    @Request() req: any,
  ) {
    return this.service.advanceApproval(projectId, approvalId, dto, req.user?.id);
  }
}
