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
import { SiteObservationService } from './site-observation.service';
import {
  CreateSiteObservationDto,
  RectifySiteObservationDto,
  CloseSiteObservationDto,
  RejectSiteObservationRectificationDto,
  HoldSiteObservationDto,
} from './dto/site-observation.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { Auditable } from '../audit/auditable.decorator';

@Controller('quality/site-observations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SiteObservationController {
  constructor(private readonly service: SiteObservationService) {}

  @Get()
  @Permissions('QUALITY.SITE_OBS.READ')
  getAll(
    @Query('projectId', ParseIntPipe) projectId: number,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
  ) {
    return this.service.getAll(projectId, status, severity);
  }

  @Get(':id')
  @Permissions('QUALITY.SITE_OBS.READ')
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Post()
  @Permissions('QUALITY.SITE_OBS.CREATE')
  @Auditable('QUALITY', 'CREATE_SITE_OBS')
  create(@Body() dto: CreateSiteObservationDto, @Request() req) {
    return this.service.create(dto, req.user?.id || req.user?.userId);
  }

  @Get('categories/:projectId')
  @Permissions('QUALITY.SITE_OBS.READ')
  getCategories(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.service.getObservationCategories(projectId);
  }

  @Put('categories/:projectId')
  @Permissions('QUALITY.SITE_OBS.CREATE')
  updateCategories(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body('categories') categories: string[],
  ) {
    return this.service.updateObservationCategories(projectId, categories);
  }

  @Patch(':id/rectify')
  @Permissions('QUALITY.SITE_OBS.RECTIFY')
  @Auditable('QUALITY', 'RECTIFY_SITE_OBS', 'id')
  rectify(
    @Param('id') id: string,
    @Body() dto: RectifySiteObservationDto,
    @Request() req,
  ) {
    return this.service.rectify(id, dto, req.user?.id || req.user?.userId);
  }

  @Patch(':id/close')
  @Permissions('QUALITY.SITE_OBS.CLOSE')
  @Auditable('QUALITY', 'CLOSE_SITE_OBS', 'id')
  close(
    @Param('id') id: string,
    @Body() dto: CloseSiteObservationDto,
    @Request() req,
  ) {
    return this.service.close(id, dto, req.user?.id || req.user?.userId);
  }

  @Patch(':id/reject-rectification')
  @Permissions('QUALITY.SITE_OBS.CLOSE')
  @Auditable('QUALITY', 'REJECT_SITE_OBS_RECTIFICATION', 'id')
  rejectRectification(
    @Param('id') id: string,
    @Body() dto: RejectSiteObservationRectificationDto,
    @Request() req,
  ) {
    return this.service.rejectRectification(
      id,
      dto,
      req.user?.id || req.user?.userId,
    );
  }

  @Patch(':id/hold')
  @Permissions('QUALITY.SITE_OBS.CLOSE')
  @Auditable('QUALITY', 'HOLD_SITE_OBS', 'id')
  hold(@Param('id') id: string, @Body() dto: HoldSiteObservationDto, @Request() req) {
    return this.service.hold(id, dto, req.user?.id || req.user?.userId);
  }

  @Patch(':id/unhold')
  @Permissions('QUALITY.SITE_OBS.CLOSE')
  @Auditable('QUALITY', 'UNHOLD_SITE_OBS', 'id')
  unhold(@Param('id') id: string) {
    return this.service.unhold(id);
  }

  @Delete(':id')
  @Permissions('QUALITY.SITE_OBS.DELETE')
  @Auditable('QUALITY', 'DELETE_SITE_OBS', 'id')
  delete(@Param('id') id: string, @Request() req) {
    return this.service.delete(id, req.user?.id || req.user?.userId);
  }
}
