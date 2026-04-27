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
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ResolvePresetPermissionsDto } from './dto/resolve-preset-permissions.dto';
import { UpsertRoleTemplateDto } from './dto/upsert-role-template.dto';
import { RoleCatalogService } from './role-catalog.service';

@Controller('role-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin')
export class RoleTemplatesController {
  constructor(private readonly roleCatalogService: RoleCatalogService) {}

  @Get()
  list() {
    return this.roleCatalogService.listRoleTemplates();
  }

  @Post()
  create(@Body() dto: UpsertRoleTemplateDto) {
    return this.roleCatalogService.createRoleTemplate(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpsertRoleTemplateDto) {
    return this.roleCatalogService.updateRoleTemplate(id, dto);
  }

  @Delete(':id')
  archive(@Param('id', ParseIntPipe) id: number) {
    return this.roleCatalogService.archiveRoleTemplate(id);
  }

  @Post(':id/clone')
  clone(@Param('id', ParseIntPipe) id: number) {
    return this.roleCatalogService.cloneRoleTemplate(id);
  }

  @Post('resolve')
  resolve(@Body() dto: ResolvePresetPermissionsDto) {
    return this.roleCatalogService.resolveFromTemplateCodes(
      dto.templateCodes ?? [],
    );
  }
}
