import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { QualityRatingService } from './quality-rating.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('quality/ratings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QualityRatingController {
  constructor(private readonly service: QualityRatingService) {}

  @Get(':projectId/config')
  @Permissions('QUALITY.RATING.READ')
  getConfig(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.service.getConfig(projectId);
  }

  @Post(':projectId/config')
  @Permissions('QUALITY.RATING.CONFIGURE')
  updateConfig(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: any,
  ) {
    return this.service.updateConfig(projectId, body);
  }

  @Get(':projectId/calculate')
  @Permissions('QUALITY.RATING.READ')
  calculate(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query('status') status: string,
  ) {
    return this.service.calculateProjectRating(
      projectId,
      status || 'Structure',
    );
  }

  @Post(':projectId/snapshot')
  @Permissions('QUALITY.RATING_SNAPSHOT.CREATE')
  createSnapshot(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body('status') status: string,
  ) {
    return this.service.saveMonthlyRating(projectId, status || 'Structure');
  }

  @Get(':projectId/history')
  @Permissions('QUALITY.RATING.READ')
  getHistory(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.service.getRatingHistory(projectId);
  }

  @Delete(':projectId/snapshot/:snapshotId')
  @Permissions('QUALITY.RATING_SNAPSHOT.DELETE')
  deleteSnapshot(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('snapshotId', ParseIntPipe) snapshotId: number,
  ) {
    return this.service.deleteSnapshot(projectId, snapshotId);
  }
}
