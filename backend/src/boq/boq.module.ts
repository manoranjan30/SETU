import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BoqElement } from './entities/boq-element.entity';
import { BoqItem } from './entities/boq-item.entity';
import { MeasurementElement } from './entities/measurement-element.entity';
import { MeasurementProgress } from './entities/measurement-progress.entity';
import { EpsNode } from '../eps/eps.entity';
import { BoqService } from './boq.service';
import { BoqController } from './boq.controller';
import { BoqImportService } from './boq-import.service';

import { BoqSubItem } from './entities/boq-sub-item.entity';

import { AuditModule } from '../audit/audit.module';
import { PlanningModule } from '../planning/planning.module';
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BoqElement,
      EpsNode,
      BoqItem,
      BoqSubItem,
      MeasurementElement,
      MeasurementProgress,
    ]),
    AuditModule,
    forwardRef(() => PlanningModule),
  ],
  controllers: [BoqController],
  providers: [BoqService, BoqImportService],
  exports: [BoqService],
})
export class BoqModule {}
