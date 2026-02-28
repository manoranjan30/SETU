import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { InspectionWorkflowRun, WorkflowRunStatus } from './entities/inspection-workflow-run.entity';
import { InspectionWorkflowStep, WorkflowStepStatus } from './entities/inspection-workflow-step.entity';
import { ApprovalWorkflowTemplate } from './entities/approval-workflow-template.entity';
import { AssignmentMode } from './entities/approval-workflow-node.entity';
import { UserProjectAssignment } from '../projects/entities/user-project-assignment.entity';
import { QualitySignature } from './entities/quality-signature.entity';
import { QualityInspection, InspectionStatus } from './entities/quality-inspection.entity';
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
    ) { }

    // ─── Signature Hash ─────────────────────────────────────────────────
    private generateSignatureHash(signatureData: string, userId: number, timestamp: Date): string {
        const payload = `${signatureData}|${userId}|${timestamp.toISOString()}`;
        return createHash('sha256').update(payload).digest('hex');
    }

    /**
     * Instantiates a workflow run for a newly created RFI if an Approval Template exists for the project.
     * Resolves ROLE-based assignments to specific users based on Project Teams.
     */
    async startWorkflowForInspection(
        inspectionId: number,
        listId: number,
        projectId: number,
        raiserUserId: number
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

        const run = this.runRepo.create({
            inspectionId,
            workflowTemplateId: template.id,
            currentStepOrder: 1,
            status: WorkflowRunStatus.IN_PROGRESS,
        });

        const savedRun = await this.runRepo.save(run);

        const teamMembers = await this.assignmentRepo.find({
            where: { project: { id: projectId } },
            relations: ['user', 'roles'],
        });

        const steps = template.nodes.map(node => {
            let resolvedUserId = node.assignedUserId;

            if (node.assignmentMode === AssignmentMode.ROLE && node.assignedRoleId) {
                const eligibleMember = teamMembers.find(member =>
                    member.roles.some(r => r.id === node.assignedRoleId)
                );
                if (eligibleMember) {
                    resolvedUserId = eligibleMember.user.id;
                }
            }

            if (node.stepOrder === 1) {
                resolvedUserId = raiserUserId;
            }

            return this.stepRepo.create({
                runId: savedRun.id,
                workflowNodeId: node.id,
                stepOrder: node.stepOrder,
                assignedUserId: resolvedUserId,
                status: node.stepOrder === 1 ? WorkflowStepStatus.PENDING : WorkflowStepStatus.WAITING,
            });
        });

        await this.stepRepo.save(steps);

        return this.runRepo.findOne({
            where: { id: savedRun.id },
            relations: ['steps', 'steps.workflowNode'],
        });
    }

    async getWorkflowState(inspectionId: number): Promise<InspectionWorkflowRun | null> {
        const run = await this.runRepo.findOne({
            where: { inspectionId },
            relations: ['steps', 'steps.workflowNode', 'steps.signature', 'workflowTemplate'],
            order: {
                steps: {
                    stepOrder: 'ASC'
                }
            }
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
        isAdmin: boolean = false
    ): Promise<{ run: InspectionWorkflowRun; isFinal: boolean }> {
        const run = await this.getWorkflowState(inspectionId);
        if (!run) {
            throw new NotFoundException('Workflow run not found');
        }

        if (run.status !== WorkflowRunStatus.IN_PROGRESS) {
            throw new BadRequestException('Workflow is not in progress');
        }

        const currentStep = run.steps.find(s => s.stepOrder === run.currentStepOrder);
        if (!currentStep) {
            throw new NotFoundException('Current workflow step not found');
        }

        if (!isAdmin && currentStep.assignedUserId && currentStep.assignedUserId !== userId) {
            throw new ForbiddenException('You are not the assigned user for this approval step');
        }

        let effectiveSignatureId = signatureId;
        const now = new Date();

        // Create signature with SHA-256 audit hash
        if (!effectiveSignatureId && signatureData) {
            const signatureHash = this.generateSignatureHash(signatureData, userId, now);

            const sig = this.signatureRepo.create({
                role: currentStep.workflowNode?.label || 'Approver',
                signedBy: signedByName,
                signatureData: signatureData,
                lockHash: signatureHash,
                metadata: {
                    timestamp: now,
                }
            });
            const savedSig = await this.signatureRepo.save(sig);
            effectiveSignatureId = savedSig.id;
        }

        currentStep.status = WorkflowStepStatus.COMPLETED;
        currentStep.signatureId = effectiveSignatureId > 0 ? effectiveSignatureId : null;
        currentStep.signedBy = signedByName;
        currentStep.completedAt = now;
        currentStep.comments = comments || '';

        await this.stepRepo.save(currentStep);

        const nextStep = run.steps.find(s => s.stepOrder === run.currentStepOrder + 1);

        let isFinal = false;

        if (nextStep) {
            nextStep.status = WorkflowStepStatus.PENDING;
            await this.stepRepo.save(nextStep);
            run.currentStepOrder += 1;
        } else {
            run.status = WorkflowRunStatus.COMPLETED;
            isFinal = true;

            // Auto-approve the parent inspection
            const inspection = await this.inspectionRepo.findOne({
                where: { id: inspectionId }
            });
            if (inspection) {
                inspection.status = 'APPROVED' as any;
                inspection.inspectionDate = now.toISOString().split('T')[0];
                inspection.inspectedBy = String(userId);
                await this.inspectionRepo.save(inspection);
            }
        }

        const savedRun = await this.runRepo.save(run);
        return { run: savedRun, isFinal };
    }

    async rejectWorkflow(
        inspectionId: number,
        userId: number,
        comments: string,
        isAdmin: boolean = false
    ): Promise<InspectionWorkflowRun> {
        const run = await this.getWorkflowState(inspectionId);
        if (!run) throw new NotFoundException('Workflow run not found');

        if (run.status !== WorkflowRunStatus.IN_PROGRESS) {
            throw new BadRequestException('Workflow is not in progress');
        }

        const currentStep = run.steps.find(s => s.stepOrder === run.currentStepOrder);
        if (!currentStep) throw new NotFoundException('Current workflow step not found');

        if (!isAdmin && currentStep.assignedUserId && currentStep.assignedUserId !== userId) {
            throw new ForbiddenException('You are not the assigned user for this approval step');
        }

        // Mark current step as rejected to keep a record
        currentStep.status = WorkflowStepStatus.REJECTED;
        currentStep.comments = comments || 'Rejected. Falling back to start.';
        await this.stepRepo.save(currentStep);

        // Fall back to step 1
        const firstStep = run.steps.find(s => s.stepOrder === 1);
        if (firstStep) {
            firstStep.status = WorkflowStepStatus.PENDING;
            firstStep.comments = `Fell back due to rejection at step ${run.currentStepOrder}: ${comments}`;
            await this.stepRepo.save(firstStep);
        }

        // Set run back to step 1 but keep status IN_PROGRESS so it can be re-run
        run.currentStepOrder = 1;

        // Notify the original raiser
        const inspection = await this.inspectionRepo.findOne({ where: { id: inspectionId } });
        if (inspection?.requestedById) {
            this.pushService.sendToUsers(
                [inspection.requestedById],
                'RFI Workflow Rejected ⚠️',
                `Your RFI #${inspectionId} was rejected and fell back to the first step. Reason: ${comments}`,
                { inspectionId: String(inspectionId), type: 'REJECTED' },
            ).catch(() => { /* non-fatal */ });
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
        isAdmin: boolean = false
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

        // Reset all workflow steps
        for (const step of run.steps) {
            step.status = step.stepOrder === 1 ? WorkflowStepStatus.PENDING : WorkflowStepStatus.WAITING;
            step.completedAt = null;
            step.comments = step.stepOrder === 1 ? `REVERSED: ${reason}` : null;
            // Keep signature references for audit trail (do NOT delete)
        }
        await this.stepRepo.save(run.steps);

        // Reset the run
        run.status = WorkflowRunStatus.REVERSED;
        run.currentStepOrder = 1;
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
            this.pushService.sendToUsers(
                [inspection.requestedById],
                'RFI Reversed ⚠️',
                `Your RFI #${inspectionId} has been reversed. Reason: ${reason}`,
                { inspectionId: String(inspectionId), type: 'REVERSED' },
            ).catch(() => { /* non-fatal */ });
        }

        return savedRun;
    }

    async delegateWorkflowStep(
        inspectionId: number,
        currentUserId: number,
        newUserId: number,
        comments?: string,
        isAdmin: boolean = false,
        stepOrder?: number
    ): Promise<InspectionWorkflowRun> {
        const run = await this.runRepo.findOne({
            where: { inspectionId },
            relations: ['steps'],
        });
        if (!run) throw new NotFoundException('Workflow run not found');

        const orderToDelegate = stepOrder !== undefined ? stepOrder : run.currentStepOrder;
        const targetStep = run.steps.find((s) => s.stepOrder === orderToDelegate);

        if (!targetStep) throw new NotFoundException('Workflow step not found');

        if (!isAdmin && targetStep.assignedUserId !== currentUserId) {
            throw new ForbiddenException('You can only delegate steps assigned to you.');
        }

        if (targetStep.status === WorkflowStepStatus.COMPLETED) {
            throw new BadRequestException('Cannot delegate a completed step.');
        }

        targetStep.assignedUserId = newUserId;
        targetStep.comments = comments || `Delegated by ${isAdmin ? 'Admin' : 'User ' + currentUserId}`;

        await this.stepRepo.save(targetStep);

        // Audit log
        await this.auditService.log(
            currentUserId,
            'QUALITY',
            'DELEGATE_WORKFLOW_STEP',
            String(inspectionId),
            0,
            { stepOrder: orderToDelegate, from: currentUserId, to: newUserId, comments },
        );

        return (await this.getWorkflowState(inspectionId))!;
    }

}
