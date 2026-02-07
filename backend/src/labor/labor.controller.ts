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

@Controller('labor')
export class LaborController {
  constructor(private readonly laborService: LaborService) {}

  @Get('categories')
  getCategories(@Query('projectId') projectId?: string) {
    return this.laborService.getCategories(
      projectId ? parseInt(projectId) : undefined,
    );
  }

  @Post('categories')
  saveCategories(@Body() categories: any[]) {
    return this.laborService.saveCategories(categories);
  }

  @Get('presence/:projectId')
  getDailyPresence(
    @Param('projectId') projectId: string,
    @Query('date') date?: string,
  ) {
    return this.laborService.getDailyPresence(parseInt(projectId), date);
  }

  @Post('presence/:projectId')
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
  getActivityLabor(@Param('activityId') activityId: string) {
    return this.laborService.getActivityLabor(parseInt(activityId));
  }

  @Get('allocations/:projectId')
  getAllocationsByProject(
    @Param('projectId') projectId: string,
    @Query('date') date?: string,
  ) {
    return this.laborService.getAllocationsByProject(parseInt(projectId), date);
  }

  @Post('activity')
  saveActivityLabor(@Body() body: { entries: any[]; userId: number }) {
    return this.laborService.saveActivityLabor(body.entries, body.userId);
  }

  @Get('mappings/:projectId')
  getMappings(@Param('projectId') projectId: string) {
    return this.laborService.getMappings(parseInt(projectId));
  }

  @Post('mappings')
  saveMapping(@Body() mapping: any) {
    return this.laborService.saveMapping(mapping);
  }

  @Post('import/:projectId')
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
