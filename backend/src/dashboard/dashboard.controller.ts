import { Controller, Get, UseGuards } from '@nestjs/common';
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
}
