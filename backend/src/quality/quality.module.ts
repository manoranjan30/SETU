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
import { QualityFloorStructure } from './entities/quality-floor-structure.entity';
import { QualityUnit } from './entities/quality-unit.entity';
import { QualityRoom } from './entities/quality-room.entity';
import { QualitySnagPhoto } from './entities/quality-snag-photo.entity';
import { QualityWorkflowService } from './quality-workflow.service';
import { EpsNode } from '../eps/eps.entity';
import { ProjectProfile } from '../eps/project-profile.entity';
// NEW: Activity List module
import { QualityActivityList } from './entities/quality-activity-list.entity';
import { QualityActivity } from './entities/quality-activity.entity';
import { QualityActivityService } from './quality-activity.service';
import { QualityActivityController } from './quality-activity.controller';

import { QualityChecklistTemplate } from './entities/quality-checklist-template.entity';
import { QualityStageTemplate } from './entities/quality-stage-template.entity';
import { QualityChecklistItemTemplate } from './entities/quality-checklist-item-template.entity';
import { QualityInspectionStage } from './entities/quality-inspection-stage.entity';
import { QualityExecutionItem } from './entities/quality-execution-item.entity';
import { QualitySignature } from './entities/quality-signature.entity';
import { TempUser } from '../temp-user/entities/temp-user.entity';
import { User } from '../users/user.entity';
import { Vendor } from '../workdoc/entities/vendor.entity';
import { WorkOrder } from '../workdoc/entities/work-order.entity';

import { QualityInspectionService } from './quality-inspection.service';
import { QualityInspectionController } from './quality-inspection.controller';

import { ActivityObservation } from './entities/activity-observation.entity';
import { InspectionApproval } from './entities/inspection-approval.entity';

// Site Observations
import { SiteObservation } from './entities/site-observation.entity';
import { SiteObservationService } from './site-observation.service';
import { SiteObservationController } from './site-observation.controller';

// Sequencer
import { QualitySequenceEdge } from './entities/quality-sequence-edge.entity';
import { QualitySequencerService } from './quality-sequencer.service';
import { QualitySequencerController } from './quality-sequencer.controller';

import { ChecklistTemplateService } from './checklist-template.service';
import { ChecklistExcelParserService } from './checklist-excel-parser.service';
import { ChecklistPdfParserService } from './checklist-pdf-parser.service';
import { ChecklistTemplateController } from './checklist-template.controller';
import { ComplianceService } from './compliance.service';
import { QualityReportService } from './quality-report.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlanningModule } from '../planning/planning.module';
import { CommonModule } from '../common/common.module';

// Workflow Designer
import { ApprovalWorkflowTemplate } from './entities/approval-workflow-template.entity';
import { ApprovalWorkflowNode } from './entities/approval-workflow-node.entity';
import { ApprovalWorkflowEdge } from './entities/approval-workflow-edge.entity';
import { InspectionWorkflowRun } from './entities/inspection-workflow-run.entity';
import { InspectionWorkflowStep } from './entities/inspection-workflow-step.entity';
import { QualityRatingConfig } from './entities/quality-rating-config.entity';
import { ProjectRating } from './entities/quality-project-rating.entity';

import { ApprovalWorkflowService } from './approval-workflow.service';
import { InspectionWorkflowService } from './inspection-workflow.service';
import { ApprovalWorkflowController } from './approval-workflow.controller';
import { UserProjectAssignment } from '../projects/entities/user-project-assignment.entity';
import { AuditModule } from '../audit/audit.module';
import { QualityRatingService } from './quality-rating.service';
import { QualityRatingController } from './quality-rating.controller';

@Module({
  imports: [
    MulterModule.register({ dest: './uploads/quality-csv' }),
    NotificationsModule,
    AuditModule,
    PlanningModule,
    CommonModule,
    TypeOrmModule.forFeature([
      QualityInspection,
      QualityMaterialTest,
      QualityObservationNcr,
      QualityChecklist,
      QualityItem,
      QualityHistory,
      QualityAudit,
      QualityDocument,
      QualityFloorStructure,
      QualityUnit,
      QualityRoom,
      QualitySnagPhoto,
      EpsNode,
      ProjectProfile,
      // NEW
      QualityActivityList,
      QualityActivity,
      QualitySequenceEdge,
      QualityChecklistTemplate,
      QualityStageTemplate,
      QualityChecklistItemTemplate,
      QualityInspectionStage,
      QualityExecutionItem,
      QualitySignature,
      ActivityObservation,
      InspectionApproval,
      SiteObservation,
      // Workflow Designer
      ApprovalWorkflowTemplate,
      ApprovalWorkflowNode,
      ApprovalWorkflowEdge,
      InspectionWorkflowRun,
      InspectionWorkflowStep,
      UserProjectAssignment,
      QualityRatingConfig,
      ProjectRating,
      TempUser,
      User,
      Vendor,
      WorkOrder,
      InspectionWorkflowRun,
    ]),
  ],
  controllers: [
    QualityController,
    QualityActivityController,
    QualityInspectionController,
    QualitySequencerController,
    ChecklistTemplateController,
    ApprovalWorkflowController,
    SiteObservationController,
    QualityRatingController,
  ],
  providers: [
    QualityService,
    QualityStructureService,
    QualityWorkflowService,
    QualityActivityService,
    QualityInspectionService, // Added
    QualitySequencerService,
    ChecklistTemplateService,
    ChecklistExcelParserService,
    ChecklistPdfParserService,
    ComplianceService,
    QualityReportService,
    ApprovalWorkflowService,
    InspectionWorkflowService,
    SiteObservationService,
    QualityRatingService,
  ],
  exports: [
    QualityService,
    QualityStructureService,
    QualityWorkflowService,
    QualityActivityService,
    QualityInspectionService, // Added
    QualitySequencerService,
    QualityReportService,
    ChecklistExcelParserService,
    ChecklistPdfParserService,
    ApprovalWorkflowService,
    InspectionWorkflowService,
    SiteObservationService,
    QualityRatingService,
  ],
})
export class QualityModule {}
