import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Delete,
  ParseIntPipe,
  Query,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { promises as fs } from 'fs';
import { ChecklistTemplateService } from './checklist-template.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { CreateChecklistTemplateDto } from './dto/create-checklist-template.dto';
import { SaveImportedChecklistsDto } from './dto/save-imported-checklists.dto';
import { ChecklistExcelParserService } from './checklist-excel-parser.service';
import { ChecklistPdfParserService } from './checklist-pdf-parser.service';

@Controller('quality/checklist-templates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ChecklistTemplateController {
  constructor(
    private readonly templateService: ChecklistTemplateService,
    private readonly excelParser: ChecklistExcelParserService,
    private readonly pdfParser: ChecklistPdfParserService,
  ) {}

  @Get('project/:projectId')
  @Permissions('QUALITY.CHECKLIST.READ')
  findAll(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.templateService.findAll(projectId);
  }

  @Get(':id')
  @Permissions('QUALITY.CHECKLIST.READ')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.templateService.findOne(id);
  }

  @Post('project/:projectId')
  @Permissions('QUALITY.CHECKLIST.CREATE')
  create(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() data: CreateChecklistTemplateDto,
  ) {
    return this.templateService.create(projectId, data);
  }

  @Put(':id')
  @Permissions('QUALITY.CHECKLIST.UPDATE')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: CreateChecklistTemplateDto,
  ) {
    return this.templateService.update(id, data);
  }

  @Post('project/:projectId/import-excel')
  @UseInterceptors(FileInterceptor('file'))
  @Permissions('QUALITY.CHECKLIST.CREATE')
  async importExcel(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query('preview') preview = 'true',
    @UploadedFile() file?: Express.Multer.File,
    @Body() body?: SaveImportedChecklistsDto,
  ) {
    if (preview !== 'false') {
      if (!file?.path) {
        throw new BadRequestException('Excel file is required for preview');
      }
      const buffer = await fs.readFile(file.path);
      const parsed = this.excelParser.parseWorkbook(
        buffer,
        file.originalname || 'upload.xlsx',
      );
      return this.templateService.buildPreview(parsed);
    }

    if (!body?.templates?.length) {
      throw new BadRequestException('Confirmed checklist templates are required');
    }

    return this.templateService.saveImportedTemplates(
      projectId,
      body.templates,
      body.overwriteExisting,
    );
  }

  @Post('project/:projectId/import-pdf')
  @UseInterceptors(FileInterceptor('file'))
  @Permissions('QUALITY.CHECKLIST.CREATE')
  async importPdf(
    @Param('projectId', ParseIntPipe) _projectId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.path) {
      throw new BadRequestException('PDF file is required');
    }

    const buffer = await fs.readFile(file.path);
    const pdfResult = await this.pdfParser.parsePdf(buffer);
    const preview = this.excelParser.toPreviewFromPdf(
      file.originalname || 'upload.pdf',
      pdfResult,
    );

    return {
      ...pdfResult,
      preview,
    };
  }

  @Post('project/:projectId/migrate')
  @Permissions('QUALITY.CHECKLIST.CREATE')
  migrate(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.templateService.migrateLegacy(projectId);
  }

  @Delete(':id')
  @Permissions('QUALITY.CHECKLIST.DELETE')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.templateService.delete(id);
  }
}
