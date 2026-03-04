import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { QualityRatingService } from './quality-rating.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('quality/ratings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QualityRatingController {
  constructor(private readonly service: QualityRatingService) {}

  @Get(':projectId/config')
  getConfig(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.service.getConfig(projectId);
  }

  @Post(':projectId/config')
  @Roles('Admin')
  updateConfig(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: any,
  ) {
    return this.service.updateConfig(projectId, body);
  }

  @Get(':projectId/calculate')
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
  @Roles('Admin')
  createSnapshot(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body('status') status: string,
  ) {
    return this.service.saveMonthlyRating(projectId, status || 'Structure');
  }

  @Get(':projectId/history')
  getHistory(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.service.getRatingHistory(projectId);
  }
}
