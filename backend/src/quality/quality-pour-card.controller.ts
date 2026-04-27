import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Res,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { QualityPourCardService } from './quality-pour-card.service';

@Controller('quality/inspections')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QualityPourCardController {
  constructor(private readonly service: QualityPourCardService) {}

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
