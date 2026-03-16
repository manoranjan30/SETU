import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { EpsNode } from '../eps/eps.entity';
import { Activity } from '../wbs/entities/activity.entity';
import { MeasurementProgress } from '../boq/entities/measurement-progress.entity';
import { DailyLaborPresence } from '../labor/entities/daily-labor-presence.entity';
import { WoActivityPlan } from '../planning/entities/wo-activity-plan.entity';
import { SiteObservation } from '../quality/entities/site-observation.entity';
import { EhsIncident } from '../ehs/entities/ehs-incident.entity';
import { EhsManhours } from '../ehs/entities/ehs-manhours.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EpsNode,
      Activity,
      MeasurementProgress,
      DailyLaborPresence,
      WoActivityPlan,
      SiteObservation,
      EhsIncident,
      EhsManhours,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
