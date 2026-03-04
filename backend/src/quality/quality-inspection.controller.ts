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
  CreateInspectionDto,
  UpdateInspectionStatusDto,
} from './quality-inspection.service';
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
  ) {
    return this.service.getInspections(projectId, epsNodeId, listId);
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

  @Get(':id')
  @Permissions('QUALITY.INSPECTION.READ')
  getInspectionDetails(@Param('id', ParseIntPipe) id: number) {
    return this.service.getInspectionDetails(id);
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
  @Permissions('QUALITY.INSPECTION.APPROVE')
  updateStageStatus(
    @Param('stageId', ParseIntPipe) stageId: number,
    @Body() data: any,
    @Request() req,
  ) {
    return this.service.updateStageStatus(stageId, {
      ...data,
      userId: req.user?.name || req.user?.id || 'System',
    });
  }

  // ===== WORKFLOW ENDPOINTS =====

  @Get(':id/workflow')
  @Permissions('QUALITY.INSPECTION.READ')
  getWorkflowState(@Param('id', ParseIntPipe) id: number) {
    return this.workflowService.getWorkflowState(id);
  }

  @Post(':id/workflow/advance')
  @Permissions('QUALITY.INSPECTION.APPROVE')
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
  @Permissions('QUALITY.INSPECTION.APPROVE')
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
  @Permissions('QUALITY.INSPECTION.APPROVE')
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
  @Permissions('QUALITY.INSPECTION.STAGE_APPROVE')
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
    );
  }

  @Post(':id/final-approve')
  @Permissions('QUALITY.INSPECTION.FINAL_APPROVE')
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
