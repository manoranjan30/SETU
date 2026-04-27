import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ResolvePresetPermissionsDto } from './dto/resolve-preset-permissions.dto';
import { UpsertActionPresetDto } from './dto/upsert-action-preset.dto';
import { RoleCatalogService } from './role-catalog.service';

@Controller('role-presets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin')
export class RolePresetsController {
  constructor(private readonly roleCatalogService: RoleCatalogService) {}

  @Get()
  list() {
    return this.roleCatalogService.listActionPresets();
  }

  @Post()
  create(@Body() dto: UpsertActionPresetDto) {
    return this.roleCatalogService.createActionPreset(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpsertActionPresetDto) {
    return this.roleCatalogService.updateActionPreset(id, dto);
  }

  @Delete(':id')
  archive(@Param('id', ParseIntPipe) id: number) {
    return this.roleCatalogService.archiveActionPreset(id);
  }

  @Post(':id/clone')
  clone(@Param('id', ParseIntPipe) id: number) {
    return this.roleCatalogService.cloneActionPreset(id);
  }

  @Post('resolve')
  resolve(@Body() dto: ResolvePresetPermissionsDto) {
    return this.roleCatalogService.resolveFromPresetCodes(dto.presetCodes ?? []);
  }
}
