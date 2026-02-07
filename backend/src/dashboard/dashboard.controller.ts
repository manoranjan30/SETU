import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async getSummary() {
    return this.dashboardService.getPortfolioSummary();
  }

  @Get('burn-rate')
  async getBurnRate() {
    return this.dashboardService.getPortfolioBurnRate();
  }

  @Get('manpower')
  async getManpower() {
    return this.dashboardService.getTodaysManpower();
  }

  @Get('milestones')
  async getMilestones() {
    return this.dashboardService.getUpcomingMilestones();
  }

  @Get('alerts')
  async getAlerts() {
    return this.dashboardService.getAlerts();
  }
}
