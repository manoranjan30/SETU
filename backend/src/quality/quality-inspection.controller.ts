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
  UseGuards,
} from '@nestjs/common';
import { QualityInspectionService } from './quality-inspection.service';
import type {
  CreateInspectionDto,
  UpdateInspectionStatusDto,
} from './quality-inspection.service';
import { Auditable } from '../audit/auditable.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('quality/inspections')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QualityInspectionController {
  constructor(private readonly service: QualityInspectionService) { }

  @Get()
  @Permissions('QUALITY.INSPECTION.READ')
  getInspections(
    @Query('projectId', ParseIntPipe) projectId: number,
    @Query('epsNodeId', new ParseIntPipe({ optional: true }))
    epsNodeId?: number,
    @Query('listId', new ParseIntPipe({ optional: true })) listId?: number,
  ) {
    return this.service.getInspections(projectId, epsNodeId, listId);
  }

  @Get(':id')
  @Permissions('QUALITY.INSPECTION.READ')
  getInspectionDetails(@Param('id', ParseIntPipe) id: number) {
    return this.service.getInspectionDetails(id);
  }

  @Post()
  @Permissions('QUALITY.INSPECTION.RAISE')
  @Auditable('QUALITY', 'RAISE_RFI')
  create(@Body() dto: CreateInspectionDto, @Request() req) {
    return this.service.create(dto, req.user?.id);
  }

  @Patch(':id/status')
  @Permissions('QUALITY.INSPECTION.APPROVE')
  @Auditable('QUALITY', 'UPDATE_RFI_STATUS', 'id')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInspectionStatusDto,
    @Request() req,
  ) {
    return this.service.updateStatus(id, dto, req.user?.id);
  }

  @Patch('stage/:stageId')
  @Permissions('QUALITY.INSPECTION.APPROVE')
  updateStageStatus(
    @Param('stageId', ParseIntPipe) stageId: number,
    @Body() data: any,
    @Request() req,
  ) {
    return this.service.updateStageStatus(stageId, {
      ...data,
      userId: req.user?.name || req.user?.id || 'System',
    });
  }
}
