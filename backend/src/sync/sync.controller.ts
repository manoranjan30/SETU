import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SyncService } from './sync.service';
import { SyncQueryDto } from './sync-query.dto';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /**
   * GET /api/sync/progress?projectId=123&since=2026-04-01T00:00:00Z
   * Returns progress entries updated after [since] for the project.
   * If [since] is omitted, returns all entries (bootstrap).
   */
  @Get('progress')
  getProgressDelta(@Query() query: SyncQueryDto) {
    return this.syncService.getProgressDelta(query.projectId, query.since);
  }

  /**
   * GET /api/sync/quality?projectId=123&since=2026-04-01T00:00:00Z
   * Returns quality lists, activities, and site observations updated after [since].
   */
  @Get('quality')
  getQualityDelta(@Query() query: SyncQueryDto) {
    return this.syncService.getQualityDelta(query.projectId, query.since);
  }

  /**
   * GET /api/sync/ehs?projectId=123&since=2026-04-01T00:00:00Z
   * Returns EHS observations updated after [since].
   */
  @Get('ehs')
  getEhsDelta(@Query() query: SyncQueryDto) {
    return this.syncService.getEhsDelta(query.projectId, query.since);
  }
}
