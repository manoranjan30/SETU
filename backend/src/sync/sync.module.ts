import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { ExecutionProgressEntry } from '../execution/entities/execution-progress-entry.entity';
import { QualityActivityList } from '../quality/entities/quality-activity-list.entity';
import { QualityActivity } from '../quality/entities/quality-activity.entity';
import { SiteObservation } from '../quality/entities/site-observation.entity';
import { EhsObservation } from '../ehs/entities/ehs-observation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExecutionProgressEntry,
      QualityActivityList,
      QualityActivity,
      SiteObservation,
      EhsObservation,
    ]),
  ],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
