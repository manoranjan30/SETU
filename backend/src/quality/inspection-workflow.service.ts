import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InspectionWorkflowRun, WorkflowRunStatus } from './entities/inspection-workflow-run.entity';
import { InspectionWorkflowStep, WorkflowStepStatus } from './entities/inspection-workflow-step.entity';
import { ApprovalWorkflowTemplate } from './entities/approval-workflow-template.entity';
import { AssignmentMode } from './entities/approval-workflow-node.entity';
import { UserProjectAssignment } from '../projects/entities/user-project-assignment.entity';
import { QualitySignature } from './entities/quality-signature.entity';

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
        private readonly signatureRepo: Repository<QualitySignature>
    ) { }

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
            return null; // Fallback to manual flow
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

        // Fetch team to resolve roles
        const teamMembers = await this.assignmentRepo.find({
            where: { project: { id: projectId } },
            relations: ['user', 'roles'],
        });

        const steps = template.nodes.map(node => {
            let resolvedUserId = node.assignedUserId;

            if (node.assignmentMode === AssignmentMode.ROLE && node.assignedRoleId) {
                // Find the FIRST active user who has this role on this project
                const eligibleMember = teamMembers.find(member =>
                    member.roles.some(r => r.id === node.assignedRoleId)
                );
                if (eligibleMember) {
                    resolvedUserId = eligibleMember.user.id;
                }
            }

            // If step 1 (Raise RFI), it automatically should be the person who raised it, unless strictly enforced.
            // Usually, the first node is Raise RFI. 
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
     * Validates if the user is authorized.
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

        // Validate if the user is authorized. If nobody is assigned, effectively it's stuck or fallback rules apply.
        // Admins have unrestricted access (bypass assignment check).
        if (!isAdmin && currentStep.assignedUserId && currentStep.assignedUserId !== userId) {
            throw new ForbiddenException('You are not the assigned user for this approval step');
        }

        let effectiveSignatureId = signatureId;

        // Create signature if data is provided and ID is not valid
        if (!effectiveSignatureId && signatureData) {
            const sig = this.signatureRepo.create({
                role: currentStep.workflowNode?.label || 'Approver',
                signedBy: signedByName,
                signatureData: signatureData,
                lockHash: 'WORKFLOW_STEP_' + currentStep.id,
                metadata: {
                    timestamp: new Date()
                }
            });
            const savedSig = await this.signatureRepo.save(sig);
            effectiveSignatureId = savedSig.id;
        }

        currentStep.status = WorkflowStepStatus.COMPLETED;
        currentStep.signatureId = effectiveSignatureId > 0 ? effectiveSignatureId : null;
        currentStep.signedBy = signedByName;
        currentStep.completedAt = new Date();
        currentStep.comments = comments || '';

        await this.stepRepo.save(currentStep);

        // Determine next step
        const nextStep = run.steps.find(s => s.stepOrder === run.currentStepOrder + 1);

        let isFinal = false;

        if (nextStep) {
            nextStep.status = WorkflowStepStatus.PENDING;
            await this.stepRepo.save(nextStep);
            run.currentStepOrder += 1;
        } else {
            // It's the final step
            run.status = WorkflowRunStatus.COMPLETED;
            isFinal = true;
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

        const currentStep = run.steps.find(s => s.stepOrder === run.currentStepOrder);
        if (!currentStep) throw new NotFoundException('Current workflow step not found');

        if (!isAdmin && currentStep.assignedUserId && currentStep.assignedUserId !== userId) {
            throw new ForbiddenException('You are not the assigned user for this approval step');
        }

        currentStep.status = WorkflowStepStatus.REJECTED;
        currentStep.comments = comments || '';
        await this.stepRepo.save(currentStep);

        run.status = WorkflowRunStatus.REJECTED;
        return this.runRepo.save(run);
    }

}
