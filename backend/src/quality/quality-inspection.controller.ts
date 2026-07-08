import {
  BadRequestException,
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
  UploadedFiles,
  UseInterceptors,
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
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { QualityInspectionAttachmentService } from './quality-inspection-attachment.service';
import { MobileCacheHeaders } from '../common/mobile-cache-headers.decorator';

const rfiAttachmentUpload = FileFieldsInterceptor(
  [
    { name: 'originalFile', maxCount: 1 },
    { name: 'annotatedFile', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ],
  {
    storage: memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 2 },
  },
);

@Controller('quality/inspections')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QualityInspectionController {
  constructor(
    private readonly service: QualityInspectionService,
    private readonly reportService: QualityReportService,
    private readonly workflowService: InspectionWorkflowService,
    private readonly attachmentService: QualityInspectionAttachmentService,
  ) {}

  private getSignatureRequestMeta(req: any) {
    return {
      ipAddress:
        req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
        req?.ip ||
        req?.socket?.remoteAddress ||
        null,
      userAgent: req?.headers?.['user-agent'] || null,
    };
  }

  private isAdminRequest(req: any) {
    const roles = Array.isArray(req?.user?.roles) ? req.user.roles : [];
    return (
      roles.some(
        (role: any) =>
          String(typeof role === 'string' ? role : role?.name || '')
            .trim()
            .toLowerCase() === 'admin',
      ) ||
      String(req?.user?.role || '')
        .trim()
        .toLowerCase() === 'admin'
    );
  }

  @Get()
  @Permissions('QUALITY.INSPECTION.READ')
  @MobileCacheHeaders()
  getInspections(
    @Query('projectId', ParseIntPipe) projectId: number,
    @Query('epsNodeId', new ParseIntPipe({ optional: true }))
    epsNodeId?: number,
    @Query('listId', new ParseIntPipe({ optional: true })) listId?: number,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Request() req?,
  ) {
    return this.service.getInspections(
      projectId,
      epsNodeId,
      listId,
      req?.user?.userId || req?.user?.id,
      this.isAdminRequest(req),
      {
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
        q,
        status,
      },
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

  @Get('related-options')
  @Permissions('QUALITY.INSPECTION.READ')
  getRelatedOptions(
    @Query('projectId', ParseIntPipe) projectId: number,
    @Query('epsNodeId', ParseIntPipe) epsNodeId: number,
    @Query('excludeInspectionId') excludeInspectionId?: string,
  ) {
    const excludeId = Number(excludeInspectionId);
    return this.service.getRelatedChecklistOptions(
      projectId,
      epsNodeId,
      Number.isInteger(excludeId) && excludeId > 0 ? excludeId : undefined,
    );
  }

  @Patch(':id/related-checklists')
  @Permissions('QUALITY.INSPECTION.UPDATE')
  @Auditable('QUALITY', 'UPDATE_RFI_RELATED_CHECKLISTS', 'id')
  updateRelatedChecklists(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { relatedChecklistInspectionIds?: number[] },
  ) {
    return this.service.updateRelatedChecklistLinks(
      id,
      body.relatedChecklistInspectionIds,
    );
  }

  @Post('attachment-drafts')
  @Permissions('QUALITY.INSPECTION.RAISE')
  @UseInterceptors(rfiAttachmentUpload)
  createAttachmentDraft(
    @UploadedFiles()
    files: {
      originalFile?: Express.Multer.File[];
      annotatedFile?: Express.Multer.File[];
      file?: Express.Multer.File[];
    },
    @Body()
    body: {
      projectId: string;
      clientUploadId?: string;
      attachmentType?: string;
      annotationData?: string;
    },
    @Request() req,
  ) {
    const original = files?.originalFile?.[0] || files?.file?.[0];
    if (!original) {
      throw new BadRequestException('Attachment file is required.');
    }
    const projectId = Number(body.projectId);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      throw new BadRequestException('A valid projectId is required.');
    }
    return this.attachmentService.createDraft(
      projectId,
      req.user?.userId || req.user?.id,
      { original, annotated: files?.annotatedFile?.[0] },
      body,
    );
  }

  @Delete('attachment-drafts/:attachmentId')
  @Permissions('QUALITY.INSPECTION.RAISE')
  deleteAttachmentDraft(
    @Param('attachmentId') attachmentId: string,
    @Request() req,
  ) {
    return this.attachmentService.deleteAttachment(
      attachmentId,
      req.user?.userId || req.user?.id,
      this.isAdminRequest(req),
    );
  }

  @Get(':id')
  @Permissions('QUALITY.INSPECTION.READ')
  @MobileCacheHeaders()
  getInspectionDetails(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.getInspectionDetails(
      id,
      req?.user?.userId || req?.user?.id,
      this.isAdminRequest(req),
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

  @Post('add-go')
  @Permissions('QUALITY.INSPECTION.RAISE')
  @Auditable('QUALITY', 'ADD_GO')
  addGo(@Body() dto: Omit<ExpandGoSeriesDto, 'newTotalParts'>) {
    return this.service.addGo(dto);
  }

  @Get(':id/attachments')
  @Permissions('QUALITY.INSPECTION.READ')
  async getAttachments(@Param('id', ParseIntPipe) id: number, @Request() req) {
    await this.service.getInspectionDetails(
      id,
      req?.user?.userId || req?.user?.id,
      this.isAdminRequest(req),
    );
    return this.attachmentService.listForInspection(id);
  }

  @Post(':id/attachments')
  @Permissions('QUALITY.INSPECTION.UPDATE')
  @UseInterceptors(rfiAttachmentUpload)
  addAttachment(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles()
    files: {
      originalFile?: Express.Multer.File[];
      annotatedFile?: Express.Multer.File[];
      file?: Express.Multer.File[];
    },
    @Body()
    body: {
      clientUploadId?: string;
      attachmentType?: string;
      annotationData?: string;
    },
    @Request() req,
  ) {
    const original = files?.originalFile?.[0] || files?.file?.[0];
    if (!original) {
      throw new BadRequestException('Attachment file is required.');
    }
    return this.attachmentService.addToInspection(
      id,
      req.user?.userId || req.user?.id,
      { original, annotated: files?.annotatedFile?.[0] },
      body,
      this.isAdminRequest(req),
    );
  }

  @Delete(':id/attachments/:attachmentId')
  @Permissions('QUALITY.INSPECTION.UPDATE')
  deleteAttachment(
    @Param('attachmentId') attachmentId: string,
    @Request() req,
  ) {
    return this.attachmentService.deleteAttachment(
      attachmentId,
      req.user?.userId || req.user?.id,
      this.isAdminRequest(req),
    );
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
  @Permissions('QUALITY.INSPECTION.UPDATE')
  updateStageStatus(
    @Param('stageId', ParseIntPipe) stageId: number,
    @Body() data: any,
    @Request() req,
  ) {
    return this.service.updateStageStatus(stageId, {
      ...data,
      userId: req.user?.userId || req.user?.id,
      isAdmin: this.isAdminRequest(req),
    });
  }

  @Patch(':id/stages/:stageId')
  @Permissions('QUALITY.INSPECTION.UPDATE')
  updateStageStatusForInspection(
    @Param('stageId', ParseIntPipe) stageId: number,
    @Body() data: any,
    @Request() req,
  ) {
    return this.service.updateStageStatus(stageId, {
      ...data,
      userId: req.user?.userId || req.user?.id,
      isAdmin: this.isAdminRequest(req),
    });
  }

  @Post('stage/:stageId')
  @Permissions('QUALITY.INSPECTION.UPDATE')
  postStageStatus(
    @Param('stageId', ParseIntPipe) stageId: number,
    @Body() data: any,
    @Request() req,
  ) {
    return this.service.updateStageStatus(stageId, {
      ...data,
      userId: req.user?.userId || req.user?.id,
      isAdmin: this.isAdminRequest(req),
    });
  }

  // ===== WORKFLOW ENDPOINTS =====

  @Get(':id/workflow')
  @Permissions('QUALITY.INSPECTION.READ')
  @MobileCacheHeaders()
  getWorkflowState(@Param('id', ParseIntPipe) id: number) {
    return this.workflowService.getWorkflowState(id);
  }

  @Get('eligible-approvers/list')
  @Permissions('QUALITY.INSPECTION.READ')
  getEligibleApprovers(@Query('projectId', ParseIntPipe) projectId: number) {
    return this.workflowService.getEligibleApprovers(projectId);
  }

  @Get('project-date-settings-list')
  @Permissions('ADMIN.SETTINGS.MANAGE')
  listProjectDateSettings() {
    return this.service.listRfiDateProjectSettings();
  }

  @Get('project-date-settings')
  @Permissions('QUALITY.INSPECTION.READ')
  getProjectDateSettings(@Query('projectId', ParseIntPipe) projectId: number) {
    return this.service.getRfiDateSettings(projectId);
  }

  @Patch('project-date-settings')
  @Permissions('QUALITY.INSPECTION.UPDATE', 'ADMIN.SETTINGS.MANAGE')
  updateProjectDateSettings(
    @Query('projectId', ParseIntPipe) projectId: number,
    @Body('enabled') enabled: boolean | string | number,
  ) {
    const normalized =
      enabled === true || enabled === 'true' || enabled === 1 || enabled === '1';
    return this.service.updateRfiDateSettings(projectId, normalized);
  }

  @Post(':id/workflow/advance')
  @Permissions('QUALITY.INSPECTION.STAGE_APPROVE')
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
      this.isAdminRequest(req),
    );
  }

  @Post(':id/workflow/reject')
  @Permissions('QUALITY.INSPECTION.STAGE_APPROVE')
  rejectWorkflow(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { comments: string },
    @Request() req,
  ) {
    return this.workflowService.rejectWorkflow(
      id,
      req.user?.userId || req.user?.id,
      body.comments,
      this.isAdminRequest(req),
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
      this.isAdminRequest(req),
    );
  }

  @Post(':id/workflow/delegate')
  @Permissions('QUALITY.INSPECTION.DELEGATE')
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
      this.isAdminRequest(req),
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
    @Body()
    body: {
      signatureData?: string;
      comments?: string;
      signatureEvidence?: Record<string, unknown>;
      approvalDate?: string;
    },
    @Request() req,
  ) {
    return this.service.approveStage(
      inspectionId,
      stageId,
      req.user?.userId || req.user?.id,
      body.signatureData,
      body.comments,
      this.isAdminRequest(req),
      {
        ...(body.signatureEvidence || {}),
        ...(body.approvalDate ? { approvalDate: body.approvalDate } : {}),
        ...this.getSignatureRequestMeta(req),
      },
    );
  }

  @Post(':id/final-approve')
  @Permissions('QUALITY.INSPECTION.FINAL_APPROVE')
  @Auditable('QUALITY', 'FINAL_APPROVE_RFI', 'id')
  finalApprove(
    @Param('id', ParseIntPipe) inspectionId: number,
    @Body()
    body: {
      signatureData?: string;
      comments?: string;
      signatureEvidence?: Record<string, unknown>;
      approvalDate?: string;
    },
    @Request() req,
  ) {
    return this.service.finalApprove(
      inspectionId,
      req.user?.userId || req.user?.id,
      body.signatureData,
      body.comments,
      this.isAdminRequest(req),
      {
        ...(body.signatureEvidence || {}),
        ...(body.approvalDate ? { approvalDate: body.approvalDate } : {}),
        ...this.getSignatureRequestMeta(req),
      },
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
      this.isAdminRequest(req),
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
