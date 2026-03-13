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
import { ApprovalWorkflowTemplate } from './entities/approval-workflow-template.entity';
import { AssignmentMode } from './entities/approval-workflow-node.entity';
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

@Injectable()
export class InspectionWorkflowService {
  constructor(
    @InjectRepository(InspectionWorkflowRun)
    private readonly runRepo: Repository<InspectionWorkflowRun>,
    @InjectRepository(InspectionWorkflowStep)
    private readonly stepRepo: Repository<InspectionWorkflowStep>,
    @InjectRepository(ApprovalWorkflowTemplate)
    private readonly templateRepo: Repository<ApprovalWorkflowTemplate>,
    @InjectRepository(UserProjectAssignment)
    private readonly assignmentRepo: Repository<UserProjectAssignment>,
    @InjectRepository(QualitySignature)
    private readonly signatureRepo: Repository<QualitySignature>,
    @InjectRepository(QualityInspection)
    private readonly inspectionRepo: Repository<QualityInspection>,
    private readonly auditService: AuditService,
    private readonly pushService: PushNotificationService,
  ) {}

  // ─── Signature Hash ─────────────────────────────────────────────────
  private generateSignatureHash(
    signatureData: string,
    userId: number,
    timestamp: Date,
  ): string {
    const payload = `${signatureData}|${userId}|${timestamp.toISOString()}`;
    return createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Instantiates a workflow run for a newly created RFI if an Approval Template exists for the project.
   * Resolves ROLE-based assignments to specific users based on Project Teams.
   * Notifies ALL eligible approvers for step 2 (next after raiser) via project-scoped push.
   */
  async startWorkflowForInspection(
    inspectionId: number,
    listId: number,
    projectId: number,
    raiserUserId: number,
  ): Promise<InspectionWorkflowRun | null> {
    const template = await this.templateRepo.findOne({
      where: { projectId, isActive: true },
      relations: ['nodes', 'edges'],
    });

    if (!template) {
      return null;
    }

    if (!template.nodes || template.nodes.length === 0) {
      return null;
    }

    // Sort nodes by stepOrder to correctly determine the first real approval step
    const sortedNodes = [...template.nodes].sort(
      (a, b) => a.stepOrder - b.stepOrder,
    );

    // Find the first REAL approval step (skip RAISE_RFI node)
    // RaiseRFI is auto-completed when user raises the RFI, so approval starts at the next step
    const raiserNode = sortedNodes.find(
      (n) => n.stepType === 'RAISE_RFI' || n.stepOrder === 1,
    );
    const firstApprovalNode = sortedNodes.find(
      (n) =>
        n.stepType !== 'RAISE_RFI' &&
        n.stepOrder > (raiserNode?.stepOrder || 0),
    );

    // If there is no approval step beyond RaiseRFI, the workflow is already complete
    const initialStepOrder = firstApprovalNode
      ? firstApprovalNode.stepOrder
      : raiserNode
        ? raiserNode.stepOrder
        : 1;

    const run = this.runRepo.create({
      inspectionId,
      workflowTemplateId: template.id,
      currentStepOrder: initialStepOrder,
      status: firstApprovalNode
        ? WorkflowRunStatus.IN_PROGRESS
        : WorkflowRunStatus.COMPLETED,
    });

    const savedRun = await this.runRepo.save(run);

    // Fetch ONLY ACTIVE project team members (project-scoped isolation)
    const teamMembers = await this.assignmentRepo.find({
      where: {
        project: { id: projectId },
        status: AssignmentStatus.ACTIVE,
      },
      relations: ['user', 'roles'],
    });

    const steps = sortedNodes.map((node) => {
      let resolvedUserId = node.assignedUserId;

      if (node.assignmentMode === AssignmentMode.ROLE && node.assignedRoleId) {
        const eligibleMembers = teamMembers.filter((member) =>
          member.roles.some((r) => r.id === node.assignedRoleId),
        );

        if (eligibleMembers.length > 0) {
          resolvedUserId = eligibleMembers[0].user.id;
        } else {
          console.warn(
            `[Workflow] No project team member found for role=${node.assignedRoleId} in project=${projectId}. Step ${node.stepOrder} will have no assigned user.`,
          );
          resolvedUserId = null;
        }
      }

      // Determine if this is the RaiseRFI step
      const isRaiserStep =
        node.stepType === 'RAISE_RFI' ||
        node.stepOrder === (raiserNode?.stepOrder || 1);

      if (isRaiserStep) {
        resolvedUserId = raiserUserId;
      }

      // RaiseRFI step is auto-COMPLETED because raising the RFI IS the action.
      // The first real approval step starts as PENDING.
      // All other steps are WAITING.
      let stepStatus: WorkflowStepStatus;
      if (isRaiserStep) {
        stepStatus = WorkflowStepStatus.COMPLETED;
      } else if (
        firstApprovalNode &&
        node.stepOrder === firstApprovalNode.stepOrder
      ) {
        stepStatus = WorkflowStepStatus.PENDING;
      } else {
        stepStatus = WorkflowStepStatus.WAITING;
      }

      return this.stepRepo.create({
        runId: savedRun.id,
        workflowNodeId: node.id,
        stepOrder: node.stepOrder,
        assignedUserId: resolvedUserId,
        status: stepStatus,
        // Auto-sign the raiser step
        ...(isRaiserStep
          ? {
              signedBy: String(raiserUserId),
              completedAt: new Date(),
              comments: 'Auto-completed: RFI raised by user',
            }
          : {}),
      });
    });

    await this.stepRepo.save(steps);

    // If no real approval step exists, auto-approve the inspection
    if (!firstApprovalNode) {
      const inspection = await this.inspectionRepo.findOne({
        where: { id: inspectionId },
      });
      if (inspection) {
        inspection.status = 'APPROVED' as any;
        inspection.inspectionDate = new Date().toISOString().split('T')[0];
        inspection.inspectedBy = String(raiserUserId);
        await this.inspectionRepo.save(inspection);
      }
    } else {
      // Notify ALL eligible approvers for the first real approval step
      const nextNode = firstApprovalNode;
      if (
        nextNode.assignmentMode === AssignmentMode.ROLE &&
        nextNode.assignedRoleId
      ) {
        this.pushService
          .sendToProjectRole(
            projectId,
            nextNode.assignedRoleId,
            'New RFI Awaiting Approval 📋',
            `RFI #${inspectionId} has been raised and requires your approval.`,
            { inspectionId: String(inspectionId), type: 'PENDING_APPROVAL' },
          )
          .catch(() => {
            /* non-fatal */
          });
      } else {
        const approvalStep = steps.find(
          (s) => s.stepOrder === nextNode.stepOrder,
        );
        if (approvalStep?.assignedUserId) {
          this.pushService
            .sendToUsers(
              [approvalStep.assignedUserId],
              'New RFI Awaiting Approval 📋',
              `RFI #${inspectionId} has been raised and requires your approval.`,
              { inspectionId: String(inspectionId), type: 'PENDING_APPROVAL' },
            )
            .catch(() => {
              /* non-fatal */
            });
        }
      }
    }

    return this.runRepo.findOne({
      where: { id: savedRun.id },
      relations: ['steps', 'steps.workflowNode'],
    });
  }

  async getWorkflowState(
    inspectionId: number,
  ): Promise<InspectionWorkflowRun | null> {
    const run = await this.runRepo.findOne({
      where: { inspectionId },
      relations: [
        'steps',
        'steps.workflowNode',
        'steps.signature',
        'workflowTemplate',
      ],
      order: {
        steps: {
          stepOrder: 'ASC',
        },
      },
    });
    return run;
  }

  /**
   * Completes the current step and advances to the next step.
   * Generates auditable SHA-256 signature hash for each approval.
   */
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

    const currentStep = run.steps.find(
      (s) => s.stepOrder === run.currentStepOrder,
    );
    if (!currentStep) {
      throw new NotFoundException('Current workflow step not found');
    }

    // Fetch inspection early — needed for role-based permission check and status update below
    const inspection = await this.inspectionRepo.findOne({
      where: { id: inspectionId },
    });

    if (
      !isAdmin &&
      currentStep.assignedUserId &&
      currentStep.assignedUserId !== userId
    ) {
      // For ROLE-based steps, allow any active project team member who holds the required role
      const node = currentStep.workflowNode;
      let userHasRequiredRole = false;
      if (
        node?.assignmentMode === AssignmentMode.ROLE &&
        node?.assignedRoleId &&
        inspection?.projectId
      ) {
        const matchingAssignment = await this.assignmentRepo
          .createQueryBuilder('a')
          .innerJoin('a.user', 'u')
          .innerJoin('a.roles', 'r')
          .where('u.id = :userId', { userId })
          .andWhere('a.project = :projectId', {
            projectId: inspection.projectId,
          })
          .andWhere('r.id = :roleId', { roleId: node.assignedRoleId })
          .andWhere('a.status = :status', { status: AssignmentStatus.ACTIVE })
          .getOne();
        userHasRequiredRole = !!matchingAssignment;
      }

      if (!userHasRequiredRole) {
        throw new ForbiddenException(
          'You are not the assigned user for this approval step',
        );
      }
    }

    let effectiveSignatureId = signatureId;
    const now = new Date();

    // Enforce signature on all approval steps
    if (!effectiveSignatureId && !signatureData) {
      throw new BadRequestException(
        'A digital signature is required to approve this workflow step.',
      );
    }

    // Create signature with SHA-256 audit hash
    if (!effectiveSignatureId && signatureData) {
      const signatureHash = this.generateSignatureHash(
        signatureData,
        userId,
        now,
      );

      const sig = this.signatureRepo.create({
        role: currentStep.workflowNode?.label || 'Approver',
        signedBy: signedByName,
        signatureData: signatureData,
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
      effectiveSignatureId > 0 ? effectiveSignatureId : null;
    currentStep.signedBy = signedByName;
    currentStep.completedAt = now;
    currentStep.comments = comments || '';

    await this.stepRepo.save(currentStep);

    const nextStep = run.steps.find(
      (s) => s.stepOrder === run.currentStepOrder + 1,
    );

    let isFinal = false;

    if (nextStep) {
      nextStep.status = WorkflowStepStatus.PENDING;
      await this.stepRepo.save(nextStep);
      run.currentStepOrder += 1;

      // Mark parent inspection as PARTIALLY_APPROVED
      if (
        inspection &&
        (inspection.status === 'PENDING' ||
          inspection.status === ('PARTIALLY_APPROVED' as any))
      ) {
        if (inspection.status !== 'PARTIALLY_APPROVED') {
          inspection.status = 'PARTIALLY_APPROVED' as any;
          await this.inspectionRepo.save(inspection);
        }
      }

      // PROJECT-SCOPED: Notify the next approver(s)
      // If step is role-based, notify ALL project team members with that role
      // If step is user-based, notify that specific user
      const nextNode = nextStep.workflowNode;
      if (
        nextNode &&
        nextNode.assignmentMode === AssignmentMode.ROLE &&
        nextNode.assignedRoleId
      ) {
        const projectId = inspection?.projectId;
        if (projectId) {
          this.pushService
            .sendToProjectRole(
              projectId,
              nextNode.assignedRoleId,
              'Approval Required 📋',
              `RFI #${inspectionId} is awaiting your approval at Step ${nextStep.stepOrder}.`,
              { inspectionId: String(inspectionId), type: 'PENDING_APPROVAL' },
            )
            .catch(() => {
              /* non-fatal */
            });
        }
      } else if (nextStep.assignedUserId) {
        this.pushService
          .sendToUsers(
            [nextStep.assignedUserId],
            'Approval Required 📋',
            `RFI #${inspectionId} is awaiting your approval at Step ${nextStep.stepOrder}.`,
            { inspectionId: String(inspectionId), type: 'PENDING_APPROVAL' },
          )
          .catch(() => {
            /* non-fatal */
          });
      }
    } else {
      run.status = WorkflowRunStatus.COMPLETED;
      isFinal = true;

      // Auto-approve the parent inspection
      if (inspection) {
        inspection.status = 'APPROVED' as any;
        inspection.inspectionDate = now.toISOString().split('T')[0];
        inspection.inspectedBy = String(userId);
        await this.inspectionRepo.save(inspection);

        // Notify the RFI raiser that workflow is fully approved
        if (inspection.requestedById) {
          this.pushService
            .sendToUsers(
              [inspection.requestedById],
              'RFI Fully Approved ✅',
              `Your RFI #${inspectionId} has been approved through all workflow levels.`,
              { inspectionId: String(inspectionId), type: 'APPROVED' },
            )
            .catch(() => {
              /* non-fatal */
            });
        }
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

    const currentStep = run.steps.find(
      (s) => s.stepOrder === run.currentStepOrder,
    );
    if (!currentStep)
      throw new NotFoundException('Current workflow step not found');

    if (
      !isAdmin &&
      currentStep.assignedUserId &&
      currentStep.assignedUserId !== userId
    ) {
      throw new ForbiddenException(
        'You are not the assigned user for this approval step',
      );
    }

    // Mark current step as rejected to keep a record
    currentStep.status = WorkflowStepStatus.REJECTED;
    currentStep.comments = comments || 'Rejected. Falling back to start.';
    await this.stepRepo.save(currentStep);

    // Fall back to the first REAL approval step (skip auto-completed RaiseRFI step)
    const sortedSteps = [...run.steps].sort(
      (a, b) => a.stepOrder - b.stepOrder,
    );
    const firstApprovalStep =
      sortedSteps.find(
        (s) => s.workflowNode?.stepType !== 'RAISE_RFI' && s.stepOrder > 1,
      ) ||
      sortedSteps.find((s) => s.stepOrder > 1) ||
      sortedSteps[0];

    if (firstApprovalStep) {
      firstApprovalStep.status = WorkflowStepStatus.PENDING;
      firstApprovalStep.completedAt = null;
      firstApprovalStep.comments = `Fell back due to rejection at step ${run.currentStepOrder}: ${comments}`;
      await this.stepRepo.save(firstApprovalStep);

      // Reset any intermediate steps between the fallback step and the rejected step
      for (const step of sortedSteps) {
        if (
          step.stepOrder > firstApprovalStep.stepOrder &&
          step.stepOrder < run.currentStepOrder &&
          step.status === WorkflowStepStatus.COMPLETED
        ) {
          step.status = WorkflowStepStatus.WAITING;
          step.completedAt = null;
          await this.stepRepo.save(step);
        }
      }
    }

    // Set run back to the first approval step but keep status IN_PROGRESS so it can be re-run
    run.currentStepOrder = firstApprovalStep?.stepOrder || 1;

    // Notify the original raiser
    const inspection = await this.inspectionRepo.findOne({
      where: { id: inspectionId },
    });
    if (inspection?.requestedById) {
      this.pushService
        .sendToUsers(
          [inspection.requestedById],
          'RFI Workflow Rejected ⚠️',
          `Your RFI #${inspectionId} was rejected and fell back to the first step. Reason: ${comments}`,
          { inspectionId: String(inspectionId), type: 'REJECTED' },
        )
        .catch(() => {
          /* non-fatal */
        });
    }

    return this.runRepo.save(run);
  }

  /**
   * Reverses an already-completed workflow.
   * Resets all steps back to WAITING and sets run to IN_PROGRESS at step 1.
   * Notifies the original RFI raiser about the reversal.
   */
  async reverseWorkflow(
    inspectionId: number,
    userId: number,
    reason: string,
    isAdmin: boolean = false,
  ): Promise<InspectionWorkflowRun> {
    const run = await this.getWorkflowState(inspectionId);
    if (!run) throw new NotFoundException('Workflow run not found');

    if (run.status !== WorkflowRunStatus.COMPLETED) {
      throw new BadRequestException('Only completed workflows can be reversed');
    }

    // Update the inspection status to REVERSED
    const inspection = await this.inspectionRepo.findOne({
      where: { id: inspectionId },
    });
    if (!inspection) throw new NotFoundException('Inspection not found');

    inspection.status = InspectionStatus.REVERSED;
    await this.inspectionRepo.save(inspection);

    // Reset workflow steps: keep RaiseRFI step as COMPLETED, reset others
    const sortedSteps = [...run.steps].sort(
      (a, b) => a.stepOrder - b.stepOrder,
    );
    const firstApprovalStep =
      sortedSteps.find(
        (s) => s.workflowNode?.stepType !== 'RAISE_RFI' && s.stepOrder > 1,
      ) || sortedSteps.find((s) => s.stepOrder > 1);

    for (const step of run.steps) {
      const isRaiserStep =
        step.workflowNode?.stepType === 'RAISE_RFI' || step.stepOrder === 1;

      if (isRaiserStep) {
        // Keep RaiseRFI step as COMPLETED — the RFI was already raised
        step.comments = `REVERSED: ${reason} (RFI raise preserved)`;
      } else if (
        firstApprovalStep &&
        step.stepOrder === firstApprovalStep.stepOrder
      ) {
        step.status = WorkflowStepStatus.PENDING;
        step.completedAt = null;
        step.comments = `REVERSED: ${reason}`;
      } else {
        step.status = WorkflowStepStatus.WAITING;
        step.completedAt = null;
        step.comments = null;
      }
      // Keep signature references for audit trail (do NOT delete)
    }
    await this.stepRepo.save(run.steps);

    // Reset the run to the first real approval step
    run.status = WorkflowRunStatus.REVERSED;
    run.currentStepOrder = firstApprovalStep?.stepOrder || 1;
    const savedRun = await this.runRepo.save(run);

    // Audit log
    await this.auditService.log(
      userId,
      'QUALITY',
      'REVERSE_RFI',
      String(inspectionId),
      inspection.epsNodeId,
      { reason, previousStatus: 'COMPLETED' },
    );

    // Notify the original raiser
    if (inspection.requestedById) {
      this.pushService
        .sendToUsers(
          [inspection.requestedById],
          'RFI Reversed ⚠️',
          `Your RFI #${inspectionId} has been reversed. Reason: ${reason}`,
          { inspectionId: String(inspectionId), type: 'REVERSED' },
        )
        .catch(() => {
          /* non-fatal */
        });
    }

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

    const orderToDelegate =
      stepOrder !== undefined ? stepOrder : run.currentStepOrder;
    const targetStep = run.steps.find((s) => s.stepOrder === orderToDelegate);

    if (!targetStep) throw new NotFoundException('Workflow step not found');

    if (!isAdmin && targetStep.assignedUserId !== currentUserId) {
      throw new ForbiddenException(
        'You can only delegate steps assigned to you.',
      );
    }

    if (targetStep.status === WorkflowStepStatus.COMPLETED) {
      throw new BadRequestException('Cannot delegate a completed step.');
    }

    targetStep.assignedUserId = newUserId;
    targetStep.comments =
      comments || `Delegated by ${isAdmin ? 'Admin' : 'User ' + currentUserId}`;

    await this.stepRepo.save(targetStep);

    // Audit log
    await this.auditService.log(
      currentUserId,
      'QUALITY',
      'DELEGATE_WORKFLOW_STEP',
      String(inspectionId),
      0,
      {
        stepOrder: orderToDelegate,
        from: currentUserId,
        to: newUserId,
        comments,
      },
    );

    return (await this.getWorkflowState(inspectionId))!;
  }
}
