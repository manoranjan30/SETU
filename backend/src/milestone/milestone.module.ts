import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QualityFloorStructure } from '../quality/entities/quality-floor-structure.entity';
import { QualityUnit } from '../quality/entities/quality-unit.entity';
import { QualityInspection } from '../quality/entities/quality-inspection.entity';
import { QuantityProgressRecord } from '../planning/entities/quantity-progress-record.entity';
import { WoActivityPlan } from '../planning/entities/wo-activity-plan.entity';
import { EpsNode } from '../eps/eps.entity';
import { Activity } from '../wbs/entities/activity.entity';
import { ScheduleVersion } from '../planning/entities/schedule-version.entity';
import { ActivityVersion } from '../planning/entities/activity-version.entity';
import { SnagRound } from '../snag/entities/snag-round.entity';
import { CustomerMilestoneController } from './customer-milestone.controller';
import { CustomerMilestoneService } from './customer-milestone.service';
import { CustomerMilestoneAchievement } from './entities/customer-milestone-achievement.entity';
import { CustomerMilestoneTemplateActivityLink } from './entities/customer-milestone-template-activity-link.entity';
import { CustomerMilestoneTemplate } from './entities/customer-milestone-template.entity';
import { FlatSaleInfo } from './entities/flat-sale-info.entity';
import { MilestoneCollectionTranche } from './entities/milestone-collection-tranche.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomerMilestoneTemplate,
      CustomerMilestoneTemplateActivityLink,
      CustomerMilestoneAchievement,
      FlatSaleInfo,
      MilestoneCollectionTranche,
      QualityFloorStructure,
      QualityUnit,
      QualityInspection,
      WoActivityPlan,
      QuantityProgressRecord,
      SnagRound,
      EpsNode,
      Activity,
      ScheduleVersion,
      ActivityVersion,
    ]),
  ],
  controllers: [CustomerMilestoneController],
  providers: [CustomerMilestoneService],
  exports: [CustomerMilestoneService],
})
export class MilestoneModule {}
