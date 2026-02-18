import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { QualityService } from './quality.service';
import { QualityStructureService } from './quality-structure.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { diskStorage } from 'multer';
import { extname } from 'path';

const multerOptions = {
  storage: diskStorage({
    destination: './uploads',
    filename: (req, file, cb) => {
      const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
      return cb(null, `${randomName}${extname(file.originalname)}`);
    }
  })
};

@Controller('quality')
@UseGuards(JwtAuthGuard)
export class QualityController {
  constructor(
    private readonly qualityService: QualityService,
    private readonly structureService: QualityStructureService,
  ) { }

  // ... (Existing endpoints omitted for brevity, keeping all existing methods via replace_file logic) ...
  // Wait, I cannot use "..." in replacement unless I use multi_replace or target specific chunks.
  // replace_file_content replaces the whole block defined by Start/End.
  // I should use multi_replace to inject Imports, Constructor, and Endpoints separately, OR replace the whole file.
  // The file is small (150 lines). I'll replace the whole file or use chunks.
  // Using chunks is safer to avoid accidental omission.

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
  @UseInterceptors(FileInterceptor('file', multerOptions))
  createSnag(@Body() data: any, @UploadedFile() file?: Express.Multer.File) {
    return this.qualityService.createSnag(data, file);
  }

  @Put('snags/:id')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  updateSnag(@Param('id') id: number, @Body() data: any, @UploadedFile() file?: Express.Multer.File) {
    return this.qualityService.updateSnag(id, data, file);
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

  // === STRUCTURE ENDPOINTS ===

  @Post(':projectId/structure/templates')
  createTemplate(@Param('projectId') projectId: number, @Body() data: any) {
    return this.structureService.createTemplate(projectId, data.name, data.rooms);
  }

  @Get(':projectId/structure/templates')
  getTemplates(@Param('projectId') projectId: number) {
    return this.structureService.getTemplates(projectId);
  }

  @Post('structure/apply-unit')
  addUnit(@Body() data: any) {
    return this.structureService.addUnitFromTemplate(
      data.floorId,
      data.templateId,
      data.unitName,
    );
  }

  @Post('structure/bulk-apply')
  bulkAddUnits(@Body() data: any) {
    return this.structureService.bulkCreateUnits(
      data.floorIds,
      data.templateId,
      data.config,
    );
  }

  @Post('structure/copy')
  copyStructure(@Body() data: any) {
    return this.structureService.copyStructure(
      data.sourceNodeId,
      data.targetParentIds,
    );
  }
}
