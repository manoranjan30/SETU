import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ChecklistTemplateService } from './checklist-template.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('quality/checklist-templates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ChecklistTemplateController {
  constructor(private readonly templateService: ChecklistTemplateService) {}

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
    @Body() data: any,
  ) {
    return this.templateService.create(projectId, data);
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
