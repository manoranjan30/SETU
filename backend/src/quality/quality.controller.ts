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
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { diskStorage } from 'multer';
import { extname } from 'path';

const multerOptions = {
  storage: diskStorage({
    destination: './uploads',
    filename: (req, file, cb) => {
      const randomName = Array(32)
        .fill(null)
        .map(() => Math.round(Math.random() * 16).toString(16))
        .join('');
      return cb(null, `${randomName}${extname(file.originalname)}`);
    },
  }),
};

@Controller('quality')
@UseGuards(JwtAuthGuard, PermissionsGuard)
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
  @Permissions('QUALITY.DASHBOARD.READ')
  getSummary(@Param('projectId') projectId: number) {
    return this.qualityService.getSummary(projectId);
  }

  // Inspections
  // Inspections - MOVED TO QualityInspectionController
  // @Get(':projectId/inspections')
  // getInspections(@Param('projectId') projectId: number) {
  //   return this.qualityService.getInspections(projectId);
  // }
  // @Post('inspections')
  // createInspection(@Body() data: any) {
  //   return this.qualityService.createInspection(data);
  // }
  // @Put('inspections/:id')
  // updateInspection(@Param('id') id: number, @Body() data: any) {
  //   return this.qualityService.updateInspection(id, data);
  // }
  // @Delete('inspections/:id')
  // deleteInspection(@Param('id') id: number) {
  //   return this.qualityService.deleteInspection(id);
  // }

  // Material Tests
  @Get(':projectId/material-tests')
  @Permissions('QUALITY.TEST.READ')
  getMaterialTests(@Param('projectId') projectId: number) {
    return this.qualityService.getMaterialTests(projectId);
  }
  @Post('material-tests')
  @Permissions('QUALITY.TEST.CREATE')
  createMaterialTest(@Body() data: any) {
    return this.qualityService.createMaterialTest(data);
  }
  @Put('material-tests/:id')
  @Permissions('QUALITY.TEST.UPDATE')
  updateMaterialTest(@Param('id') id: number, @Body() data: any) {
    return this.qualityService.updateMaterialTest(id, data);
  }
  @Delete('material-tests/:id')
  @Permissions('QUALITY.TEST.DELETE')
  deleteMaterialTest(@Param('id') id: number) {
    return this.qualityService.deleteMaterialTest(id);
  }

  // Observations & NCR
  @Get(':projectId/observation-ncr')
  @Permissions('QUALITY.NCR.READ')
  getObservationNcr(@Param('projectId') projectId: number) {
    return this.qualityService.getObservationsNcr(projectId);
  }
  @Post('observation-ncr')
  @Permissions('QUALITY.NCR.CREATE')
  createObservationNcr(@Body() data: any) {
    return this.qualityService.createObservationNcr(data);
  }
  @Put('observation-ncr/:id')
  @Permissions('QUALITY.NCR.UPDATE')
  updateObservationNcr(@Param('id') id: number, @Body() data: any) {
    return this.qualityService.updateObservationNcr(id, data);
  }
  @Delete('observation-ncr/:id')
  @Permissions('QUALITY.NCR.DELETE')
  deleteObservationNcr(@Param('id') id: number) {
    return this.qualityService.deleteObservationNcr(id);
  }

  // Checklists
  @Get(':projectId/checklists')
  @Permissions('QUALITY.CHECKLIST.READ')
  getChecklists(@Param('projectId') projectId: number) {
    return this.qualityService.getChecklists(projectId);
  }
  @Post('checklists')
  @Permissions('QUALITY.CHECKLIST.CREATE')
  createChecklist(@Body() data: any) {
    return this.qualityService.createChecklist(data);
  }
  @Put('checklists/:id')
  @Permissions('QUALITY.CHECKLIST.UPDATE')
  updateChecklist(@Param('id') id: number, @Body() data: any) {
    return this.qualityService.updateChecklist(id, data);
  }
  @Delete('checklists/:id')
  @Permissions('QUALITY.CHECKLIST.DELETE')
  deleteChecklist(@Param('id') id: number) {
    return this.qualityService.deleteChecklist(id);
  }

  // Snags
  @Get(':projectId/snags')
  @Permissions('QUALITY.SNAG.READ')
  getSnags(@Param('projectId') projectId: number) {
    return this.qualityService.getSnags(projectId);
  }
  @Post('snags')
  @Permissions('QUALITY.SNAG.CREATE')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  createSnag(@Body() data: any, @UploadedFile() file?: Express.Multer.File) {
    return this.qualityService.createSnag(data, file);
  }

  @Put('snags/:id')
  @Permissions('QUALITY.SNAG.UPDATE')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  updateSnag(
    @Param('id') id: number,
    @Body() data: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.qualityService.updateSnag(id, data, file);
  }
  @Delete('snags/:id')
  @Permissions('QUALITY.SNAG.DELETE')
  deleteSnag(@Param('id') id: number) {
    return this.qualityService.deleteSnag(id);
  }

  // Audits
  @Get(':projectId/audits')
  @Permissions('QUALITY.AUDIT.READ')
  getAudits(@Param('projectId') projectId: number) {
    return this.qualityService.getAudits(projectId);
  }
  @Post('audits')
  @Permissions('QUALITY.AUDIT.CREATE')
  createAudit(@Body() data: any) {
    return this.qualityService.createAudit(data);
  }
  @Put('audits/:id')
  @Permissions('QUALITY.AUDIT.UPDATE')
  updateAudit(@Param('id') id: number, @Body() data: any) {
    return this.qualityService.updateAudit(id, data);
  }
  @Delete('audits/:id')
  @Permissions('QUALITY.AUDIT.DELETE')
  deleteAudit(@Param('id') id: number) {
    return this.qualityService.deleteAudit(id);
  }

  // Documents
  @Get(':projectId/documents')
  @Permissions('QUALITY.DOCUMENT.READ')
  getDocuments(@Param('projectId') projectId: number) {
    return this.qualityService.getDocuments(projectId);
  }
  @Post('documents')
  @Permissions('QUALITY.DOCUMENT.MANAGE')
  createDocument(@Body() data: any) {
    return this.qualityService.createDocument(data);
  }
  @Put('documents/:id')
  @Permissions('QUALITY.DOCUMENT.MANAGE')
  updateDocument(@Param('id') id: number, @Body() data: any) {
    return this.qualityService.updateDocument(id, data);
  }
  @Delete('documents/:id')
  @Permissions('QUALITY.DOCUMENT.MANAGE')
  deleteDocument(@Param('id') id: number) {
    return this.qualityService.deleteDocument(id);
  }

  // === STRUCTURE ENDPOINTS ===

  @Post(':projectId/structure/templates')
  @Permissions('QUALITY.STRUCTURE.MANAGE')
  createTemplate(@Param('projectId') projectId: number, @Body() data: any) {
    return this.structureService.createTemplate(
      projectId,
      data.name,
      data.rooms,
    );
  }

  @Get(':projectId/structure/templates')
  @Permissions('QUALITY.STRUCTURE.MANAGE')
  getTemplates(@Param('projectId') projectId: number) {
    return this.structureService.getTemplates(projectId);
  }

  @Post('structure/apply-unit')
  @Permissions('QUALITY.STRUCTURE.MANAGE')
  addUnit(@Body() data: any) {
    return this.structureService.addUnitFromTemplate(
      data.floorId,
      data.templateId,
      data.unitName,
    );
  }

  @Post('structure/bulk-apply')
  @Permissions('QUALITY.STRUCTURE.MANAGE')
  bulkAddUnits(@Body() data: any) {
    return this.structureService.bulkCreateUnits(
      data.floorIds,
      data.templateId,
      data.config,
    );
  }

  @Post('structure/copy')
  @Permissions('QUALITY.STRUCTURE.MANAGE')
  copyStructure(@Body() data: any) {
    return this.structureService.copyStructure(
      data.sourceNodeId,
      data.targetParentIds,
    );
  }
}
