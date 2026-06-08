import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, resolve } from 'path';
import { mkdirSync } from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { QualityPourCardService } from './quality-pour-card.service';

const clearanceUploadRoot = resolve(
  process.env.UPLOAD_DIR || resolve(process.cwd(), 'uploads'),
  'quality-pour-clearance',
);

const clearanceAttachmentUploadOptions = {
  storage: diskStorage({
    destination: (_req, _file, callback) => {
      mkdirSync(clearanceUploadRoot, { recursive: true });
      callback(null, clearanceUploadRoot);
    },
    filename: (_req, file, callback) => {
      callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
    },
  }),
  fileFilter: (_req: any, file: Express.Multer.File, callback: any) => {
    const allowedMimeTypes = new Set([
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
    const allowedExtensions = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp']);
    if (
      !allowedMimeTypes.has(file.mimetype.toLowerCase()) ||
      !allowedExtensions.has(extname(file.originalname).toLowerCase())
    ) {
      return callback(
        new BadRequestException('Only PDF, JPG, PNG, and WEBP files are allowed.'),
        false,
      );
    }
    callback(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
};

@Controller('quality/inspections')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QualityPourCardController {
  constructor(private readonly service: QualityPourCardService) {}

  private getRequestSignatureMeta(req: any) {
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
    return (
      req?.user?.roles?.includes?.('Admin') ||
      req?.user?.role === 'Admin' ||
      req?.user?.isAdmin === true
    );
  }

  @Get(':inspectionId/pour-card')
  @Permissions('QUALITY.INSPECTION.READ')
  getPourCard(@Param('inspectionId', ParseIntPipe) inspectionId: number) {
    return this.service.getPourCard(inspectionId);
  }

  @Put(':inspectionId/pour-card')
  @Permissions('QUALITY.INSPECTION.READ')
  savePourCard(
    @Param('inspectionId', ParseIntPipe) inspectionId: number,
    @Body() body: any,
    @Request() req,
  ) {
    return this.service.savePourCard(
      inspectionId,
      body,
      req.user?.userId || req.user?.id,
    );
  }

  @Post(':inspectionId/pour-card/submit')
  @Permissions('QUALITY.INSPECTION.READ')
  submitPourCard(
    @Param('inspectionId', ParseIntPipe) inspectionId: number,
    @Request() req,
  ) {
    return this.service.submitPourCard(
      inspectionId,
      req.user?.userId || req.user?.id,
    );
  }

  @Post(':inspectionId/pour-card/approve')
  @Permissions('QUALITY.INSPECTION.APPROVE')
  approvePourCard(
    @Param('inspectionId', ParseIntPipe) inspectionId: number,
    @Body() body: any,
    @Request() req,
  ) {
    return this.service.approvePourCard(
      inspectionId,
      req.user?.userId || req.user?.id,
      body?.remarks,
      this.isAdminRequest(req),
    );
  }

  @Post(':inspectionId/pour-card/reject')
  @Permissions('QUALITY.INSPECTION.APPROVE')
  rejectPourCard(
    @Param('inspectionId', ParseIntPipe) inspectionId: number,
    @Body() body: any,
    @Request() req,
  ) {
    return this.service.rejectPourCard(
      inspectionId,
      req.user?.userId || req.user?.id,
      body?.remarks,
    );
  }

  @Get(':inspectionId/pour-card/pdf')
  @Permissions('QUALITY.INSPECTION.READ')
  async downloadPourCardPdf(
    @Param('inspectionId', ParseIntPipe) inspectionId: number,
    @Res() res: any,
  ) {
    const pdfBuffer = await this.service.generatePourCardPdf(inspectionId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Pour_Card_${inspectionId}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }

  @Get(':inspectionId/pre-pour-clearance')
  @Permissions('QUALITY.INSPECTION.READ')
  getPrePourClearance(
    @Param('inspectionId', ParseIntPipe) inspectionId: number,
  ) {
    return this.service.getPrePourClearanceCard(inspectionId);
  }

  @Put(':inspectionId/pre-pour-clearance')
  @Permissions('QUALITY.INSPECTION.READ')
  savePrePourClearance(
    @Param('inspectionId', ParseIntPipe) inspectionId: number,
    @Body() body: any,
    @Request() req,
  ) {
    return this.service.savePrePourClearanceCard(
      inspectionId,
      body,
      req.user?.userId || req.user?.id,
      this.getRequestSignatureMeta(req),
    );
  }

  @Post(':inspectionId/pre-pour-clearance/attachments')
  @Permissions('QUALITY.INSPECTION.READ')
  @UseInterceptors(
    FileInterceptor('file', clearanceAttachmentUploadOptions),
  )
  uploadPrePourClearanceAttachment(
    @Param('inspectionId', ParseIntPipe) inspectionId: number,
    @Body('lineKey') lineKey: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    return this.service.uploadPrePourClearanceAttachment(
      inspectionId,
      lineKey,
      file,
      req.user?.userId || req.user?.id,
    );
  }

  @Delete(':inspectionId/pre-pour-clearance/attachments/:attachmentId')
  @Permissions('QUALITY.INSPECTION.READ')
  deletePrePourClearanceAttachment(
    @Param('inspectionId', ParseIntPipe) inspectionId: number,
    @Param('attachmentId') attachmentId: string,
    @Query('lineKey') lineKey: string,
  ) {
    return this.service.deletePrePourClearanceAttachment(
      inspectionId,
      lineKey,
      attachmentId,
    );
  }

  @Post(':inspectionId/pre-pour-clearance/submit')
  @Permissions('QUALITY.INSPECTION.READ')
  submitPrePourClearance(
    @Param('inspectionId', ParseIntPipe) inspectionId: number,
    @Request() req,
  ) {
    return this.service.submitPrePourClearanceCard(
      inspectionId,
      req.user?.userId || req.user?.id,
    );
  }

  @Post(':inspectionId/pre-pour-clearance/approve')
  @Permissions('QUALITY.INSPECTION.APPROVE')
  approvePrePourClearance(
    @Param('inspectionId', ParseIntPipe) inspectionId: number,
    @Body() body: any,
    @Request() req,
  ) {
    return this.service.approvePrePourClearanceCard(
      inspectionId,
      req.user?.userId || req.user?.id,
      body?.remarks,
      this.isAdminRequest(req),
    );
  }

  @Post(':inspectionId/pre-pour-clearance/reject')
  @Permissions('QUALITY.INSPECTION.APPROVE')
  rejectPrePourClearance(
    @Param('inspectionId', ParseIntPipe) inspectionId: number,
    @Body() body: any,
    @Request() req,
  ) {
    return this.service.rejectPrePourClearanceCard(
      inspectionId,
      req.user?.userId || req.user?.id,
      body?.remarks,
    );
  }

  @Get(':inspectionId/pre-pour-clearance/pdf')
  @Permissions('QUALITY.INSPECTION.READ')
  async downloadPrePourClearancePdf(
    @Param('inspectionId', ParseIntPipe) inspectionId: number,
    @Res() res: any,
  ) {
    const pdfBuffer = await this.service.generatePrePourClearancePdf(
      inspectionId,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Pre_Pour_Clearance_${inspectionId}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }
}
