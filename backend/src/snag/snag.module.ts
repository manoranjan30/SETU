import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QualityFloorStructure } from '../quality/entities/quality-floor-structure.entity';
import { QualityRoom } from '../quality/entities/quality-room.entity';
import { QualityUnit } from '../quality/entities/quality-unit.entity';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SnagList,
      SnagRound,
      SnagItem,
      SnagPhoto,
      SnagReleaseApproval,
      SnagReleaseApprovalStep,
      QualityFloorStructure,
      QualityUnit,
      QualityRoom,
    ]),
    PlanningModule,
    MilestoneModule,
  ],
  controllers: [SnagController],
  providers: [SnagService],
  exports: [SnagService],
})
export class SnagModule {}
