import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QualityService } from './quality.service';
import { QualityStructureService } from './quality-structure.service';
import { QualityController } from './quality.controller';
import { QualityInspection } from './entities/quality-inspection.entity';
import { QualityMaterialTest } from './entities/quality-material-test.entity';
import { QualityObservationNcr } from './entities/quality-observation-ncr.entity';
import { QualityChecklist } from './entities/quality-checklist.entity';
import { QualityItem } from './entities/quality-item.entity';
import { QualityHistory } from './entities/quality-history.entity';
import { QualityAudit } from './entities/quality-audit.entity';
import { QualityDocument } from './entities/quality-document.entity';
import { QualityUnitTemplate } from './entities/quality-unit-template.entity';
import { QualitySnagPhoto } from './entities/quality-snag-photo.entity';
import { QualityWorkflowService } from './quality-workflow.service';
import { EpsNode } from '../eps/eps.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      QualityInspection,
      QualityMaterialTest,
      QualityObservationNcr,
      QualityChecklist,
      QualityChecklist,
      QualityItem,
      QualityHistory,
      QualityAudit,
      QualityDocument,
      QualityUnitTemplate,
      QualitySnagPhoto,
      EpsNode,
      EpsNode,
    ]),
  ],
  controllers: [QualityController],
  providers: [QualityService, QualityStructureService, QualityWorkflowService],
  exports: [QualityService, QualityStructureService, QualityWorkflowService],
})
export class QualityModule { }
