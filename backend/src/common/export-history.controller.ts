import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { ExportHistoryService } from './export-history.service';

@Controller('admin/export-history')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExportHistoryController {
  constructor(private readonly service: ExportHistoryService) {}

  @Get()
  @Permissions('ADMIN.SETTINGS.MANAGE')
  list(@Query('module') module?: string, @Query('limit') limit?: string) {
    return this.service.list(module, limit ? Number(limit) : 50);
  }
}
