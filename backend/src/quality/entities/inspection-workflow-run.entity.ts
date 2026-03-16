import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { QualityInspection } from './quality-inspection.entity';
import { ApprovalWorkflowTemplate } from './approval-workflow-template.entity';
import { InspectionWorkflowStep } from './inspection-workflow-step.entity';

export enum WorkflowRunStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  REVERSED = 'REVERSED',
}

@Entity('inspection_workflow_runs')
export class InspectionWorkflowRun {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  inspectionId: number;

  @OneToOne(() => QualityInspection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inspectionId' })
  inspection: QualityInspection;

  @Column({ type: 'int', nullable: true })
  workflowTemplateId: number | null;

  @ManyToOne(() => ApprovalWorkflowTemplate, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'workflowTemplateId' })
  workflowTemplate: ApprovalWorkflowTemplate | null;

  @Column({ type: 'int', nullable: true })
  releaseStrategyId: number | null;

  @Column({ type: 'int', nullable: true })
  releaseStrategyVersion: number | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  strategyName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  moduleCode: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  processCode: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  documentType: string | null;

  @Column({ default: 1 })
  currentStepOrder: number;

  @Column({
    type: 'enum',
    enum: WorkflowRunStatus,
    default: WorkflowRunStatus.IN_PROGRESS,
  })
  status: WorkflowRunStatus;

  @OneToMany(() => InspectionWorkflowStep, (step) => step.run, {
    cascade: true,
  })
  steps: InspectionWorkflowStep[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
