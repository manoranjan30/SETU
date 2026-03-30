import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import {
  InspectionWorkflowRun,
  WorkflowRunStatus,
} from './entities/inspection-workflow-run.entity';
import {
  InspectionWorkflowStep,
  WorkflowStepStatus,
} from './entities/inspection-workflow-step.entity';
import {
  UserProjectAssignment,
  AssignmentStatus,
} from '../projects/entities/user-project-assignment.entity';
import { QualitySignature } from './entities/quality-signature.entity';
import {
  QualityInspection,
  InspectionStatus,
} from './entities/quality-inspection.entity';
import { AuditService } from '../audit/audit.service';
import { PushNotificationService } from '../notifications/push-notification.service';
import { NotificationComposerService } from '../notifications/notification-composer.service';
import { ReleaseStrategyService } from '../planning/release-strategy.service';
import { StageStatus } from './entities/quality-inspection-stage.entity';
import { RestartPolicy } from '../planning/entities/release-strategy.entity';
import { ApprovalRuntimeService, ProjectApprovalActor } from '../common/approval-runtime.service';

@Injectable()
export class InspectionWorkflowService {
  constructor(
    @InjectRepository(InspectionWorkflowRun)
    private readonly runRepo: Repository<InspectionWorkflowRun>,
    @InjectRepository(InspectionWorkflowStep)
    private readonly stepRepo: Repository<InspectionWorkflowStep>,
    @InjectRepository(UserProjectAssignment)
    private readonly assignmentRepo: Repository<UserProjectAssignment>,
    @InjectRepository(QualitySignature)
    private readonly signatureRepo: Repository<QualitySignature>,
    @InjectRepository(QualityInspection)
    private readonly inspectionRepo: Repository<QualityInspection>,
    private readonly releaseStrategyService: ReleaseStrategyService,
    private readonly auditService: AuditService,
    private readonly pushService: PushNotificationService,
    private readonly notificationComposer: NotificationComposerService,
    private readonly approvalRuntimeService: ApprovalRuntimeService,
  ) {}

  private generateSignatureHash(
    signatureData: string,
    userId: number,
    timestamp: Date,
  ): string {
    const payload = `${signatureData}|${userId}|${timestamp.toISOString()}`;
    return createHash('sha256').update(payload).digest('hex');
  }

  private async getInspectionOrThrow(inspectionId: number) {
    const inspection = await this.inspectionRepo.findOne({
      where: { id: inspectionId },
      relations: ['stages', 'stages.stageTemplate', 'activity'],
    });
    if (!inspection) {
      throw new NotFoundException('Inspection not found');
    }
    return inspection;
  }

  private async getActorMap(projectId: number): Promise<Map<number, ProjectApprovalActor>> {
    return this.approvalRuntimeService.getProjectActorMap(projectId);
  }

  private buildApprovalContext(inspection: QualityInspection) {
    return {
      projectId: inspection.projectId,
      moduleCode: 'QUALITY',
      processCode: inspection.processCode || 'QA_QC_APPROVAL',
      documentType: inspection.documentType || null,
      documentId: inspection.id,
      initiatorUserId: inspection.requestedById ?? null,
      epsNodeId: inspection.epsNodeId ?? null,
      vendorId: inspection.vendorId ?? null,
      extraAttributes: {
        activityId: inspection.activityId,
        listId: inspection.listId,
        partNo: inspection.partNo,
        totalParts: inspection.totalParts,
      },
    };
  }

  private async notifyStep(
    inspection: QualityInspection,
    step: InspectionWorkflowStep | undefined | null,
    levelLabel?: string | null,
    stageName?: string | null,
  ) {
    if (!step) return;
    const notification =
      await this.notificationComposer.composeInspectionApprovalRequired({
        projectId: inspection.projectId,
        epsNodeId: inspection.epsNodeId,
        activityLabel: inspection.activity?.activityName || null,
        subjectLabel: `RFI #${inspection.id}`,
        inspectionId: inspection.id,
        levelLabel: levelLabel || null,
        stageName: stageName || null,
      });
    if (step.assignedRoleId) {
      this.pushService
        .sendToProjectRole(
          inspection.projectId,
          step.assignedRoleId,
          notification.title,
          notification.body,
          {
            inspectionId: String(inspection.id),
            ...notification.data,
          },
        )
        .catch(() => {
          /* non-fatal */
        })
      return;
    }

    const assignedUserIds = step.assignedUserIds?.length
      ? step.assignedUserIds
      : step.assignedUserId
        ? [step.assignedUserId]
        : [];

    if (assignedUserIds.length > 0) {
      this.pushService
        .sendToUsers(assignedUserIds, notification.title, notification.body, {
          inspectionId: String(inspection.id),
          ...notification.data,
        })
        .catch(() => {
          /* non-fatal */
        });
    }
  }

