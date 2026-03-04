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
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ResourcesService } from './resources.service';
import { ResourceMaster } from './entities/resource-master.entity';
import { AnalysisTemplate } from './entities/analysis-template.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('resources')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  // Resources
  @Get('master')
  @Permissions('RESOURCE.MASTER.READ')
  async getResources() {
    return this.resourcesService.findAllResources();
  }

  @Post('master')
  @Permissions('RESOURCE.MASTER.CREATE')
  async createResource(@Body() body: Partial<ResourceMaster>) {
    return this.resourcesService.createResource(body);
  }

  @Put('master/:id')
  @Permissions('RESOURCE.MASTER.UPDATE')
  async updateResource(
    @Param('id') id: number,
    @Body() body: Partial<ResourceMaster>,
  ) {
    return this.resourcesService.updateResource(+id, body);
  }

  @Delete('master/:id')
  @Permissions('RESOURCE.MASTER.DELETE')
  async deleteResource(@Param('id') id: number) {
    return this.resourcesService.deleteResource(+id);
  }

  @Get('template')
  @Permissions('RESOURCE.MASTER.READ')
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
  @Permissions('RESOURCE.MASTER.IMPORT')
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
  @Permissions('RESOURCE.TEMPLATE.MANAGE')
  async getTemplates() {
    return this.resourcesService.findAllTemplates();
  }

  @Get('templates/:id')
  @Permissions('RESOURCE.TEMPLATE.MANAGE')
  async getTemplate(@Param('id') id: number) {
    return this.resourcesService.findTemplateById(+id);
  }

  @Post('templates')
  @Permissions('RESOURCE.TEMPLATE.MANAGE')
  async createTemplate(@Body() body: Partial<AnalysisTemplate>) {
    return this.resourcesService.createTemplate(body);
  }

  @Put('templates/:id')
  @Permissions('RESOURCE.TEMPLATE.MANAGE')
  async updateTemplate(
    @Param('id') id: number,
    @Body() body: Partial<AnalysisTemplate>,
  ) {
    return this.resourcesService.updateTemplate(+id, body);
  }

  @Delete('templates/:id')
  @Permissions('RESOURCE.TEMPLATE.MANAGE')
  deleteTemplate(@Param('id') id: string) {
    return this.resourcesService.deleteTemplate(+id);
  }

  @Post('suggest-mapping')
  @Permissions('RESOURCE.MASTER.READ')
  suggestMappings(
    @Body() body: { items: { boqItemId: number; description: string }[] },
  ) {
    return this.resourcesService.suggestMappings(body.items);
  }

  @Get('project-totals/:projectId')
  @Permissions('RESOURCE.MASTER.READ')
  getProjectTotals(@Param('projectId') projectId: string) {
    return this.resourcesService.calculateProjectResources(+projectId);
  }
}
