import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExecutionController } from './execution.controller';
import { ExecutionService } from './execution.service';
import { BoqModule } from '../boq/boq.module';
import { Activity } from '../wbs/entities/activity.entity';
import { BoqActivityPlan } from '../planning/entities/boq-activity-plan.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';
import { MeasurementProgress } from '../boq/entities/measurement-progress.entity';
import { MeasurementElement } from '../boq/entities/measurement-element.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Activity,
      BoqActivityPlan,
      BoqItem,
      MeasurementProgress,
      MeasurementElement,
    ]),
    BoqModule,
  ],
  controllers: [ExecutionController],
  providers: [ExecutionService],
})
export class ExecutionModule {}
