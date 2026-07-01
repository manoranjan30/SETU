import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { AdminDataService } from './admin-data.service';

const requestMeta = (req: any) => ({
  userId: req?.user?.userId || req?.user?.id || null,
  username: req?.user?.username || req?.user?.email || null,
  ipAddress:
    req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    req?.ip ||
    req?.socket?.remoteAddress ||
    null,
  userAgent: req?.headers?.['user-agent'] || null,
});

@Controller('admin/data-maintenance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminDataController {
  constructor(private readonly service: AdminDataService) {}

  @Get('tables')
  @Permissions('ADMIN.DATA_EDITOR.READ')
  listTables() {
    return this.service.listTables();
  }

  @Get('tables/:tableName')
  @Permissions('ADMIN.DATA_EDITOR.READ')
  describeTable(@Param('tableName') tableName: string) {
    return this.service.describeTable(tableName);
  }

  @Get('tables/:tableName/rows')
  @Permissions('ADMIN.DATA_EDITOR.READ')
  listRows(
    @Param('tableName') tableName: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('q') q?: string,
  ) {
    return this.service.listRows(
      tableName,
      limit ? Number(limit) : 50,
      offset ? Number(offset) : 0,
      q,
    );
  }

  @Patch('tables/:tableName/rows/:primaryKeyValue')
  @Permissions('ADMIN.DATA_EDITOR.UPDATE')
  updateRow(
    @Param('tableName') tableName: string,
    @Param('primaryKeyValue') primaryKeyValue: string,
    @Body()
    body: {
      changes?: Record<string, unknown>;
      reason?: string;
    },
    @Req() req,
  ) {
    return this.service.updateRow(
      tableName,
      primaryKeyValue,
      body.changes || {},
      body.reason || '',
      requestMeta(req),
    );
  }

  @Get('corrections')
  @Permissions('ADMIN.DATA_EDITOR.READ')
  listCorrections(
    @Query('tableName') tableName?: string,
    @Query('primaryKeyValue') primaryKeyValue?: string,
  ) {
    return this.service.listCorrections(tableName, primaryKeyValue);
  }

  @Post('corrections/:id/revert')
  @Permissions('ADMIN.DATA_EDITOR.REVERT')
  revertCorrection(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason?: string },
    @Req() req,
  ) {
    return this.service.revertCorrection(
      id,
      body.reason || '',
      requestMeta(req),
    );
  }
}