  private async getRestartPolicy(
    inspection: QualityInspection,
    run: InspectionWorkflowRun,
  ): Promise<RestartPolicy> {
    if (!run.releaseStrategyId) {
      return RestartPolicy.RESTART_FROM_LEVEL_1;
    }

    try {
      const strategy = await this.releaseStrategyService.getStrategy(
        inspection.projectId,
        run.releaseStrategyId,
      );
      return strategy.restartPolicy || RestartPolicy.RESTART_FROM_LEVEL_1;
    } catch {
      return RestartPolicy.RESTART_FROM_LEVEL_1;
    }
  }

  private async assertUserCanApproveStep(
    inspection: QualityInspection,
    step: InspectionWorkflowStep,
    userId: number,
    isAdmin: boolean,
  ) {
    if (isAdmin) return;

    const assignedUserIds = step.assignedUserIds?.length
      ? step.assignedUserIds
      : step.assignedUserId
        ? [step.assignedUserId]
        : [];

    if (assignedUserIds.includes(userId)) {
      return;
    }

    if (step.assignedRoleId) {
      const projectRoleIds = await this.approvalRuntimeService.getProjectRoleIds(
        inspection.projectId,
        userId,
      );
      if (projectRoleIds.includes(step.assignedRoleId)) {
        return;
      }
    }

    throw new ForbiddenException(
      'You are not allowed to approve this workflow step',
    );
  }

  async assertUserCanApproveInspectionStep(
    inspectionId: number,
    userId: number,
    isAdmin: boolean,
    stepOrder?: number,
  ) {
    let run = await this.runRepo.findOne({
      where: { inspectionId },
      relations: ['inspection', 'steps'],
    });

    if (!run) {
      const inspection = await this.getInspectionOrThrow(inspectionId);
      await this.startWorkflowForInspection(
        inspectionId,
        inspection.listId,
        inspection.projectId,
        inspection.requestedById || userId,
      );

      run = await this.runRepo.findOne({
        where: { inspectionId },
        relations: ['inspection', 'steps'],
      });
    }

    if (!run) {
      throw new NotFoundException('Workflow is not configured for this inspection');
    }

    const targetOrder = stepOrder ?? run.currentStepOrder;
    const targetStep = run.steps.find((step) => step.stepOrder === targetOrder);

    if (!targetStep) {
      throw new NotFoundException('Workflow step not found');
    }

    await this.assertUserCanApproveStep(run.inspection, targetStep, userId, isAdmin);
    return targetStep;
  }

  async getOrStartWorkflowState(
    inspectionId: number,
    userId?: number,
  ): Promise<InspectionWorkflowRun | null> {
    let run = await this.runRepo.findOne({
      where: { inspectionId },
      relations: ['inspection', 'steps', 'steps.signature'],
      order: { steps: { stepOrder: 'ASC' } },
    });

    if (!run) {
      const inspection = await this.getInspectionOrThrow(inspectionId);
      await this.startWorkflowForInspection(
        inspectionId,
        inspection.listId,
        inspection.projectId,
        inspection.requestedById || userId || 1,
      );
      run = await this.runRepo.findOne({
        where: { inspectionId },
        relations: ['inspection', 'steps', 'steps.signature'],
        order: { steps: { stepOrder: 'ASC' } },
      });
    }

    return run;
  }

  async getEligibleApprovalStepsForUser(
    inspectionId: number,
    userId: number,
    isAdmin: boolean,
  ): Promise<InspectionWorkflowStep[]> {
    const run = await this.getOrStartWorkflowState(inspectionId, userId);
    if (!run) {
      throw new NotFoundException('Workflow is not configured for this inspection');
    }

    const inspection = run.inspection || (await this.getInspectionOrThrow(inspectionId));
    if (isAdmin) {
      return [...(run.steps || [])].sort((a, b) => a.stepOrder - b.stepOrder);
    }

    const eligibleSteps: InspectionWorkflowStep[] = [];
    for (const step of run.steps || []) {
      try {
        await this.assertUserCanApproveStep(inspection, step, userId, false);
        eligibleSteps.push(step);
      } catch {
        // not eligible for this step
      }
    }
    return eligibleSteps.sort((a, b) => a.stepOrder - b.stepOrder);
  }

