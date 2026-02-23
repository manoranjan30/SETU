import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Headers,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WbsService } from './wbs.service';
import { WbsImportService } from './wbs-import.service';
import { CreateWbsDto, UpdateWbsDto, ReorderWbsDto } from './dto/wbs.dto';
import { CreateActivityDto, UpdateActivityDto } from './dto/activity.dto';
import { CreateWbsTemplateDto } from './dto/wbs-template.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectContextGuard } from '../projects/guards/project-context.guard';
import { ProjectAssignmentGuard } from '../projects/guards/project-assignment.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { Auditable } from '../audit/auditable.decorator';

@Controller('projects/:projectId/wbs')
@UseGuards(
  JwtAuthGuard,
  ProjectContextGuard,
  ProjectAssignmentGuard,
  PermissionsGuard,
)
export class WbsController {
  constructor(
    private readonly wbsService: WbsService,
    private readonly importService: WbsImportService,
  ) { }

  @Post()
  @Permissions('WBS.NODE.CREATE')
  @Auditable('WBS', 'CREATE_NODE')
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateWbsDto,
    @Request() req: any,
  ) {
    return this.wbsService.create(+projectId, dto, req.user.username);
  }

  @Get()
  @Permissions('WBS.NODE.READ')
  findAll(@Param('projectId') projectId: string) {
    return this.wbsService.findAll(+projectId);
  }

  @Get('activities')
  @Permissions('WBS.ACTIVITY.READ')
  getAllActivities(@Param('projectId') projectId: string) {
    return this.wbsService.getAllActivities(+projectId);
  }

  @Get(':id')
  @Permissions('WBS.NODE.READ')
  findOne(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.wbsService.findOne(+projectId, +id);
  }

  @Patch(':id')
  @Permissions('WBS.NODE.UPDATE')
  @Auditable('WBS', 'UPDATE_NODE', 'id')
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWbsDto,
  ) {
    return this.wbsService.update(+projectId, +id, dto);
  }

  @Patch(':id/reorder')
  @Permissions('WBS.NODE.UPDATE')
  @Auditable('WBS', 'REORDER_NODE', 'id')
  reorder(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: ReorderWbsDto,
  ) {
    return this.wbsService.reorder(+projectId, +id, dto);
  }

  @Delete(':id')
  @Permissions('WBS.NODE.DELETE')
  @Auditable('WBS', 'DELETE_NODE', 'id')
  remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.wbsService.delete(+projectId, +id, req.user.id);
  }

  // --- Activities ---

  @Post(':nodeId/activities')
  @Permissions('WBS.ACTIVITY.CREATE')
  createActivity(
    @Param('projectId') projectId: string,
    @Param('nodeId') nodeId: string,
    @Body() dto: CreateActivityDto,
    @Request() req: any,
  ) {
    return this.wbsService.createActivity(
      +projectId,
      +nodeId,
      dto,
      req.user.username,
    );
  }

  @Get(':nodeId/activities')
  @Permissions('WBS.ACTIVITY.READ')
  getActivities(
    @Param('projectId') projectId: string,
    @Param('nodeId') nodeId: string,
  ) {
    return this.wbsService.getActivities(+projectId, +nodeId);
  }

  @Patch('activities/:activityId')
  @Permissions('WBS.ACTIVITY.UPDATE')
  updateActivity(
    @Param('activityId') activityId: string,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.wbsService.updateActivity(+activityId, dto);
  }

  @Delete('activities/:activityId')
  @Permissions('WBS.ACTIVITY.DELETE')
  deleteActivity(
    @Param('activityId') activityId: string,
    @Request() req: any,
  ) {
    return this.wbsService.deleteActivity(+activityId, req.user.id);
  }

  // --- Templates ---

  // --- Templates ---
  // Moved to WbsTemplateController

  @Post('templates/:templateId/apply')
  @Permissions('WBS.TEMPLATE.APPLY')
  applyTemplate(
    @Param('projectId') projectId: string,
    @Param('templateId') templateId: string,
    @Request() req: any,
  ) {
    return this.wbsService.applyTemplate(
      +projectId,
      +templateId,
      req.user.username,
    );
  }

  @Post('save-as-template')
  @Permissions('WBS.TEMPLATE.MANAGE') // Assuming manage permission required to create templates
  saveAsTemplate(
    @Param('projectId') projectId: string,
    @Body() body: { templateName: string; description?: string },
  ) {
    return this.wbsService.saveAsTemplate(
      +projectId,
      body.templateName,
      body.description,
    );
  }

  // --- Import ---

  @Post('import/preview')
  @Permissions('WBS.NODE.CREATE')
  @UseInterceptors(FileInterceptor('file'))
  async previewImport(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');
    const data = await this.importService.parseAndPreview(file.buffer);
    const validation = this.importService.validateHierarchy(data);
    return { data, validation };
  }

  @Post('import/commit')
  @Permissions('WBS.NODE.CREATE')
  async commitImport(
    @Param('projectId') projectId: string,
    @Body() body: { data: any[] },
    @Request() req: any,
  ) {
    // We need a bulk create method in WbsService.
    // For now, let's just loop (not efficient but works).
    // Or implement bulk logic later.

    // Actually, let's delegate to WbsService
    // return this.wbsService.bulkCreate(+projectId, body.data, req.user.username);

    // Wait, bulkCreate is not implemented yet.
    // Let's implement a simple loop here or better add bulkCreate to Service.
    // For iteration 1: Implement bulkCreate in Service
    return this.wbsService.bulkCreate(+projectId, body.data, req.user.username);
  }
}
