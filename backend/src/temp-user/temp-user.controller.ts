import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TempUserService } from './temp-user.service';
import { CreateTempUserDto } from './dto/create-temp-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('temp-users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TempUserController {
  constructor(private readonly service: TempUserService) {}

  @Get('vendors')
  @Permissions('TEMP_USER.CREATE')
  getVendors(@Query('projectId') projectId: number) {
    if (!projectId) return [];
    return this.service.getVendorsForProject(+projectId);
  }

  @Get('work-orders')
  @Permissions('TEMP_USER.CREATE')
  getWorkOrders(
    @Query('vendorId') vendorId: number,
    @Query('projectId') projectId: number,
  ) {
    if (!vendorId || !projectId) return [];
    return this.service.getWorkOrdersForVendorInProject(+vendorId, +projectId);
  }

  @Post()
  @Permissions('TEMP_USER.CREATE')
  create(@Body() dto: CreateTempUserDto, @Request() req) {
    return this.service.create(dto, req.user.id);
  }

  @Get()
  @Permissions('TEMP_USER.VIEW')
  findAll(@Query('projectId') projectId: number) {
    if (!projectId) return [];
    return this.service.getTempUsersInProject(+projectId);
  }

  @Put(':id/suspend')
  @Permissions('TEMP_USER.SUSPEND')
  suspend(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Request() req,
  ) {
    return this.service.suspend(+id, reason, req.user.id);
  }

  @Put(':id/reactivate')
  @Permissions('TEMP_USER.SUSPEND') // Usually reactivate requires same perm as suspend
  reactivate(@Param('id') id: string, @Request() req) {
    return this.service.reactivate(+id, req.user.id);
  }

  @Put(':id/status')
  @Permissions('TEMP_USER.SUSPEND')
  updateStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
    @Request() req,
  ) {
    return this.service.updateStatus(+id, isActive, req.user.id);
  }

  @Put(':id/reset-password')
  @Permissions('TEMP_USER.CREATE') // Same permission as create usually implies editing
  resetPassword(@Param('id') id: string, @Body('password') password: string) {
    return this.service.adminResetPassword(+id, password);
  }
}
