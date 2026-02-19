import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExecutionController } from './execution.controller';
import { ExecutionService } from './execution.service';
import { ExecutionBreakdownService } from './execution-breakdown.service';
import { ProgressValidationService } from './progress-validation.service';
import { BoqModule } from '../boq/boq.module';
import { Activity } from '../wbs/entities/activity.entity';
import { BoqActivityPlan } from '../planning/entities/boq-activity-plan.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';
import { MeasurementProgress } from '../boq/entities/measurement-progress.entity';
import { MeasurementElement } from '../boq/entities/measurement-element.entity';
import { MicroScheduleActivity } from '../micro-schedule/entities/micro-schedule-activity.entity';
import { MicroDailyLog } from '../micro-schedule/entities/micro-daily-log.entity';
import { MicroQuantityLedger } from '../micro-schedule/entities/micro-quantity-ledger.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Activity,
      BoqActivityPlan,
      BoqItem,
      MeasurementProgress,
      MeasurementElement,
      MicroScheduleActivity,
      MicroDailyLog,
      MicroQuantityLedger,
    ]),
    BoqModule,
  ],
  controllers: [ExecutionController],
  providers: [
    ExecutionService,
    ExecutionBreakdownService,
    ProgressValidationService,
  ],
})
export class ExecutionModule {}
