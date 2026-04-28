import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { EhsObservationService } from './ehs-observation.service';
import {
  CreateEhsObservationDto,
  RectifyEhsObservationDto,
  CloseEhsObservationDto,
  RejectEhsObservationRectificationDto,
  HoldEhsObservationDto,
} from './dto/ehs-observation.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { Auditable } from '../audit/auditable.decorator';

@Controller('ehs/site-observations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EhsObservationController {
  constructor(private readonly service: EhsObservationService) {}

  @Get()
  @Permissions('EHS.SITE_OBS.READ')
  getAll(
    @Query('projectId', ParseIntPipe) projectId: number,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
  ) {
    return this.service.getAll(projectId, status, severity);
  }

  @Get(':id')
  @Permissions('EHS.SITE_OBS.READ')
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Post()
  @Permissions('EHS.SITE_OBS.CREATE')
  @Auditable('EHS', 'CREATE_SITE_OBS')
  create(@Body() dto: CreateEhsObservationDto, @Request() req) {
    return this.service.create(dto, req.user?.id || req.user?.userId);
  }

  @Get('categories/:projectId')
  @Permissions('EHS.SITE_OBS.READ')
  getCategories(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.service.getObservationCategories(projectId);
  }

  @Put('categories/:projectId')
  @Permissions('EHS.SITE_OBS.CREATE')
  updateCategories(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body('categories') categories: string[],
  ) {
    return this.service.updateObservationCategories(projectId, categories);
  }

  @Patch(':id/rectify')
  @Permissions('EHS.SITE_OBS.RECTIFY')
  @Auditable('EHS', 'RECTIFY_SITE_OBS', 'id')
  rectify(
    @Param('id') id: string,
    @Body() dto: RectifyEhsObservationDto,
    @Request() req,
  ) {
    return this.service.rectify(id, dto, req.user?.id || req.user?.userId);
  }

  @Patch(':id/close')
  @Permissions('EHS.SITE_OBS.CLOSE')
  @Auditable('EHS', 'CLOSE_SITE_OBS', 'id')
  close(
    @Param('id') id: string,
    @Body() dto: CloseEhsObservationDto,
    @Request() req,
  ) {
    return this.service.close(id, dto, req.user?.id || req.user?.userId);
  }

  @Patch(':id/reject-rectification')
  @Permissions('EHS.SITE_OBS.CLOSE')
  @Auditable('EHS', 'REJECT_SITE_OBS_RECTIFICATION', 'id')
  rejectRectification(
    @Param('id') id: string,
    @Body() dto: RejectEhsObservationRectificationDto,
    @Request() req,
  ) {
    return this.service.rejectRectification(
      id,
      dto,
      req.user?.id || req.user?.userId,
    );
  }

  @Patch(':id/hold')
  @Permissions('EHS.SITE_OBS.CLOSE')
  @Auditable('EHS', 'HOLD_SITE_OBS', 'id')
  hold(@Param('id') id: string, @Body() dto: HoldEhsObservationDto, @Request() req) {
    return this.service.hold(id, dto, req.user?.id || req.user?.userId);
  }

  @Patch(':id/unhold')
  @Permissions('EHS.SITE_OBS.CLOSE')
  @Auditable('EHS', 'UNHOLD_SITE_OBS', 'id')
  unhold(@Param('id') id: string) {
    return this.service.unhold(id);
  }

  @Delete(':id')
  @Permissions('EHS.SITE_OBS.DELETE')
  @Auditable('EHS', 'DELETE_SITE_OBS', 'id')
  delete(@Param('id') id: string, @Request() req) {
    return this.service.delete(id, req.user?.id || req.user?.userId);
  }
}
