import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Res,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { TemplateBuilderService } from './template-builder.service';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  ImportTemplateDto,
} from './dto/template.dto';

@Controller('pdf-templates')
export class TemplateBuilderController {
  constructor(private readonly templateService: TemplateBuilderService) {}

  @Get()
  async findAll() {
    return this.templateService.findAll();
  }

  @Get('category/:category')
  async findByCategory(@Param('category') category: string) {
    return this.templateService.findByCategory(category);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.templateService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateTemplateDto) {
    return this.templateService.create(dto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.templateService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.templateService.delete(id);
    return { success: true };
  }

  /**
   * Export template as downloadable JSON file
   */
  @Get(':id/export')
  async exportTemplate(@Param('id') id: string, @Res() res: Response) {
    const data = await this.templateService.exportAsJson(id);
    const template = await this.templateService.findOne(id);
    const filename = `${template.name.replace(/\s+/g, '_').toLowerCase()}.setu-template.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(HttpStatus.OK).json(data);
  }

  /**
   * Import template from JSON
   */
  @Post('import')
  async importTemplate(@Body() dto: ImportTemplateDto) {
    return this.templateService.importFromJson(dto.templateData);
  }
}
