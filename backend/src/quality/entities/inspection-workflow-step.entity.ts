import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { InspectionWorkflowRun } from './inspection-workflow-run.entity';
import { ApprovalWorkflowNode } from './approval-workflow-node.entity';
import { QualitySignature } from './quality-signature.entity';

export enum WorkflowStepStatus {
  WAITING = 'WAITING',
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  SKIPPED = 'SKIPPED',
}

@Entity('inspection_workflow_steps')
export class InspectionWorkflowStep {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  runId: number;

  @ManyToOne(() => InspectionWorkflowRun, (run) => run.steps, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'runId' })
  run: InspectionWorkflowRun;

  @Column({ nullable: true })
  workflowNodeId: number | null;

  @ManyToOne(() => ApprovalWorkflowNode, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'workflowNodeId' })
  workflowNode: ApprovalWorkflowNode | null;

  @Column()
  stepOrder: number;

  @Column({ type: 'int', nullable: true })
  assignedUserId: number | null;

  @Column({ type: 'jsonb', nullable: true })
  assignedUserIds: number[] | null;

  @Column({ type: 'int', nullable: true })
  assignedRoleId: number | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  stepName: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  approverMode: string | null;

  @Column({ default: false })
  canDelegate: boolean;

  @Column({ type: 'int', default: 1 })
  minApprovalsRequired: number;

  @Column({ type: 'int', default: 0 })
  currentApprovalCount: number;

  @Column({ type: 'jsonb', nullable: true })
  approvedUserIds: number[] | null;

  @Column({
    type: 'enum',
    enum: WorkflowStepStatus,
    default: WorkflowStepStatus.WAITING,
  })
  status: WorkflowStepStatus;

  @Column({ type: 'int', nullable: true })
  signatureId: number | null;

  @ManyToOne(() => QualitySignature, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'signatureId' })
  signature: QualitySignature;

  @Column({ type: 'varchar', length: 255, nullable: true })
  signedBy: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  signerDisplayName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  signerCompany: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  signerRole: string | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  comments: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
