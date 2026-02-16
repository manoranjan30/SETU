import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkDocService } from './workdoc.service';
import { WorkDocController } from './workdoc.controller';
import { Vendor } from './entities/vendor.entity';
import { WorkOrder } from './entities/work-order.entity';
import { WorkOrderItem } from './entities/work-order-item.entity';
import { WorkOrderBoqMap } from './entities/work-order-boq-map.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';
import { WorkDocTemplate } from './entities/work-doc-template.entity';

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
      WorkDocTemplate,
    ]),
  ],
  controllers: [WorkDocController],
  providers: [WorkDocService],
  exports: [WorkDocService],
})
export class WorkDocModule {}
