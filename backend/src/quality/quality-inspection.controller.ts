import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { QualityInspectionService } from './quality-inspection.service';
import type {
  CreateInspectionDto,
  UpdateInspectionStatusDto,
} from './quality-inspection.service';

@Controller('quality/inspections')
export class QualityInspectionController {
  constructor(private readonly service: QualityInspectionService) {}

  @Get()
  getInspections(
    @Query('projectId', ParseIntPipe) projectId: number,
    @Query('epsNodeId', new ParseIntPipe({ optional: true }))
    epsNodeId?: number,
    @Query('listId', new ParseIntPipe({ optional: true })) listId?: number,
  ) {
    return this.service.getInspections(projectId, epsNodeId, listId);
  }

  @Post()
  create(@Body() dto: CreateInspectionDto, @Request() req) {
    return this.service.create(dto, req.user?.id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInspectionStatusDto,
    @Request() req,
  ) {
    return this.service.updateStatus(id, dto, req.user?.id);
  }
}
