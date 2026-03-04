import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LaborService } from './labor.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('labor')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LaborController {
  constructor(private readonly laborService: LaborService) {}

  @Get('categories')
  @Permissions('LABOR.CATEGORY.READ')
  getCategories(@Query('projectId') projectId?: string) {
    return this.laborService.getCategories(
      projectId ? parseInt(projectId) : undefined,
    );
  }

  @Post('categories')
  @Permissions('LABOR.CATEGORY.MANAGE')
  saveCategories(@Body() categories: any[]) {
    return this.laborService.saveCategories(categories);
  }

  @Get('presence/:projectId')
  @Permissions('LABOR.ENTRY.READ')
  getDailyPresence(
    @Param('projectId') projectId: string,
    @Query('date') date?: string,
  ) {
    return this.laborService.getDailyPresence(parseInt(projectId), date);
  }

  @Post('presence/:projectId')
  @Permissions('LABOR.ENTRY.CREATE')
  saveDailyPresence(
    @Param('projectId') projectId: string,
    @Body() body: { entries: any[]; userId: number },
  ) {
    return this.laborService.saveDailyPresence(
      parseInt(projectId),
      body.entries,
      body.userId,
    );
  }

  @Get('activity/:activityId')
  @Permissions('LABOR.ENTRY.READ')
  getActivityLabor(@Param('activityId') activityId: string) {
    return this.laborService.getActivityLabor(parseInt(activityId));
  }

  @Get('allocations/:projectId')
  @Permissions('LABOR.ENTRY.READ')
  getAllocationsByProject(
    @Param('projectId') projectId: string,
    @Query('date') date?: string,
  ) {
    return this.laborService.getAllocationsByProject(parseInt(projectId), date);
  }

  @Post('activity')
  @Permissions('LABOR.ENTRY.CREATE')
  saveActivityLabor(@Body() body: { entries: any[]; userId: number }) {
    return this.laborService.saveActivityLabor(body.entries, body.userId);
  }

  @Get('mappings/:projectId')
  @Permissions('LABOR.MAPPING.MANAGE')
  getMappings(@Param('projectId') projectId: string) {
    return this.laborService.getMappings(parseInt(projectId));
  }

  @Post('mappings')
  @Permissions('LABOR.MAPPING.MANAGE')
  saveMapping(@Body() mapping: any) {
    return this.laborService.saveMapping(mapping);
  }

  @Post('import/:projectId')
  @Permissions('LABOR.ENTRY.IMPORT')
  importData(
    @Param('projectId') projectId: string,
    @Body() body: { data: any[]; mappingId: number; userId: number },
  ) {
    return this.laborService.importLaborData(
      parseInt(projectId),
      body.data,
      body.mappingId,
      body.userId,
    );
  }
}