  async startWorkflowForInspection(
    inspectionId: number,
    listId: number,
    projectId: number,
    raiserUserId: number,
  ): Promise<InspectionWorkflowRun | null> {
    const inspection = await this.getInspectionOrThrow(inspectionId);
    const processCandidates: string[] = Array.from(
      new Set(
        [
          'QA_QC_APPROVAL',
          inspection.processCode,
          'INSPECTION_APPROVAL',
          'RFI_APPROVAL',
        ].filter((value): value is string => Boolean(value)),
      ),
    );

    let resolved: Awaited<
      ReturnType<typeof this.releaseStrategyService.resolveStrategy>
    > | null = null;
    let matchedProcessCode: string | null = null;

    for (const processCode of processCandidates) {
      const context = {
        ...this.buildApprovalContext(inspection),
        processCode,
      };
      const candidate = await this.releaseStrategyService.resolveStrategy(
        projectId,
        context,
      );
      if (candidate?.matchedStrategy?.resolvedSteps?.length) {
        resolved = candidate;
        matchedProcessCode = processCode;
        break;
      }
    }

    if (!resolved?.matchedStrategy?.resolvedSteps?.length) {
      return null;
    }

    if (matchedProcessCode && inspection.processCode !== matchedProcessCode) {
      inspection.processCode = matchedProcessCode;
      await this.inspectionRepo.save(inspection);
    }

    const actorMap = await this.getActorMap(projectId);
    const stepsPayload = [...resolved.matchedStrategy.resolvedSteps].sort(
      (a, b) => a.levelNo - b.levelNo,
    );
    const firstStep = stepsPayload[0];
    const raiserActor = actorMap.get(raiserUserId);
    const now = new Date();

    const run = await this.runRepo.save(
      this.runRepo.create({
        inspectionId,
        workflowTemplateId: null,
        releaseStrategyId: resolved.matchedStrategy.id,
        releaseStrategyVersion: resolved.matchedStrategy.version ?? null,
        strategyName: resolved.matchedStrategy.name,
        moduleCode: resolved.matchedStrategy.moduleCode,
        processCode: resolved.matchedStrategy.processCode,
        documentType: resolved.matchedStrategy.documentType || null,
        currentStepOrder: firstStep.levelNo,
        status: WorkflowRunStatus.IN_PROGRESS,
      }),
    );

    const stepEntities = stepsPayload.map((step, index) => {
      const primaryActor = step.approvers?.[0] || null;
      const isFirst = index === 0;
      return this.stepRepo.create({
        runId: run.id,
        workflowNodeId: null,
        stepOrder: step.levelNo,
        assignedUserId:
          step.approverMode === 'USER'
            ? step.userIds?.[0] || step.userId || null
            : null,
        assignedUserIds:
          step.approverMode === 'USER'
            ? step.userIds?.length
              ? step.userIds
              : step.userId
                ? [step.userId]
                : []
            : null,
        assignedRoleId: step.roleId || null,
        stepName: step.stepName,
        approverMode: step.approverMode,
        canDelegate: Boolean(step.canDelegate),
        minApprovalsRequired: step.minApprovalsRequired ?? 1,
        currentApprovalCount: 0,
        approvedUserIds: [],
        status: isFirst ? WorkflowStepStatus.PENDING : WorkflowStepStatus.WAITING,
        signerDisplayName: null,
        signerCompany: null,
        signerRole: null,
      });
    });

    await this.stepRepo.save(stepEntities);

    if (raiserActor) {
      await this.auditService.log(
        raiserUserId,
        'QUALITY',
        'START_RELEASE_STRATEGY_WORKFLOW',
        String(inspectionId),
        inspection.epsNodeId,
        {
          listId,
          strategyId: run.releaseStrategyId,
          strategyVersion: run.releaseStrategyVersion,
          strategyName: run.strategyName,
          raiser: raiserActor.displayName,
        },
      );
    }

    await this.notifyStep(inspection, stepEntities[0], 'Level 1');

    return this.getWorkflowState(inspectionId);
  }

