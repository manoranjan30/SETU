import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { DashboardBuilderService } from './dashboard-builder.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('dashboard-builder')
export class DashboardBuilderController {
  constructor(private readonly service: DashboardBuilderService) {}

  // ═══ Static routes MUST come before :id param routes ═══════════════════

  @Get()
  @Permissions('ADMIN.DASHBOARD.READ')
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @Permissions('ADMIN.DASHBOARD.CREATE')
  create(@Body() dto: any, @Request() req: any) {
    return this.service.create(dto, req.user.id);
  }

  @Get('my')
  getMyDashboard(@Request() req: any, @Query('projectId') projectId: string) {
    const pId = projectId ? parseInt(projectId, 10) : undefined;
    return this.service.getDefaultDashboard(req.user.id, req.user.roles, pId);
  }

  @Get('defaults/my')
  getDefaultsMy(@Request() req: any, @Query('projectId') projectId: string) {
    const pId = projectId ? parseInt(projectId, 10) : undefined;
    return this.service.getDefaultDashboard(req.user.id, req.user.roles, pId);
  }

  // ─── Data Sources (must be before :id) ──────────────────────────────────

  @Get('data-sources')
  @Permissions('ADMIN.DASHBOARD.READ')
  getDataSources() {
    return this.service.getDataSources();
  }

  @Post('data-sources/:key/query')
  queryData(@Param('key') key: string, @Body() config: any) {
    return this.service.queryData(key, config);
  }

  @Post('data-sources/:key/preview')
  @Permissions('ADMIN.DASHBOARD.READ')
  previewData(@Param('key') key: string, @Body() config: any) {
    return this.service.previewData(key, config);
  }

  // ─── Templates (must be before :id) ─────────────────────────────────────

  @Get('templates')
  @Permissions('ADMIN.DASHBOARD.READ')
  getTemplates() {
    return this.service.getTemplates();
  }

  @Post('templates/:templateId/apply')
  @Permissions('ADMIN.DASHBOARD.CREATE')
  applyTemplate(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Request() req: any,
  ) {
    return this.service.applyTemplate(templateId, req.user.id);
  }

  // ─── Assignments (must be before :id) ───────────────────────────────────

  @Get('assignments')
  @Permissions('ADMIN.DASHBOARD.READ')
  getAssignments() {
    return this.service.getAllAssignments();
  }

  @Post('assignments')
  @Permissions('ADMIN.DASHBOARD.UPDATE')
  saveAssignment(@Body() dto: any) {
    return this.service.saveAssignment(dto);
  }

  @Delete('assignments/:id')
  @Permissions('ADMIN.DASHBOARD.UPDATE')
  deleteAssignment(@Param('id', ParseIntPipe) id: number) {
    return this.service.removeAssignment(id);
  }

  // ─── Widget operations (static path before :id) ─────────────────────────

  @Patch('widgets/:widgetId')
  @Permissions('ADMIN.DASHBOARD.UPDATE')
  updateWidget(
    @Param('widgetId', ParseIntPipe) widgetId: number,
    @Body() dto: any,
  ) {
    return this.service.updateWidget(widgetId, dto);
  }

  @Delete('widgets/:widgetId')
  @Permissions('ADMIN.DASHBOARD.DELETE')
  removeWidget(@Param('widgetId', ParseIntPipe) widgetId: number) {
    return this.service.removeWidget(widgetId);
  }

  // ═══ Parameterized :id routes ══════════════════════════════════════════

  @Get(':id')
  @Permissions('ADMIN.DASHBOARD.READ')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permissions('ADMIN.DASHBOARD.UPDATE')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions('ADMIN.DASHBOARD.DELETE')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  @Post(':id/clone')
  @Permissions('ADMIN.DASHBOARD.CREATE')
  clone(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.service.clone(id, req.user.id);
  }

  @Post(':id/widgets')
  @Permissions('ADMIN.DASHBOARD.UPDATE')
  addWidget(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return this.service.addWidget(id, dto);
  }

  @Post(':id/assign')
  @Permissions('ADMIN.DASHBOARD.UPDATE')
  assignDashboard(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return this.service.assignDashboard(id, dto);
  }

  @Delete(':id/assign/:assignmentId')
  @Permissions('ADMIN.DASHBOARD.UPDATE')
  removeAssignment(@Param('assignmentId', ParseIntPipe) assignmentId: number) {
    return this.service.removeAssignment(assignmentId);
  }

  @Post(':id/save-as-template')
  @Permissions('ADMIN.DASHBOARD.CREATE')
  saveAsTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { name: string; category: string; description?: string },
    @Request() req: any,
  ) {
    return this.service.saveAsTemplate(id, dto, req.user.id);
  }
}
