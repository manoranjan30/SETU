import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkDocService } from './workdoc.service';
import { WorkDocController } from './workdoc.controller';
import { Vendor } from './entities/vendor.entity';
import { WorkOrder } from './entities/work-order.entity';
import { WorkOrderItem } from './entities/work-order-item.entity';
import { WorkOrderBoqMap } from './entities/work-order-boq-map.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';
import { BoqSubItem } from '../boq/entities/boq-sub-item.entity';
import { WorkDocTemplate } from './entities/work-doc-template.entity';
import { BoqModule } from '../boq/boq.module';

import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([
      Vendor,
      WorkOrder,
      WorkOrderItem,
      WorkOrderBoqMap,
      BoqItem,
      BoqSubItem,
      WorkDocTemplate,
    ]),
    forwardRef(() => BoqModule),
  ],
  controllers: [WorkDocController],
  providers: [WorkDocService],
  exports: [WorkDocService],
})
export class WorkDocModule {}
