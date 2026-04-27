import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RoleCatalogService } from './role-catalog.service';

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RolesController {
  constructor(
    private readonly rolesService: RolesService,
    private readonly roleCatalogService: RoleCatalogService,
  ) {}

  // ─── Permission Preset Endpoints (MUST be before :id routes) ──────────────

  /** Returns all 22 atomic permission presets */
  @Get('presets')
  @Roles('Admin')
  getPresets() {
    return this.roleCatalogService.listActionPresets();
  }

  /** Returns all 8 composite role templates */
  @Get('templates')
  @Roles('Admin')
  getRoleTemplates() {
    return this.roleCatalogService.listRoleTemplates();
  }

  /**
   * Resolves one or more preset IDs into a flat, deduplicated list of
   * permission codes. Used by the frontend to preview what will be saved.
   *
   * POST /roles/presets/resolve
   * Body: { presetIds: ['PROGRESS_ENTRY_OPERATOR', 'DRAWINGS_VIEWER'] }
   * Returns: { codes: ['EPS.NODE.READ', 'WBS.NODE.READ', ...], count: N }
   */
  @Post('presets/resolve')
  @Roles('Admin')
  resolvePresets(@Body() body: { presetIds: string[] }) {
    return this.roleCatalogService.resolveFromPresetCodes(body.presetIds ?? []);
  }

  // ─── Standard CRUD Endpoints ───────────────────────────────────────────────

  @Post()
  @Roles('Admin')
  create(@Body() createRoleDto: CreateRoleDto) {
    return this.rolesService.create(createRoleDto);
  }

  @Get()
  @Roles('Admin')
  findAll() {
    return this.rolesService.findAll();
  }

  /** NOTE: This :id route must come AFTER all static routes like /presets and /templates */
  @Get(':id')
  @Roles('Admin')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(+id);
  }

  @Put(':id')
  @Roles('Admin')
  update(@Param('id') id: string, @Body() createRoleDto: CreateRoleDto) {
    return this.rolesService.update(+id, createRoleDto);
  }

  @Delete(':id')
  @Roles('Admin')
  remove(@Param('id') id: string) {
    return this.rolesService.remove(+id);
  }
}
