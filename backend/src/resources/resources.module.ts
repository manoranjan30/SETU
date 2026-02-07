import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';
import { ResourceMaster } from './entities/resource-master.entity';
import { AnalysisTemplate } from './entities/analysis-template.entity';
import { AnalysisCoefficient } from './entities/analysis-coefficient.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ResourceMaster,
      AnalysisTemplate,
      AnalysisCoefficient,
      BoqItem,
    ]),
  ],
  controllers: [ResourcesController],
  providers: [ResourcesService],
  exports: [ResourcesService],
})
export class ResourcesModule {}
