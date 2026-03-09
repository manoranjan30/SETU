import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanningController } from './planning.controller';
import { PlanningService } from './planning.service';
import { WoActivityPlan } from './entities/wo-activity-plan.entity';
import { RecoveryPlan } from './entities/recovery-plan.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';
import { Activity } from '../wbs/entities/activity.entity';
import { QuantityProgressRecord } from './entities/quantity-progress-record.entity';
import { BoqSubItem } from '../boq/entities/boq-sub-item.entity';
import { MeasurementElement } from '../boq/entities/measurement-element.entity';
import { MeasurementProgress } from '../boq/entities/measurement-progress.entity';
import { EpsNode } from '../eps/eps.entity';
import { WbsNode } from '../wbs/entities/wbs.entity';
import { ScheduleVersion } from './entities/schedule-version.entity';
import { ActivityRelationship } from '../wbs/entities/activity-relationship.entity';
import { WbsModule } from '../wbs/wbs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivityVersion } from './entities/activity-version.entity';
import { ScheduleVersionService } from './schedule-version.service';
import { SchedulingEngineService } from './scheduling-engine.service';
import { ImportExportService } from './import-export.service';
import { WorkOrderItem } from '../workdoc/entities/work-order-item.entity';
import { WorkOrder } from '../workdoc/entities/work-order.entity';
import { Vendor } from '../workdoc/entities/vendor.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WoActivityPlan,
      RecoveryPlan,
      QuantityProgressRecord,
      BoqItem,
      Activity,
      ActivityRelationship,
      BoqSubItem,
      MeasurementElement,
      MeasurementProgress,
      WbsNode,
      EpsNode,
      ScheduleVersion,
      ActivityVersion,
      WorkOrderItem,
      WorkOrder,
      Vendor,
    ]),
    WbsModule,
    NotificationsModule,
  ],
  controllers: [PlanningController],
  providers: [
    PlanningService,
    ScheduleVersionService,
    ImportExportService,
    SchedulingEngineService,
  ],
  exports: [PlanningService, ScheduleVersionService],
})
export class PlanningModule {}
