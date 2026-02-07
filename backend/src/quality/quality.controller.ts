import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { QualityService } from './quality.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('quality')
@UseGuards(JwtAuthGuard)
export class QualityController {
  constructor(private readonly qualityService: QualityService) {}

  @Get(':projectId/summary')
  getSummary(@Param('projectId') projectId: number) {
    return this.qualityService.getSummary(projectId);
  }

  // Inspections
  @Get(':projectId/inspections')
  getInspections(@Param('projectId') projectId: number) {
    return this.qualityService.getInspections(projectId);
  }
  @Post('inspections')
  createInspection(@Body() data: any) {
    return this.qualityService.createInspection(data);
  }
  @Put('inspections/:id')
  updateInspection(@Param('id') id: number, @Body() data: any) {
    return this.qualityService.updateInspection(id, data);
  }
  @Delete('inspections/:id')
  deleteInspection(@Param('id') id: number) {
    return this.qualityService.deleteInspection(id);
  }

  // Material Tests
  @Get(':projectId/material-tests')
  getMaterialTests(@Param('projectId') projectId: number) {
    return this.qualityService.getMaterialTests(projectId);
  }
  @Post('material-tests')
  createMaterialTest(@Body() data: any) {
    return this.qualityService.createMaterialTest(data);
  }
  @Put('material-tests/:id')
  updateMaterialTest(@Param('id') id: number, @Body() data: any) {
    return this.qualityService.updateMaterialTest(id, data);
  }
  @Delete('material-tests/:id')
  deleteMaterialTest(@Param('id') id: number) {
    return this.qualityService.deleteMaterialTest(id);
  }

  // Observations & NCR
  @Get(':projectId/observation-ncr')
  getObservationNcr(@Param('projectId') projectId: number) {
    return this.qualityService.getObservationsNcr(projectId);
  }
  @Post('observation-ncr')
  createObservationNcr(@Body() data: any) {
    return this.qualityService.createObservationNcr(data);
  }
  @Put('observation-ncr/:id')
  updateObservationNcr(@Param('id') id: number, @Body() data: any) {
    return this.qualityService.updateObservationNcr(id, data);
  }
  @Delete('observation-ncr/:id')
  deleteObservationNcr(@Param('id') id: number) {
    return this.qualityService.deleteObservationNcr(id);
  }

  // Checklists
  @Get(':projectId/checklists')
  getChecklists(@Param('projectId') projectId: number) {
    return this.qualityService.getChecklists(projectId);
  }
  @Post('checklists')
  createChecklist(@Body() data: any) {
    return this.qualityService.createChecklist(data);
  }
  @Put('checklists/:id')
  updateChecklist(@Param('id') id: number, @Body() data: any) {
    return this.qualityService.updateChecklist(id, data);
  }
  @Delete('checklists/:id')
  deleteChecklist(@Param('id') id: number) {
    return this.qualityService.deleteChecklist(id);
  }

  // Snags
  @Get(':projectId/snags')
  getSnags(@Param('projectId') projectId: number) {
    return this.qualityService.getSnags(projectId);
  }
  @Post('snags')
  createSnag(@Body() data: any) {
    return this.qualityService.createSnag(data);
  }
  @Put('snags/:id')
  updateSnag(@Param('id') id: number, @Body() data: any) {
    return this.qualityService.updateSnag(id, data);
  }
  @Delete('snags/:id')
  deleteSnag(@Param('id') id: number) {
    return this.qualityService.deleteSnag(id);
  }

  // Audits
  @Get(':projectId/audits')
  getAudits(@Param('projectId') projectId: number) {
    return this.qualityService.getAudits(projectId);
  }
  @Post('audits')
  createAudit(@Body() data: any) {
    return this.qualityService.createAudit(data);
  }
  @Put('audits/:id')
  updateAudit(@Param('id') id: number, @Body() data: any) {
    return this.qualityService.updateAudit(id, data);
  }
  @Delete('audits/:id')
  deleteAudit(@Param('id') id: number) {
    return this.qualityService.deleteAudit(id);
  }

  // Documents
  @Get(':projectId/documents')
  getDocuments(@Param('projectId') projectId: number) {
    return this.qualityService.getDocuments(projectId);
  }
  @Post('documents')
  createDocument(@Body() data: any) {
    return this.qualityService.createDocument(data);
  }
  @Put('documents/:id')
  updateDocument(@Param('id') id: number, @Body() data: any) {
    return this.qualityService.updateDocument(id, data);
  }
  @Delete('documents/:id')
  deleteDocument(@Param('id') id: number) {
    return this.qualityService.deleteDocument(id);
  }
}
