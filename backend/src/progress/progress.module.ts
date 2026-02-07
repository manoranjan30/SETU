import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import { MeasurementProgress } from '../boq/entities/measurement-progress.entity';
import { MeasurementElement } from '../boq/entities/measurement-element.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';
import { BoqActivityPlan } from '../planning/entities/boq-activity-plan.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MeasurementProgress,
      MeasurementElement,
      BoqItem,
      BoqActivityPlan,
    ]),
  ],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}
