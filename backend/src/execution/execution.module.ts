import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExecutionController } from './execution.controller';
import { ExecutionService } from './execution.service';
import { ExecutionBreakdownService } from './execution-breakdown.service';
import { ProgressValidationService } from './progress-validation.service';
import { BoqModule } from '../boq/boq.module';
import { MicroScheduleModule } from '../micro-schedule/micro-schedule.module';
import { Activity } from '../wbs/entities/activity.entity';
import { WoActivityPlan } from '../planning/entities/wo-activity-plan.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';
import { MeasurementProgress } from '../boq/entities/measurement-progress.entity';
import { MeasurementElement } from '../boq/entities/measurement-element.entity';
import { MicroScheduleActivity } from '../micro-schedule/entities/micro-schedule-activity.entity';
import { MicroDailyLog } from '../micro-schedule/entities/micro-daily-log.entity';
import { MicroQuantityLedger } from '../micro-schedule/entities/micro-quantity-ledger.entity';
import { EpsNode } from '../eps/eps.entity';
import { WorkOrderItem } from '../workdoc/entities/work-order-item.entity';
import { WorkOrder } from '../workdoc/entities/work-order.entity';
import { Vendor } from '../workdoc/entities/vendor.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Activity,
      WoActivityPlan,
      BoqItem,
      MeasurementProgress,
      MeasurementElement,
      MicroScheduleActivity,
      MicroDailyLog,
      MicroQuantityLedger,
      EpsNode,
      WorkOrderItem,
      WorkOrder,
      Vendor,
    ]),
    BoqModule,
    MicroScheduleModule,
  ],
  controllers: [ExecutionController],
  providers: [
    ExecutionService,
    ExecutionBreakdownService,
    ProgressValidationService,
  ],
})
export class ExecutionModule {}
