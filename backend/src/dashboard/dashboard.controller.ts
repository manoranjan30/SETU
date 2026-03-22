import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Permissions('DASHBOARD.SUMMARY.READ')
  async getSummary() {
    return this.dashboardService.getPortfolioSummary();
  }

  @Get('burn-rate')
  @Permissions('DASHBOARD.SUMMARY.READ')
  async getBurnRate() {
    return this.dashboardService.getPortfolioBurnRate();
  }

  @Get('manpower')
  @Permissions('DASHBOARD.SUMMARY.READ')
  async getManpower() {
    return this.dashboardService.getTodaysManpower();
  }

  @Get('milestones')
  @Permissions('DASHBOARD.SUMMARY.READ')
  async getMilestones() {
    return this.dashboardService.getUpcomingMilestones();
  }

  @Get('alerts')
  @Permissions('DASHBOARD.ALERTS.READ')
  async getAlerts() {
    return this.dashboardService.getAlerts();
  }

  @Get('quality-metrics')
  @Permissions('DASHBOARD.SUMMARY.READ')
  async getQualityMetrics() {
    return this.dashboardService.getQualityMetrics();
  }

  @Get('ehs-metrics')
  @Permissions('DASHBOARD.SUMMARY.READ')
  async getEhsMetrics() {
    return this.dashboardService.getEhsMetrics();
  }

  @Get('executive/options/companies')
  @Permissions('DASHBOARD.EXECUTIVE.READ')
  async getExecutiveCompanies(@Req() req: any) {
    return this.dashboardService.listExecutiveCompanies(req.user);
  }

  @Get('executive/options/projects')
  @Permissions('DASHBOARD.EXECUTIVE.READ')
  async getExecutiveProjects(
    @Req() req: any,
    @Query('companyId') companyId?: string,
  ) {
    return this.dashboardService.listExecutiveProjects(
      req.user,
      companyId ? Number(companyId) : null,
    );
  }

  @Get('executive/enterprise')
  @Permissions('DASHBOARD.EXECUTIVE.READ')
  async getExecutiveEnterprise(
    @Req() req: any,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<any> {
    return this.dashboardService.getEnterpriseExecutiveSummary(
      req.user,
      dateFrom,
      dateTo,
    );
  }

  @Get('executive/company/:companyId')
  @Permissions('DASHBOARD.EXECUTIVE.READ')
  async getExecutiveCompany(
    @Req() req: any,
    @Param('companyId', ParseIntPipe) companyId: number,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<any> {
    return this.dashboardService.getCompanyExecutiveSummary(
      req.user,
      companyId,
      dateFrom,
      dateTo,
    );
  }

  @Get('executive/project/:projectId')
  @Permissions('DASHBOARD.EXECUTIVE.READ')
  async getExecutiveProject(
    @Req() req: any,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<any> {
    return this.dashboardService.getProjectExecutiveSummary(
      req.user,
      projectId,
      dateFrom,
      dateTo,
    );
  }
}
