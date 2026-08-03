import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QualityFloorStructure } from '../quality/entities/quality-floor-structure.entity';
import { QualityRoom } from '../quality/entities/quality-room.entity';
import { QualityUnit } from '../quality/entities/quality-unit.entity';
import { ProjectProfile } from '../eps/project-profile.entity';
import { User } from '../users/user.entity';
import { MilestoneModule } from '../milestone/milestone.module';
import { PlanningModule } from '../planning/planning.module';
import { SnagController } from './snag.controller';
import { SnagService } from './snag.service';
import { SnagList } from './entities/snag-list.entity';
import { SnagRound } from './entities/snag-round.entity';
import { SnagItem } from './entities/snag-item.entity';
import { SnagPhoto } from './entities/snag-photo.entity';
import { SnagReleaseApproval } from './entities/snag-release-approval.entity';
import { SnagReleaseApprovalStep } from './entities/snag-release-approval-step.entity';
import { SnagProcessStep } from './entities/snag-process-step.entity';
import { SnagProcessActivity } from './entities/snag-process-activity.entity';
import { SnagCommonPoint } from './entities/snag-common-point.entity';
import { SnagRoundLevelClosure } from './entities/snag-round-level-closure.entity';
import { Vendor } from '../workdoc/entities/vendor.entity';
import { WorkOrder } from '../workdoc/entities/work-order.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SnagList,
      SnagRound,
      SnagItem,
      SnagPhoto,
      SnagReleaseApproval,
      SnagReleaseApprovalStep,
      SnagProcessStep,
      SnagProcessActivity,
      SnagCommonPoint,
      SnagRoundLevelClosure,
      QualityFloorStructure,
      QualityUnit,
      QualityRoom,
      ProjectProfile,
      User,
      Vendor,
      WorkOrder,
    ]),
    PlanningModule,
    MilestoneModule,
  ],
  controllers: [SnagController],
  providers: [SnagService],
  exports: [SnagService],
})
export class SnagModule {}