  async getWorkflowState(
    inspectionId: number,
  ): Promise<InspectionWorkflowRun | null> {
    return this.runRepo.findOne({
      where: { inspectionId },
      relations: ['steps', 'steps.signature', 'workflowTemplate'],
      order: {
        steps: {
          stepOrder: 'ASC',
        },
      },
    });
  }

  async getEligibleApprovers(projectId: number) {
    return this.approvalRuntimeService.getEligibleApproverOptions(projectId);
  }

  async advanceWorkflow(
    inspectionId: number,
    userId: number,
    signatureId: number,
    signedByName: string,
    comments?: string,
    signatureData?: string,
    isAdmin: boolean = false,
  ): Promise<{ run: InspectionWorkflowRun; isFinal: boolean }> {
    const run = await this.getWorkflowState(inspectionId);
    if (!run) {
      throw new NotFoundException('Workflow run not found');
    }
    if (run.status !== WorkflowRunStatus.IN_PROGRESS) {
      throw new BadRequestException('Workflow is not in progress');
    }

    const inspection = await this.getInspectionOrThrow(inspectionId);
    if (inspection.isLocked && !isAdmin) {
      throw new ForbiddenException(
        'This inspection is locked after approval. Only admin can modify it.',
      );
    }

    const currentStep = run.steps.find(
      (step) => step.stepOrder === run.currentStepOrder,
    );
    if (!currentStep) {
      throw new NotFoundException('Current workflow step not found');
    }

    if (
      currentStep.status !== WorkflowStepStatus.PENDING &&
      currentStep.status !== WorkflowStepStatus.IN_PROGRESS
    ) {
      throw new BadRequestException('This workflow step is not open for approval');
    }

    await this.assertUserCanApproveStep(inspection, currentStep, userId, isAdmin);

    let effectiveSignatureId = signatureId;
    const now = new Date();
    const actorMap = await this.getActorMap(inspection.projectId);
    const actor = actorMap.get(userId);

    if (!effectiveSignatureId && !signatureData) {
      throw new BadRequestException(
        'A digital signature is required to approve this workflow step.',
      );
    }

    const existingApprovals = await this.signatureRepo.count({
      where: {
        workflowStepId: currentStep.id,
        signedByUserId: userId,
        isReversed: false,
      } as any,
    });
    if (existingApprovals > 0) {
      throw new BadRequestException(
        'You have already approved this workflow level.',
      );
    }

    if (!effectiveSignatureId && signatureData) {
      const signatureHash = this.generateSignatureHash(signatureData, userId, now);
      const sig = this.signatureRepo.create({
        inspectionId,
        workflowStepId: currentStep.id,
        userId,
        signedByUserId: userId,
        actionType: 'FINAL_APPROVE',
        role: actor?.primaryRoleLabel || currentStep.stepName || 'Approver',
        signedBy: signedByName,
        signerDisplayName: actor?.displayName || signedByName,
        signerCompany: actor?.companyLabel || 'Internal Team',
        signerRoleLabel:
          actor?.primaryRoleLabel || actor?.projectRoleNames?.[0] || currentStep.stepName,
        sourceType: actor?.sourceType || 'PERMANENT',
        signatureData,
        lockHash: signatureHash,
        metadata: {
          timestamp: now,
        },
      });
      const savedSig = await this.signatureRepo.save(sig);
      effectiveSignatureId = savedSig.id;
    }

    currentStep.status = WorkflowStepStatus.COMPLETED;
    currentStep.signatureId =
      effectiveSignatureId && effectiveSignatureId > 0 ? effectiveSignatureId : null;
    currentStep.signedBy = signedByName;
    currentStep.signerDisplayName = actor?.displayName || signedByName;
    currentStep.signerCompany = actor?.companyLabel || 'Internal Team';
    currentStep.signerRole =
      actor?.primaryRoleLabel || actor?.projectRoleNames?.[0] || currentStep.stepName;
    const approvedUserIds = Array.from(
      new Set([...(currentStep.approvedUserIds || []), userId]),
    );
    currentStep.approvedUserIds = approvedUserIds;
    currentStep.currentApprovalCount = approvedUserIds.length;
    currentStep.comments = comments || currentStep.comments || '';

    const requiredApprovals = Math.max(1, currentStep.minApprovalsRequired || 1);
    const stepSatisfied = currentStep.currentApprovalCount >= requiredApprovals;

    if (!stepSatisfied) {
      currentStep.status = WorkflowStepStatus.IN_PROGRESS;
      currentStep.completedAt = null;
      await this.stepRepo.save(currentStep);
      const savedRun = await this.runRepo.save(run);
      return { run: savedRun, isFinal: false };
    }

    currentStep.status = WorkflowStepStatus.COMPLETED;
    currentStep.completedAt = now;
    await this.stepRepo.save(currentStep);

    const nextStep = run.steps.find(
      (step) => step.stepOrder === run.currentStepOrder + 1,
    );
    let isFinal = false;

    if (nextStep) {
      nextStep.status = WorkflowStepStatus.PENDING;
      await this.stepRepo.save(nextStep);
      run.currentStepOrder = nextStep.stepOrder;

      if (
        inspection.status === InspectionStatus.PENDING ||
        inspection.status === InspectionStatus.PARTIALLY_APPROVED
      ) {
        inspection.status = InspectionStatus.PARTIALLY_APPROVED;
        await this.inspectionRepo.save(inspection);
      }

      await this.notifyStep(
        inspection,
        nextStep,
        `Level ${nextStep.stepOrder}`,
      );
    } else {
      const refreshedInspection = await this.getInspectionOrThrow(inspectionId);
      const pendingStages = refreshedInspection.stages.filter(
        (stage) => stage.status !== StageStatus.APPROVED,
      );
      if (pendingStages.length > 0) {
        const pendingNames = pendingStages
          .map((stage) => stage.stageTemplate?.name || `Stage #${stage.id}`)
          .join(', ');
        throw new BadRequestException(
          `Cannot give final approval. The following stages are not yet approved: ${pendingNames}`,
        );
      }

      run.status = WorkflowRunStatus.COMPLETED;
      isFinal = true;
      refreshedInspection.status = InspectionStatus.APPROVED;
      refreshedInspection.inspectionDate = now.toISOString().split('T')[0];
      refreshedInspection.inspectedBy = actor?.displayName || signedByName;
      refreshedInspection.isLocked = true;
      refreshedInspection.lockedAt = now;
      refreshedInspection.lockedByUserId = userId;
      await this.inspectionRepo.save(refreshedInspection);

      if (refreshedInspection.requestedById) {
        const notification =
          await this.notificationComposer.composeInspectionDecision({
            projectId: refreshedInspection.projectId,
            epsNodeId: refreshedInspection.epsNodeId,
            activityLabel: refreshedInspection.activity?.activityName || null,
            subjectLabel: `RFI #${inspectionId}`,
            inspectionId,
            decisionLabel: 'RFI Fully Approved',
          });
        this.pushService
          .sendToUsers(
            [refreshedInspection.requestedById],
            notification.title,
            notification.body,
            { inspectionId: String(inspectionId), ...notification.data },
          )
          .catch(() => {
            /* non-fatal */
          });
      }
    }

    const savedRun = await this.runRepo.save(run);
    return { run: savedRun, isFinal };
  }

