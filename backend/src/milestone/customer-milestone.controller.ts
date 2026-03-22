import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectContextGuard } from '../projects/guards/project-context.guard';
import { ProjectAssignmentGuard } from '../projects/guards/project-assignment.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { CustomerMilestoneService } from './customer-milestone.service';
import {
  AddMilestoneTrancheDto,
  CloneTowerMilestoneTemplatesDto,
  ManualTriggerMilestoneDto,
  RaiseMilestoneInvoiceDto,
  UpdateMilestoneAchievementStatusDto,
  UpsertCustomerMilestoneTemplateDto,
  UpsertFlatSaleInfoDto,
} from './dto/customer-milestone.dto';

@Controller('milestones')
@UseGuards(
  JwtAuthGuard,
  ProjectContextGuard,
  ProjectAssignmentGuard,
  PermissionsGuard,
)
export class CustomerMilestoneController {
  constructor(private readonly service: CustomerMilestoneService) {}

  @Get(':projectId/templates')
  @Permissions('MILESTONE.READ')
  listTemplates(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.service.listTemplates(projectId);
  }

  @Get(':projectId/scope-options')
  @Permissions('MILESTONE.READ')
  listScopeOptions(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.service.listScopeOptions(projectId);
  }

  @Get(':projectId/schedule-activities')
  @Permissions('MILESTONE.READ')
  listScheduleActivities(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.service.listScheduleActivities(projectId);
  }

  @Post(':projectId/templates')
  @Permissions('MILESTONE.TEMPLATE.CREATE')
  createTemplate(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: UpsertCustomerMilestoneTemplateDto,
    @Request() req: any,
  ) {
    return this.service.upsertTemplate(projectId, dto, req.user?.id);
  }

  @Put(':projectId/templates/:id')
  @Permissions('MILESTONE.TEMPLATE.CREATE')
  updateTemplate(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertCustomerMilestoneTemplateDto,
    @Request() req: any,
  ) {
    return this.service.upsertTemplate(projectId, dto, req.user?.id, id);
  }

  @Delete(':projectId/templates/:id')
  @Permissions('MILESTONE.TEMPLATE.DELETE')
  deleteTemplate(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.deleteTemplate(projectId, id);
  }

  @Post(':projectId/templates/clone-tower')
  @Permissions('MILESTONE.TEMPLATE.CREATE')
  cloneTowerTemplates(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CloneTowerMilestoneTemplatesDto,
    @Request() req: any,
  ) {
    return this.service.cloneTowerTemplates(projectId, dto, req.user?.id);
  }

  @Get(':projectId/flat-sales')
  @Permissions('MILESTONE.READ')
  listFlatSales(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.service.listFlatSales(projectId);
  }

  @Post(':projectId/flat-sales')
  @Permissions('MILESTONE.FLATINFO.EDIT')
  createFlatSale(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: UpsertFlatSaleInfoDto,
    @Request() req: any,
  ) {
    return this.service.upsertFlatSale(projectId, dto, req.user?.id);
  }

  @Put(':projectId/flat-sales/:id')
  @Permissions('MILESTONE.FLATINFO.EDIT')
  updateFlatSale(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertFlatSaleInfoDto,
    @Request() req: any,
  ) {
    return this.service.upsertFlatSale(projectId, dto, req.user?.id, id);
  }

  @Get(':projectId/units')
  @Permissions('MILESTONE.READ')
  listUnitMilestones(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.service.listUnitMilestones(projectId);
  }

  @Post(':projectId/achievements/:achievementId/manual-trigger')
  @Permissions('MILESTONE.TRIGGER.MANUAL')
  manualTrigger(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('achievementId', ParseIntPipe) achievementId: number,
    @Body() dto: ManualTriggerMilestoneDto,
    @Request() req: any,
  ) {
    return this.service.manualTrigger(projectId, achievementId, req.user?.id, dto);
  }

  @Post(':projectId/achievements/:achievementId/invoice')
  @Permissions('MILESTONE.INVOICE.RAISE')
  raiseInvoice(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('achievementId', ParseIntPipe) achievementId: number,
    @Body() dto: RaiseMilestoneInvoiceDto,
    @Request() req: any,
  ) {
    return this.service.raiseInvoice(projectId, achievementId, req.user?.id, dto);
  }

  @Post(':projectId/achievements/:achievementId/tranches')
  @Permissions('MILESTONE.COLLECT')
  addTranche(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('achievementId', ParseIntPipe) achievementId: number,
    @Body() dto: AddMilestoneTrancheDto,
    @Request() req: any,
  ) {
    return this.service.addTranche(projectId, achievementId, req.user?.id, dto);
  }

  @Patch(':projectId/achievements/:achievementId/status')
  @Permissions('MILESTONE.WAIVE')
  updateStatus(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('achievementId', ParseIntPipe) achievementId: number,
    @Body() dto: UpdateMilestoneAchievementStatusDto,
  ) {
    return this.service.updateAchievementStatus(projectId, achievementId, dto);
  }

  @Post(':projectId/recompute')
  @Permissions('MILESTONE.TRIGGER.MANUAL')
  recompute(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.service.recomputeProjectAchievements(projectId);
  }
}
