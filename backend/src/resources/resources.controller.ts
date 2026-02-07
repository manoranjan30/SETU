import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Res,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ResourcesService } from './resources.service';
import { ResourceMaster } from './entities/resource-master.entity';
import { AnalysisTemplate } from './entities/analysis-template.entity';

@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  // Resources
  @Get('master')
  async getResources() {
    return this.resourcesService.findAllResources();
  }

  @Post('master')
  async createResource(@Body() body: Partial<ResourceMaster>) {
    return this.resourcesService.createResource(body);
  }

  @Put('master/:id')
  async updateResource(
    @Param('id') id: number,
    @Body() body: Partial<ResourceMaster>,
  ) {
    return this.resourcesService.updateResource(+id, body);
  }

  @Delete('master/:id')
  async deleteResource(@Param('id') id: number) {
    return this.resourcesService.deleteResource(+id);
  }

  @Get('template')
  async getTemplateFile(@Res() res: Response) {
    const csv = await this.resourcesService.getResourceTemplate();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=resource_template.csv',
    );
    return res.send(csv);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importResources(
    @UploadedFile() file: Express.Multer.File,
    @Body('mapping') mappingStr: string,
  ) {
    const mapping = JSON.parse(mappingStr || '{}');
    return this.resourcesService.importResources(file, mapping);
  }

  // Templates
  @Get('templates')
  async getTemplates() {
    return this.resourcesService.findAllTemplates();
  }

  @Get('templates/:id')
  async getTemplate(@Param('id') id: number) {
    return this.resourcesService.findTemplateById(+id);
  }

  @Post('templates')
  async createTemplate(@Body() body: Partial<AnalysisTemplate>) {
    return this.resourcesService.createTemplate(body);
  }

  @Put('templates/:id')
  async updateTemplate(
    @Param('id') id: number,
    @Body() body: Partial<AnalysisTemplate>,
  ) {
    return this.resourcesService.updateTemplate(+id, body);
  }

  @Delete('templates/:id')
  deleteTemplate(@Param('id') id: string) {
    return this.resourcesService.deleteTemplate(+id);
  }

  @Post('suggest-mapping')
  suggestMappings(
    @Body() body: { items: { boqItemId: number; description: string }[] },
  ) {
    return this.resourcesService.suggestMappings(body.items);
  }

  @Get('project-totals/:projectId')
  getProjectTotals(@Param('projectId') projectId: string) {
    return this.resourcesService.calculateProjectResources(+projectId);
  }
}