  async rejectWorkflow(
    inspectionId: number,
    userId: number,
    comments: string,
    isAdmin: boolean = false,
  ): Promise<InspectionWorkflowRun> {
    const run = await this.getWorkflowState(inspectionId);
    if (!run) throw new NotFoundException('Workflow run not found');
    if (run.status !== WorkflowRunStatus.IN_PROGRESS) {
      throw new BadRequestException('Workflow is not in progress');
    }

    const inspection = await this.getInspectionOrThrow(inspectionId);
    const currentStep = run.steps.find(
      (step) => step.stepOrder === run.currentStepOrder,
    );
    if (!currentStep) {
      throw new NotFoundException('Current workflow step not found');
    }

    await this.assertUserCanApproveStep(inspection, currentStep, userId, isAdmin);

    const sortedSteps = [...run.steps].sort((a, b) => a.stepOrder - b.stepOrder);
    const firstStep = sortedSteps[0];
    const restartPolicy = await this.getRestartPolicy(inspection, run);
    const restartStep =
      restartPolicy === RestartPolicy.NO_RESTART ? currentStep : firstStep;

    currentStep.status = WorkflowStepStatus.REJECTED;
    currentStep.comments = comments || 'Rejected';
    await this.stepRepo.save(currentStep);

    for (const step of sortedSteps) {
      if (!restartStep) break;

      if (step.id === restartStep.id) {
        step.status = WorkflowStepStatus.PENDING;
        step.completedAt = null;
        step.signatureId = null;
        step.currentApprovalCount = 0;
        step.approvedUserIds = [];
        step.signedBy = null;
        step.signerDisplayName = null;
        step.signerCompany = null;
        step.signerRole = null;
        step.comments =
          restartPolicy === RestartPolicy.NO_RESTART
            ? `Rework required at level ${step.stepOrder}: ${comments || 'Rejected'}`
            : `Restarted after rejection: ${comments || 'Rejected'}`;
        await this.stepRepo.save(step);
        continue;
      }

      if (restartPolicy === RestartPolicy.NO_RESTART) {
        if (step.stepOrder > currentStep.stepOrder) {
          step.status = WorkflowStepStatus.WAITING;
          step.completedAt = null;
          step.signatureId = null;
          step.currentApprovalCount = 0;
          step.approvedUserIds = [];
          step.signedBy = null;
          step.signerDisplayName = null;
          step.signerCompany = null;
          step.signerRole = null;
          await this.stepRepo.save(step);
        }
        continue;
      }

      if (step.stepOrder > restartStep.stepOrder || step.id === currentStep.id) {
        step.status = WorkflowStepStatus.WAITING;
        step.completedAt = null;
        step.signatureId = null;
        step.currentApprovalCount = 0;
        step.approvedUserIds = [];
        step.signedBy = null;
        step.signerDisplayName = null;
        step.signerCompany = null;
        step.signerRole = null;
        if (step.id !== restartStep.id) {
          step.comments = null;
        }
        await this.stepRepo.save(step);
        continue;
      }

      if (step.stepOrder < restartStep.stepOrder) {
        step.status = WorkflowStepStatus.WAITING;
        step.completedAt = null;
        step.signatureId = null;
        step.currentApprovalCount = 0;
        step.approvedUserIds = [];
        step.signedBy = null;
        step.signerDisplayName = null;
        step.signerCompany = null;
        step.signerRole = null;
        step.comments = null;
        await this.stepRepo.save(step);
      }
    }

    run.currentStepOrder = restartStep?.stepOrder || run.currentStepOrder;
    inspection.status = InspectionStatus.PENDING;
    inspection.isLocked = false;
    inspection.lockedAt = null;
    inspection.lockedByUserId = null;
    await this.inspectionRepo.save(inspection);

    if (inspection.requestedById) {
      const notification =
        await this.notificationComposer.composeInspectionDecision({
          projectId: inspection.projectId,
          epsNodeId: inspection.epsNodeId,
          activityLabel: inspection.activity?.activityName || null,
          subjectLabel: `RFI #${inspectionId}`,
          inspectionId,
          decisionLabel: 'RFI Workflow Rejected',
          comments:
            comments +
            `. Workflow resumes from ${
              restartPolicy === RestartPolicy.NO_RESTART
                ? `level ${currentStep.stepOrder}`
                : 'level 1'
            }`,
        });
      this.pushService
        .sendToUsers(
          [inspection.requestedById],
          notification.title,
          notification.body,
          { inspectionId: String(inspectionId), ...notification.data },
        )
        .catch(() => {
          /* non-fatal */
        });
    }

    await this.auditService.log(
      userId,
      'QUALITY',
      'REJECT_RFI_WORKFLOW',
      String(inspectionId),
      inspection.epsNodeId,
      {
        comments,
        restartPolicy,
        restartFromStep: run.currentStepOrder,
      },
    );

    return this.runRepo.save(run);
  }

