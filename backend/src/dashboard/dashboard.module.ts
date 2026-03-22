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
import { CustomerMilestoneAchievement } from '../milestone/entities/customer-milestone-achievement.entity';
import { IssueTrackerIssue } from '../planning/entities/issue-tracker-issue.entity';
import { QualityInspection } from '../quality/entities/quality-inspection.entity';
import { QualityAudit } from '../quality/entities/quality-audit.entity';
import { SnagList } from '../snag/entities/snag-list.entity';
import { EhsTraining } from '../ehs/entities/ehs-training.entity';
import { EhsInspection } from '../ehs/entities/ehs-inspection.entity';
import { EhsLegalRegister } from '../ehs/entities/ehs-legal-register.entity';
import { EhsMachinery } from '../ehs/entities/ehs-machinery.entity';
import { EhsVehicle } from '../ehs/entities/ehs-vehicle.entity';
import { EhsObservation } from '../ehs/entities/ehs-observation.entity';
import { EhsCompetency } from '../ehs/entities/ehs-competency.entity';
import { ProjectRating } from '../quality/entities/quality-project-rating.entity';
import { DrawingRegister } from '../design/entities/drawing-register.entity';
import { WorkOrder } from '../workdoc/entities/work-order.entity';
import { DashboardExecutiveService } from './dashboard-executive.service';

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
      CustomerMilestoneAchievement,
      IssueTrackerIssue,
      QualityInspection,
      QualityAudit,
      SnagList,
      EhsTraining,
      EhsInspection,
      EhsLegalRegister,
      EhsMachinery,
      EhsVehicle,
      EhsObservation,
      EhsCompetency,
      ProjectRating,
      DrawingRegister,
      WorkOrder,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardExecutiveService],
  exports: [DashboardService],
})
export class DashboardModule {}
