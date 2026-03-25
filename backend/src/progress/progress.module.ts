import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import { MeasurementProgress } from '../boq/entities/measurement-progress.entity';
import { MeasurementElement } from '../boq/entities/measurement-element.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';
import { BoqSubItem } from '../boq/entities/boq-sub-item.entity';
import { WoActivityPlan } from '../planning/entities/wo-activity-plan.entity';
import { WorkOrderItem } from '../workdoc/entities/work-order-item.entity';
import { ExecutionProgressEntry } from '../execution/entities/execution-progress-entry.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MeasurementProgress,
      MeasurementElement,
      BoqItem,
      BoqSubItem,
      WoActivityPlan,
      WorkOrderItem,
      ExecutionProgressEntry,
    ]),
  ],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}
