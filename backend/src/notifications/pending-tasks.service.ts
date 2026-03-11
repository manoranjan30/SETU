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
    @InjectRepository(TempUser)
    private readonly tempUserRepo: Repository<TempUser>,
  ) {}

  async getPendingTasks(userId: number, projectId?: number) {
    // 1. RFIs pending my approval (Workflow steps assigned to me)
    const pendingRFIs = await this.stepRepo.find({
      where: {
        assignedUserId: userId,
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
    ];

    return {
      approvalsCount: pendingRFIs.length,
      raisedRFIsCount: raisedRFIs.length,
      obsToCloseCount: observationsToClose.length,
      vendorObsCount: vendorObservations.length,
      totalCount: items.length,
      items: items.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    };
  }
}
