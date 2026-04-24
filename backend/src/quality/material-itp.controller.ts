import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import {
  CreateMaterialItpTemplateDto,
  CreateMaterialReceiptDto,
  CreateMaterialTestResultDto,
  MaterialApprovalActionDto,
} from './dto/material-itp.dto';
import { MaterialItpService } from './material-itp.service';

const evidenceUploadOptions = {
  storage: diskStorage({
    destination: './uploads/quality-material-evidence',
    filename: (req, file, cb) => {
      const randomName = Array(32)
        .fill(null)
        .map(() => Math.round(Math.random() * 16).toString(16))
        .join('');
      cb(null, `${randomName}${extname(file.originalname)}`);
    },
  }),
};

@Controller('quality')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MaterialItpController {
  constructor(private readonly materialItpService: MaterialItpService) {}

  @Get(':projectId/material-itps')
  @Permissions('QUALITY.MATERIAL_ITP.READ')
  listTemplates(@Param('projectId') projectId: number) {
    return this.materialItpService.listTemplates(Number(projectId));
  }

  @Post(':projectId/material-itps')
  @Permissions('QUALITY.MATERIAL_ITP.CREATE')
  createTemplate(
    @Param('projectId') projectId: number,
    @Body() body: CreateMaterialItpTemplateDto,
    @Req() req: any,
  ) {
    return this.materialItpService.createTemplate(
      Number(projectId),
      body,
      this.getUserId(req),
    );
  }

  @Get('material-itps/:id')
  @Permissions('QUALITY.MATERIAL_ITP.READ')
  getTemplate(@Param('id') id: number) {
    return this.materialItpService.getTemplate(Number(id));
  }

  @Put('material-itps/:id')
  @Permissions('QUALITY.MATERIAL_ITP.UPDATE')
  updateTemplate(@Param('id') id: number, @Body() body: CreateMaterialItpTemplateDto) {
    return this.materialItpService.updateTemplate(Number(id), body);
  }

  @Post('material-itps/:id/copy')
  @Permissions('QUALITY.MATERIAL_ITP.CREATE')
  copyTemplate(
    @Param('id') id: number,
    @Body('targetProjectId') targetProjectId: number,
    @Req() req: any,
  ) {
    return this.materialItpService.copyTemplate(
      Number(id),
      Number(targetProjectId),
      this.getUserId(req),
    );
  }

  @Post('material-itps/:id/submit-approval')
  @Permissions('QUALITY.MATERIAL_ITP.APPROVE')
  submitTemplateApproval(@Param('id') id: number, @Req() req: any) {
    return this.materialItpService.submitItpApproval(Number(id), this.getUserId(req));
  }

  @Post('material-itps/:id/activate')
  @Permissions('QUALITY.MATERIAL_ITP.APPROVE')
  activateTemplate(@Param('id') id: number, @Req() req: any) {
    return this.materialItpService.activateTemplate(Number(id), this.getUserId(req));
  }

  @Post('material-itps/:id/approval/:stepId/approve')
  @Permissions('QUALITY.MATERIAL_ITP.APPROVE')
  approveTemplateStep(
    @Param('id') id: number,
    @Param('stepId') stepId: number,
    @Body() body: MaterialApprovalActionDto,
    @Req() req: any,
  ) {
    return this.materialItpService.approveStep(
      'MATERIAL_ITP_TEMPLATE',
      Number(id),
      Number(stepId),
      this.getUserId(req),
      body.comments,
    );
  }

  @Post('material-itps/:id/approval/:stepId/reject')
  @Permissions('QUALITY.MATERIAL_ITP.APPROVE')
  rejectTemplateStep(
    @Param('id') id: number,
    @Param('stepId') stepId: number,
    @Body() body: MaterialApprovalActionDto,
    @Req() req: any,
  ) {
    return this.materialItpService.rejectStep(
      'MATERIAL_ITP_TEMPLATE',
      Number(id),
      Number(stepId),
      this.getUserId(req),
      body.comments,
    );
  }

  @Get(':projectId/material-receipts')
  @Permissions('QUALITY.MATERIAL_RECEIPT.READ')
  listReceipts(@Param('projectId') projectId: number) {
    return this.materialItpService.listReceipts(Number(projectId));
  }

  @Post(':projectId/material-receipts')
  @Permissions('QUALITY.MATERIAL_RECEIPT.CREATE')
  createReceipt(@Param('projectId') projectId: number, @Body() body: CreateMaterialReceiptDto) {
    return this.materialItpService.createReceipt(Number(projectId), body);
  }

  @Post('material-receipts/:id/generate-obligations')
  @Permissions('QUALITY.MATERIAL_TEST.LOG')
  generateReceiptObligations(@Param('id') id: number) {
    return this.materialItpService.generateObligations(Number(id));
  }

  @Get(':projectId/material-test-obligations')
  @Permissions('QUALITY.MATERIAL_TEST.READ')
  listObligations(@Param('projectId') projectId: number) {
    return this.materialItpService.listObligations(Number(projectId));
  }

  @Post('material-test-obligations/:id/results')
  @Permissions('QUALITY.MATERIAL_TEST.LOG')
  createResult(
    @Param('id') id: number,
    @Body() body: CreateMaterialTestResultDto,
    @Req() req: any,
  ) {
    return this.materialItpService.createResult(Number(id), body, this.getUserId(req));
  }

  @Get(':projectId/material-test-results')
  @Permissions('QUALITY.MATERIAL_TEST.READ')
  listResults(@Param('projectId') projectId: number) {
    return this.materialItpService.listResults(Number(projectId));
  }

  @Post('material-test-results/:id/submit-approval')
  @Permissions('QUALITY.MATERIAL_TEST.APPROVE')
  submitResultApproval(@Param('id') id: number, @Req() req: any) {
    return this.materialItpService.submitResultApproval(Number(id), this.getUserId(req));
  }

  @Post('material-test-results/:id/approval/:stepId/approve')
  @Permissions('QUALITY.MATERIAL_TEST.APPROVE')
  approveResultStep(
    @Param('id') id: number,
    @Param('stepId') stepId: number,
    @Body() body: MaterialApprovalActionDto,
    @Req() req: any,
  ) {
    return this.materialItpService.approveStep(
      'MATERIAL_TEST_RESULT',
      Number(id),
      Number(stepId),
      this.getUserId(req),
      body.comments,
    );
  }

  @Post('material-test-results/:id/approval/:stepId/reject')
  @Permissions('QUALITY.MATERIAL_TEST.APPROVE')
  rejectResultStep(
    @Param('id') id: number,
    @Param('stepId') stepId: number,
    @Body() body: MaterialApprovalActionDto,
    @Req() req: any,
  ) {
    return this.materialItpService.rejectStep(
      'MATERIAL_TEST_RESULT',
      Number(id),
      Number(stepId),
      this.getUserId(req),
      body.comments,
    );
  }

  @Get(':projectId/material-evidence')
  @Permissions('QUALITY.MATERIAL_EVIDENCE.READ')
  listEvidence(
    @Param('projectId') projectId: number,
    @Query('ownerType') ownerType?: string,
    @Query('ownerId') ownerId?: number,
  ) {
    return this.materialItpService.listEvidence(
      Number(projectId),
      ownerType ? ownerType.toUpperCase() : undefined,
      ownerId ? Number(ownerId) : undefined,
    );
  }

  @Post(':projectId/material-evidence')
  @Permissions('QUALITY.MATERIAL_EVIDENCE.UPLOAD')
  @UseInterceptors(FileInterceptor('file', evidenceUploadOptions))
  uploadEvidence(
    @Param('projectId') projectId: number,
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.materialItpService.createEvidence(
      Number(projectId),
      body,
      file,
      this.getUserId(req),
    );
  }

  private getUserId(req: any): number {
    return Number(req.user?.userId || req.user?.id || req.user?.sub || 0);
  }
}

