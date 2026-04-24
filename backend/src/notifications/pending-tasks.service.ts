import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import {
  QualityInspection,
  InspectionStatus,
} from '../quality/entities/quality-inspection.entity';
import {
  InspectionWorkflowStep,
  WorkflowStepStatus,
} from '../quality/entities/inspection-workflow-step.entity';
import {
  ActivityObservation,
  ActivityObservationStatus,
} from '../quality/entities/activity-observation.entity';
import { QualityMaterialApprovalStep } from '../quality/entities/quality-material-approval-step.entity';
import { QualityMaterialTestObligation } from '../quality/entities/quality-material-test-obligation.entity';
import {
  AssignmentStatus,
  UserProjectAssignment,
} from '../projects/entities/user-project-assignment.entity';
import { TempUser } from '../temp-user/entities/temp-user.entity';

@Injectable()
export class PendingTasksService {
  constructor(
    @InjectRepository(QualityInspection)
    private readonly inspectionRepo: Repository<QualityInspection>,
    @InjectRepository(InspectionWorkflowStep)
    private readonly stepRepo: Repository<InspectionWorkflowStep>,
    @InjectRepository(ActivityObservation)
    private readonly obsRepo: Repository<ActivityObservation>,
    @InjectRepository(QualityMaterialApprovalStep)
    private readonly materialApprovalStepRepo: Repository<QualityMaterialApprovalStep>,
    @InjectRepository(QualityMaterialTestObligation)
    private readonly materialObligationRepo: Repository<QualityMaterialTestObligation>,
    @InjectRepository(UserProjectAssignment)
    private readonly assignmentRepo: Repository<UserProjectAssignment>,
    @InjectRepository(TempUser)
    private readonly tempUserRepo: Repository<TempUser>,
  ) {}

  async getPendingTasks(userId: number, projectId?: number) {
    // 1. RFIs pending my approval (Workflow steps assigned to me)
    const candidatePendingRFIs = await this.stepRepo.find({
      where: {
        status: WorkflowStepStatus.PENDING,
        ...(projectId ? { run: { inspection: { projectId } } } : {}),
      },
      relations: [
        'run',
        'run.inspection',
        'run.inspection.activity',
        'workflowNode',
      ],
    });
    const pendingRFIs = candidatePendingRFIs.filter((step) => {
      const assignedUserIds = step.assignedUserIds?.length
        ? step.assignedUserIds
        : step.assignedUserId
          ? [step.assignedUserId]
          : [];
      return assignedUserIds.includes(userId);
    });

    // 2. RFIs raised by me that are still pending
    const raisedRFIs = await this.inspectionRepo.find({
      where: {
        requestedById: userId,
        status: Not(In([InspectionStatus.APPROVED, InspectionStatus.CANCELED])),
        ...(projectId ? { projectId } : {}),
      },
      relations: ['activity'],
    });

    // 3. Observations raised by me that are RECTIFIED (need closing)
    const observationsToClose = await this.obsRepo.find({
      where: {
        inspectorId: String(userId),
        status: ActivityObservationStatus.RECTIFIED,
        ...(projectId ? { inspection: { projectId } } : {}),
      },
      relations: ['activity', 'inspection'],
    });

    // 4. Observations pending my rectification (Vendor check)
    const tempUser = await this.tempUserRepo.findOneBy({ userId });
    let vendorObservations: ActivityObservation[] = [];
    if (tempUser?.vendorId) {
      vendorObservations = await this.obsRepo.find({
        where: {
          inspection: { vendorId: tempUser.vendorId },
          status: ActivityObservationStatus.PENDING,
          ...(projectId ? { inspection: { projectId } } : {}),
        },
        relations: ['activity', 'inspection'],
      });
    }

    const projectRoleIds = await this.getProjectRoleIds(userId, projectId);
    const candidateMaterialApprovalSteps =
      await this.materialApprovalStepRepo.find({
        where: {
          status: 'PENDING',
          ...(projectId ? { run: { projectId } } : {}),
        },
        relations: ['run'],
      });
    const materialApprovalSteps = candidateMaterialApprovalSteps.filter((step) => {
      const assignedUserIds = step.assignedUserIds?.length
        ? step.assignedUserIds
        : step.assignedUserId
          ? [step.assignedUserId]
          : [];
      if (assignedUserIds.includes(userId)) return true;
      return Boolean(
        step.assignedRoleId && projectRoleIds.includes(step.assignedRoleId),
      );
    });

    const materialTestAlerts = await this.materialObligationRepo.find({
      where: {
        status: In(['DUE_SOON', 'OVERDUE']),
        ...(projectId ? { projectId } : {}),
      },
      relations: ['checkpoint', 'receipt'],
      order: { dueDate: 'ASC' },
    });

    const items = [
      ...pendingRFIs.map((s) => ({
        type: 'RFI_APPROVAL',
        id: s.run.inspectionId,
        title: `RFI Approval: ${s.run.inspection.activity?.activityName}`,
        subtitle: s.workflowNode?.label,
        date: s.run.inspection.createdAt,
      })),
      ...raisedRFIs.map((i) => ({
        type: 'RFI_RAISED',
        id: i.id,
        title: `My RFI: ${i.activity?.activityName}`,
        subtitle: i.status,
        date: i.createdAt,
      })),
      ...observationsToClose.map((o) => ({
        type: 'OBS_CLOSE',
        id: o.id,
        title: `Observation Closure Needed`,
        subtitle: o.observationText,
        date: o.createdAt,
      })),
      ...vendorObservations.map((o) => ({
        type: 'OBS_RECTIFY',
        id: o.id,
        title: `Observation Rectification Needed`,
        subtitle: o.observationText,
        date: o.createdAt,
      })),
      ...materialApprovalSteps.map((step) => ({
        type:
          step.run.documentType === 'MATERIAL_ITP_TEMPLATE'
            ? 'MATERIAL_ITP_APPROVAL'
            : 'MATERIAL_TEST_APPROVAL',
        id: step.run.documentId,
        title:
          step.run.documentType === 'MATERIAL_ITP_TEMPLATE'
            ? 'Material ITP Approval Needed'
            : 'Material Test Result Approval Needed',
        subtitle: step.stepName || step.run.strategyName,
        date: step.createdAt,
      })),
      ...materialTestAlerts.map((obligation) => ({
        type: 'MATERIAL_TEST_DUE',
        id: obligation.id,
        title:
          obligation.status === 'OVERDUE'
            ? 'Material Test Overdue'
            : 'Material Test Expiring Soon',
        subtitle:
          obligation.checkpoint?.characteristic || obligation.materialName,
        date: obligation.dueDate || obligation.createdAt,
      })),
    ];

    return {
      approvalsCount: pendingRFIs.length + materialApprovalSteps.length,
      raisedRFIsCount: raisedRFIs.length,
      obsToCloseCount: observationsToClose.length,
      vendorObsCount: vendorObservations.length,
      materialApprovalCount: materialApprovalSteps.length,
      materialTestAlertCount: materialTestAlerts.length,
      totalCount: items.length,
      items: items.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    };
  }

  private async getProjectRoleIds(userId: number, projectId?: number) {
    const assignments = await this.assignmentRepo.find({
      where: {
        user: { id: userId },
        status: AssignmentStatus.ACTIVE,
        ...(projectId ? { project: { id: projectId } } : {}),
      },
      relations: ['roles', 'project'],
    });
    return Array.from(
      new Set(
        assignments.flatMap((assignment) =>
          (assignment.roles || []).map((role) => role.id),
        ),
      ),
    );
  }
}