  async reverseWorkflow(
    inspectionId: number,
    userId: number,
    reason: string,
    isAdmin: boolean = false,
  ): Promise<InspectionWorkflowRun> {
    if (!isAdmin) {
      throw new ForbiddenException('Only admin can reverse approved workflows');
    }

    const run = await this.getWorkflowState(inspectionId);
    if (!run) throw new NotFoundException('Workflow run not found');

    const inspection = await this.getInspectionOrThrow(inspectionId);
    const now = new Date();

    inspection.status = InspectionStatus.REVERSED;
    inspection.isLocked = false;
    inspection.lockedAt = null;
    inspection.lockedByUserId = null;
    await this.inspectionRepo.save(inspection);

    const sortedSteps = [...run.steps].sort((a, b) => a.stepOrder - b.stepOrder);
    const firstStep = sortedSteps[0];
    for (const step of sortedSteps) {
      if (step.stepOrder === firstStep?.stepOrder) {
        step.status = WorkflowStepStatus.PENDING;
      } else {
        step.status = WorkflowStepStatus.WAITING;
      }
      step.completedAt = null;
      step.signatureId = null;
      step.currentApprovalCount = 0;
      step.approvedUserIds = [];
      step.signedBy = null;
      step.signerDisplayName = null;
      step.signerCompany = null;
      step.signerRole = null;
      step.comments = step.stepOrder === firstStep?.stepOrder ? `REVERSED: ${reason}` : null;
      await this.stepRepo.save(step);
    }

    await this.signatureRepo.update(
      { inspectionId, isReversed: false },
      {
        isReversed: true,
        reversedAt: now,
        reversedByUserId: userId,
        reversalReason: reason,
      },
    );

    run.status = WorkflowRunStatus.REVERSED;
    run.currentStepOrder = firstStep?.stepOrder || 1;
    const savedRun = await this.runRepo.save(run);

    // Notify the original raiser that their approved RFI has been reversed
    if (inspection.requestedById) {
      const notification =
        await this.notificationComposer.composeInspectionDecision({
          projectId: inspection.projectId,
          epsNodeId: inspection.epsNodeId,
          activityLabel: inspection.activity?.activityName || null,
          subjectLabel: `RFI #${inspectionId}`,
          inspectionId,
          decisionLabel: 'RFI Approval Reversed',
          comments: reason,
        });
      this.pushService
        .sendToUsers(
          [inspection.requestedById],
          notification.title,
          notification.body,
          { inspectionId: String(inspectionId), ...notification.data },
        )
        .catch(() => {
          /* non-fatal */
        });
    }

    await this.auditService.log(
      userId,
      'QUALITY',
      'REVERSE_RFI',
      String(inspectionId),
      inspection.epsNodeId,
      { reason, previousStatus: 'APPROVED' },
    );

    return savedRun;
  }

