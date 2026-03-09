import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkOrderBoqMap } from './entities/work-order-boq-map.entity';
import { WorkDocService } from './workdoc.service';
import { WorkDocController } from './workdoc.controller';
import { Vendor } from './entities/vendor.entity';
import { WorkOrder } from './entities/work-order.entity';
import { WorkOrderItem } from './entities/work-order-item.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';
import { BoqSubItem } from '../boq/entities/boq-sub-item.entity';
import { MeasurementElement } from '../boq/entities/measurement-element.entity';
import { WorkDocTemplate } from './entities/work-doc-template.entity';
import { BoqModule } from '../boq/boq.module';
import { TempUser } from '../temp-user/entities/temp-user.entity';
import { WoActivityPlan } from '../planning/entities/wo-activity-plan.entity';
import { Activity } from '../wbs/entities/activity.entity';

import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([
      Vendor,
      WorkOrder,
      WorkOrderItem,
      BoqItem,
      BoqSubItem,
      MeasurementElement,
      WorkDocTemplate,
      TempUser,
      WoActivityPlan,
      Activity,
      WorkOrderBoqMap,
    ]),
    forwardRef(() => BoqModule),
  ],
  controllers: [WorkDocController],
  providers: [WorkDocService],
  exports: [WorkDocService],
})
export class WorkDocModule {}
