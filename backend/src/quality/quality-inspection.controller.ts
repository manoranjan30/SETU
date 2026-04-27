import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { QualityInspectionService } from './quality-inspection.service';
import { QualityReportService } from './quality-report.service';
import { InspectionWorkflowService } from './inspection-workflow.service';
import type {
  UpdateInspectionStatusDto,
  ExpandGoSeriesDto,
} from './quality-inspection.service';
import { CreateInspectionDto } from './dto/create-inspection.dto';
import { Auditable } from '../audit/auditable.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { Res } from '@nestjs/common';

@Controller('quality/inspections')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QualityInspectionController {
  constructor(
    private readonly service: QualityInspectionService,
    private readonly reportService: QualityReportService,
    private readonly workflowService: InspectionWorkflowService,
  ) {}

  @Get()
  @Permissions('QUALITY.INSPECTION.READ')
  getInspections(
    @Query('projectId', ParseIntPipe) projectId: number,
    @Query('epsNodeId', new ParseIntPipe({ optional: true }))
    epsNodeId?: number,
    @Query('listId', new ParseIntPipe({ optional: true })) listId?: number,
    @Request() req?,
  ) {
    return this.service.getInspections(
      projectId,
      epsNodeId,
      listId,
      req?.user?.userId || req?.user?.id,
      req?.user?.role === 'Admin' || req?.user?.roles?.includes('Admin'),
    );
  }

  @Get('active-vendors')
  @Permissions('QUALITY.INSPECTION.READ')
  getActiveVendors(@Query('projectId', ParseIntPipe) projectId: number) {
    return this.service.getActiveVendors(projectId);
  }

  @Get('my-pending')
  @Permissions('QUALITY.INSPECTION.READ')
  getMyPendingInspections(
    @Query('projectId', ParseIntPipe) projectId: number,
    @Request() req,
  ) {
    const userId = req.user?.userId || req.user?.id;
    return this.service.getMyPendingInspections(projectId, userId);
  }

  @Get('approval-dashboard')
  @Permissions('QUALITY.INSPECTION.READ')
  getApprovalDashboard(
    @Query('projectId', ParseIntPipe) projectId: number,
    @Request() req,
  ) {
    return this.service.getApprovalDashboard(
      projectId,
      req.user?.userId || req.user?.id,
    );
  }

  @Get('unit-progress')
  @Permissions('QUALITY.INSPECTION.READ')
  getUnitProgress(
    @Query('projectId', ParseIntPipe) projectId: number,
    @Query('epsNodeId', ParseIntPipe) epsNodeId: number,
    @Query('activityId', ParseIntPipe) activityId: number,
  ) {
    return this.service.getUnitProgress(projectId, epsNodeId, activityId);
  }

  @Get(':id')
  @Permissions('QUALITY.INSPECTION.READ')
  getInspectionDetails(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.getInspectionDetails(
      id,
      req?.user?.userId || req?.user?.id,
      req?.user?.role === 'Admin' || req?.user?.roles?.includes('Admin'),
    );
  }

  @Get(':id/report')
  @Permissions('QUALITY.INSPECTION.READ')
  async getInspectionReport(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: any,
  ) {
    const pdfBuffer = await this.reportService.generateInspectionReport(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="RFI_Report_${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }

  @Post()
  @Permissions('QUALITY.INSPECTION.RAISE')
  @Auditable('QUALITY', 'RAISE_RFI')
  create(@Body() dto: CreateInspectionDto, @Request() req) {
    return this.service.create(dto, req.user?.id);
  }

  @Post('expand-go')
  @Permissions('QUALITY.INSPECTION.RAISE')
  @Auditable('QUALITY', 'EXPAND_GO_SERIES')
  expandGoSeries(@Body() dto: ExpandGoSeriesDto) {
    return this.service.expandGoSeries(dto);
  }

  @Patch(':id/status')
  @Permissions('QUALITY.INSPECTION.APPROVE')
  @Auditable('QUALITY', 'UPDATE_RFI_STATUS', 'id')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInspectionStatusDto,
    @Request() req,
  ) {
    return this.service.updateStatus(id, dto, req.user?.id);
  }

  @Patch('stage/:stageId')
  @Permissions('QUALITY.INSPECTION.READ')
  updateStageStatus(
    @Param('stageId', ParseIntPipe) stageId: number,
    @Body() data: any,
    @Request() req,
  ) {
    return this.service.updateStageStatus(stageId, {
      ...data,
      userId: req.user?.userId || req.user?.id,
      isAdmin: req.user?.role === 'Admin' || req.user?.roles?.includes('Admin'),
    });
  }

  @Patch(':id/stages/:stageId')
  @Permissions('QUALITY.INSPECTION.READ')
  updateStageStatusForInspection(
    @Param('stageId', ParseIntPipe) stageId: number,
    @Body() data: any,
    @Request() req,
  ) {
    return this.service.updateStageStatus(stageId, {
      ...data,
      userId: req.user?.userId || req.user?.id,
      isAdmin: req.user?.role === 'Admin' || req.user?.roles?.includes('Admin'),
    });
  }

  @Post('stage/:stageId')
  @Permissions('QUALITY.INSPECTION.READ')
  postStageStatus(
    @Param('stageId', ParseIntPipe) stageId: number,
    @Body() data: any,
    @Request() req,
  ) {
    return this.service.updateStageStatus(stageId, {
      ...data,
      userId: req.user?.userId || req.user?.id,
      isAdmin: req.user?.role === 'Admin' || req.user?.roles?.includes('Admin'),
    });
  }

  // ===== WORKFLOW ENDPOINTS =====

  @Get(':id/workflow')
  @Permissions('QUALITY.INSPECTION.READ')
  getWorkflowState(@Param('id', ParseIntPipe) id: number) {
    return this.workflowService.getWorkflowState(id);
  }

  @Get('eligible-approvers/list')
  @Permissions('QUALITY.INSPECTION.READ')
  getEligibleApprovers(@Query('projectId', ParseIntPipe) projectId: number) {
    return this.workflowService.getEligibleApprovers(projectId);
  }

  @Post(':id/workflow/advance')
  @Permissions('QUALITY.INSPECTION.READ')
  advanceWorkflow(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      signatureId: number;
      signedBy: string;
      comments?: string;
      signatureData?: string;
    },
    @Request() req,
  ) {
    return this.workflowService.advanceWorkflow(
      id,
      req.user?.userId || req.user?.id,
      body.signatureId,
      body.signedBy,
      body.comments,
      body.signatureData,
      req.user?.role === 'Admin' || req.user?.roles?.includes('Admin'),
    );
  }

  @Post(':id/workflow/reject')
  @Permissions('QUALITY.INSPECTION.READ')
  rejectWorkflow(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { comments: string },
    @Request() req,
  ) {
    return this.workflowService.rejectWorkflow(
      id,
      req.user?.userId || req.user?.id,
      body.comments,
      req.user?.role === 'Admin' || req.user?.roles?.includes('Admin'),
    );
  }

  @Post(':id/workflow/reverse')
  @Permissions('QUALITY.INSPECTION.REVERSE')
  @Auditable('QUALITY', 'REVERSE_RFI', 'id')
  reverseWorkflow(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason: string },
    @Request() req,
  ) {
    return this.workflowService.reverseWorkflow(
      id,
      req.user?.userId || req.user?.id,
      body.reason,
      req.user?.role === 'Admin' || req.user?.roles?.includes('Admin'),
    );
  }

  @Post(':id/workflow/delegate')
  @Permissions('QUALITY.INSPECTION.READ')
  delegateWorkflowStep(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { targetUserId: number; comments: string },
    @Request() req,
  ) {
    return this.workflowService.delegateWorkflowStep(
      id,
      req.user?.userId || req.user?.id,
      body.targetUserId,
      body.comments,
      req.user?.role === 'Admin' || req.user?.roles?.includes('Admin'),
    );
  }

  // ==================================

  // ===== STAGE-WISE APPROVAL =====

  @Post(':id/stages/:stageId/approve')
  @Permissions('QUALITY.INSPECTION.READ')
  @Auditable('QUALITY', 'STAGE_APPROVE_RFI', 'id')
  approveStage(
    @Param('id', ParseIntPipe) inspectionId: number,
    @Param('stageId', ParseIntPipe) stageId: number,
    @Body() body: { signatureData?: string; comments?: string },
    @Request() req,
  ) {
    return this.service.approveStage(
      inspectionId,
      stageId,
      req.user?.userId || req.user?.id,
      body.signatureData,
      body.comments,
      req.user?.role === 'Admin' || req.user?.roles?.includes('Admin'),
    );
  }

  @Post(':id/final-approve')
  @Permissions('QUALITY.INSPECTION.APPROVE')
  @Auditable('QUALITY', 'FINAL_APPROVE_RFI', 'id')
  finalApprove(
    @Param('id', ParseIntPipe) inspectionId: number,
    @Body() body: { signatureData?: string; comments?: string },
    @Request() req,
  ) {
    return this.service.finalApprove(
      inspectionId,
      req.user?.userId || req.user?.id,
      body.signatureData,
      body.comments,
      req.user?.role === 'Admin' || req.user?.roles?.includes('Admin'),
    );
  }

  @Post(':id/stages/:stageId/reverse')
  @Permissions('QUALITY.INSPECTION.REVERSE')
  @Auditable('QUALITY', 'REVERSE_STAGE_APPROVAL', 'id')
  reverseStageApproval(
    @Param('id', ParseIntPipe) inspectionId: number,
    @Param('stageId', ParseIntPipe) stageId: number,
    @Body() body: { reason: string },
    @Request() req,
  ) {
    return this.service.reverseStageApproval(
      inspectionId,
      stageId,
      req.user?.userId || req.user?.id,
      body.reason,
      req.user?.role === 'Admin' || req.user?.roles?.includes('Admin'),
    );
  }

  // ===== ADMIN DELETE =====

  @Delete(':id')
  @Permissions('QUALITY.INSPECTION.DELETE')
  @Auditable('QUALITY', 'DELETE_RFI', 'id')
  deleteInspection(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.deleteInspection(id, req.user?.id);
  }
}