  async delegateWorkflowStep(
    inspectionId: number,
    currentUserId: number,
    newUserId: number,
    comments?: string,
    isAdmin: boolean = false,
    stepOrder?: number,
  ): Promise<InspectionWorkflowRun> {
    const run = await this.runRepo.findOne({
      where: { inspectionId },
      relations: ['steps'],
    });
    if (!run) throw new NotFoundException('Workflow run not found');

    const inspection = await this.getInspectionOrThrow(inspectionId);
    const targetOrder = stepOrder ?? run.currentStepOrder;
    const targetStep = run.steps.find((step) => step.stepOrder === targetOrder);
    if (!targetStep) throw new NotFoundException('Workflow step not found');

    if (!targetStep.canDelegate && !isAdmin) {
      throw new ForbiddenException('This step cannot be delegated');
    }

    await this.assertUserCanApproveStep(
      inspection,
      targetStep,
      currentUserId,
      isAdmin,
    );

    const eligibleActors = await this.getEligibleApprovers(inspection.projectId);
    const delegate = eligibleActors.find((actor) => actor.userId === newUserId);
    if (!delegate) {
      throw new BadRequestException(
        'Delegate must be an active user from the project team',
      );
    }

    targetStep.assignedUserId = newUserId;
    targetStep.assignedRoleId = null;
    targetStep.comments =
      comments || `Delegated by ${isAdmin ? 'Admin' : `User ${currentUserId}`}`;
    await this.stepRepo.save(targetStep);

    // Notify the delegate that a workflow step has been assigned to them
    const notification = await this.notificationComposer.composeInspectionDelegated({
      projectId: inspection.projectId,
      epsNodeId: inspection.epsNodeId,
      activityLabel: inspection.activity?.activityName || null,
      subjectLabel: `RFI #${inspectionId}`,
      inspectionId,
      levelLabel: `Level ${targetOrder}`,
      delegateName: delegate.name,
    });
    this.pushService
      .sendToUsers([newUserId], notification.title, notification.body, {
        inspectionId: String(inspectionId),
        ...notification.data,
      })
      .catch(() => {
        /* non-fatal */
      });

    await this.auditService.log(
      currentUserId,
      'QUALITY',
      'DELEGATE_WORKFLOW_STEP',
      String(inspectionId),
      inspection.epsNodeId,
      {
        stepOrder: targetOrder,
        from: currentUserId,
        to: newUserId,
        comments,
      },
    );

    return (await this.getWorkflowState(inspectionId))!;
  }
}
