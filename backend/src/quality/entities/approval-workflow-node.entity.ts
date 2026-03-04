import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { ApprovalWorkflowTemplate } from './approval-workflow-template.entity';

export enum ApprovalStepType {
  RAISE_RFI = 'RAISE_RFI',
  INSPECT = 'INSPECT',
  APPROVE = 'APPROVE',
  FINAL_APPROVE = 'FINAL_APPROVE',
  WITNESS = 'WITNESS',
}

export enum AssignmentMode {
  USER = 'USER',
  ROLE = 'ROLE',
}

@Entity('approval_workflow_nodes')
export class ApprovalWorkflowNode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  workflowId: number;

  @ManyToOne(() => ApprovalWorkflowTemplate, (template) => template.nodes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workflowId' })
  workflow: ApprovalWorkflowTemplate;

  @Column({ type: 'jsonb', default: { x: 0, y: 0 } })
  position: { x: number; y: number };

  @Column({ type: 'enum', enum: ApprovalStepType })
  stepType: ApprovalStepType;

  @Column({ type: 'enum', enum: AssignmentMode })
  assignmentMode: AssignmentMode;

  @Column({ type: 'int', nullable: true })
  assignedUserId: number | null;

  @Column({ type: 'int', nullable: true })
  assignedRoleId: number | null;

  @Column({ length: 255 })
  label: string;

  @Column()
  stepOrder: number;

  @Column({ default: false })
  isOptional: boolean;

  @Column({ default: false })
  canDelegate: boolean;

  @Column({ default: false })
  allowRaiseRFI: boolean;

  @Column({ default: false })
  allowStageApprove: boolean;

  @Column({ default: false })
  allowFinalApprove: boolean;

  @Column({ default: false })
  allowReject: boolean;

  @Column({ default: false })
  allowObservation: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
