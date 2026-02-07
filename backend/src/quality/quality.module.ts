import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QualityService } from './quality.service';
import { QualityController } from './quality.controller';
import { QualityInspection } from './entities/quality-inspection.entity';
import { QualityMaterialTest } from './entities/quality-material-test.entity';
import { QualityObservationNcr } from './entities/quality-observation-ncr.entity';
import { QualityChecklist } from './entities/quality-checklist.entity';
import { QualitySnagList } from './entities/quality-snag-list.entity';
import { QualityAudit } from './entities/quality-audit.entity';
import { QualityDocument } from './entities/quality-document.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      QualityInspection,
      QualityMaterialTest,
      QualityObservationNcr,
      QualityChecklist,
      QualitySnagList,
      QualityAudit,
      QualityDocument,
    ]),
  ],
  controllers: [QualityController],
  providers: [QualityService],
  exports: [QualityService],
})
export class QualityModule {}
