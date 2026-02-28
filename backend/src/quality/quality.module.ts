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

import { QualityChecklistTemplate } from './entities/quality-checklist-template.entity';
import { QualityStageTemplate } from './entities/quality-stage-template.entity';
import { QualityChecklistItemTemplate } from './entities/quality-checklist-item-template.entity';
import { QualityInspectionStage } from './entities/quality-inspection-stage.entity';
import { QualityExecutionItem } from './entities/quality-execution-item.entity';
import { QualitySignature } from './entities/quality-signature.entity';

import { QualityInspectionService } from './quality-inspection.service';
import { QualityInspectionController } from './quality-inspection.controller';

import { ActivityObservation } from './entities/activity-observation.entity';
import { InspectionApproval } from './entities/inspection-approval.entity';

// Sequencer
import { QualitySequenceEdge } from './entities/quality-sequence-edge.entity';
import { QualitySequencerService } from './quality-sequencer.service';
import { QualitySequencerController } from './quality-sequencer.controller';

import { ChecklistTemplateService } from './checklist-template.service';
import { ChecklistTemplateController } from './checklist-template.controller';
import { ComplianceService } from './compliance.service';
import { QualityReportService } from './quality-report.service';
import { NotificationsModule } from '../notifications/notifications.module';

// Workflow Designer
import { ApprovalWorkflowTemplate } from './entities/approval-workflow-template.entity';
import { ApprovalWorkflowNode } from './entities/approval-workflow-node.entity';
import { ApprovalWorkflowEdge } from './entities/approval-workflow-edge.entity';
import { InspectionWorkflowRun } from './entities/inspection-workflow-run.entity';
import { InspectionWorkflowStep } from './entities/inspection-workflow-step.entity';

import { ApprovalWorkflowService } from './approval-workflow.service';
import { InspectionWorkflowService } from './inspection-workflow.service';
import { ApprovalWorkflowController } from './approval-workflow.controller';
import { UserProjectAssignment } from '../projects/entities/user-project-assignment.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MulterModule.register({ dest: './uploads/quality-csv' }),
    NotificationsModule,
    AuditModule,
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
      QualitySequenceEdge,
      QualityChecklistTemplate,
      QualityStageTemplate,
      QualityChecklistItemTemplate,
      QualityInspectionStage,
      QualityExecutionItem,
      QualitySignature,
      ActivityObservation,
      InspectionApproval,
      // Workflow Designer
      ApprovalWorkflowTemplate,
      ApprovalWorkflowNode,
      ApprovalWorkflowEdge,
      InspectionWorkflowRun,
      InspectionWorkflowStep,
      UserProjectAssignment,
    ]),
  ],
  controllers: [
    QualityController,
    QualityActivityController,
    QualityInspectionController,
    QualitySequencerController,
    ChecklistTemplateController,
    ApprovalWorkflowController,
  ],
  providers: [
    QualityService,
    QualityStructureService,
    QualityWorkflowService,
    QualityActivityService,
    QualityInspectionService, // Added
    QualitySequencerService,
    ChecklistTemplateService,
    ComplianceService,
    QualityReportService,
    ApprovalWorkflowService,
    InspectionWorkflowService,
  ],
  exports: [
    QualityService,
    QualityStructureService,
    QualityWorkflowService,
    QualityActivityService,
    QualityInspectionService, // Added
    QualitySequencerService,
    QualityReportService,
    ApprovalWorkflowService,
    InspectionWorkflowService,
  ],
})
export class QualityModule { }
