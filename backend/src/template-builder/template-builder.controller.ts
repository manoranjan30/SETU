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
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { TemplateBuilderService } from './template-builder.service';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  ImportTemplateDto,
} from './dto/template.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('pdf-templates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TemplateBuilderController {
  constructor(private readonly templateService: TemplateBuilderService) {}

  @Get()
  @Permissions('TEMPLATE.BUILDER.READ')
  async findAll() {
    return this.templateService.findAll();
  }

  @Get('category/:category')
  @Permissions('TEMPLATE.BUILDER.READ')
  async findByCategory(@Param('category') category: string) {
    return this.templateService.findByCategory(category);
  }

  @Get(':id')
  @Permissions('TEMPLATE.BUILDER.READ')
  async findOne(@Param('id') id: string) {
    return this.templateService.findOne(id);
  }

  @Post()
  @Permissions('TEMPLATE.BUILDER.CREATE')
  async create(@Body() dto: CreateTemplateDto) {
    return this.templateService.create(dto);
  }

  @Put(':id')
  @Permissions('TEMPLATE.BUILDER.UPDATE')
  async update(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.templateService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('TEMPLATE.BUILDER.DELETE')
  async delete(@Param('id') id: string) {
    await this.templateService.delete(id);
    return { success: true };
  }

  @Get(':id/export')
  @Permissions('TEMPLATE.BUILDER.READ')
  async exportTemplate(@Param('id') id: string, @Res() res: Response) {
    const data = await this.templateService.exportAsJson(id);
    const template = await this.templateService.findOne(id);
    const filename = `${template.name.replace(/\s+/g, '_').toLowerCase()}.setu-template.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(HttpStatus.OK).json(data);
  }

  @Post('import')
  @Permissions('TEMPLATE.BUILDER.IMPORT')
  async importTemplate(@Body() dto: ImportTemplateDto) {
    return this.templateService.importFromJson(dto.templateData);
  }
}
