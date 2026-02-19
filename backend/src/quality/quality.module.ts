import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
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
// NEW: Activity List module
import { QualityActivityList } from './entities/quality-activity-list.entity';
import { QualityActivity } from './entities/quality-activity.entity';
import { QualityActivityService } from './quality-activity.service';
import { QualityActivityController } from './quality-activity.controller';

import { QualityInspectionService } from './quality-inspection.service';
import { QualityInspectionController } from './quality-inspection.controller';

@Module({
  imports: [
    MulterModule.register({ dest: './uploads/quality-csv' }),
    TypeOrmModule.forFeature([
      QualityInspection,
      QualityMaterialTest,
      QualityObservationNcr,
      QualityChecklist,
      QualityItem,
      QualityHistory,
      QualityAudit,
      QualityDocument,
      QualityUnitTemplate,
      QualitySnagPhoto,
      EpsNode,
      // NEW
      QualityActivityList,
      QualityActivity,
    ]),
  ],
  controllers: [
    QualityController,
    QualityActivityController,
    QualityInspectionController,
  ],
  providers: [
    QualityService,
    QualityStructureService,
    QualityWorkflowService,
    QualityActivityService,
    QualityInspectionService, // Added
  ],
  exports: [
    QualityService,
    QualityStructureService,
    QualityWorkflowService,
    QualityActivityService,
    QualityInspectionService, // Added
  ],
})
export class QualityModule {}
