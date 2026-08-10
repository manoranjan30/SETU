import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QualityCardApprovalStep } from './quality-card-approval-step.entity';

@Entity('quality_card_approval_runs')
export class QualityCardApprovalRun {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column()
  inspectionId: number;

  @Column({ type: 'int', nullable: true })
  activityId: number | null;

  @Column({ type: 'int', nullable: true })
  epsNodeId: number | null;

  @Column({ length: 80 })
  documentType: string;

  @Column()
  documentId: number;

  @Column()
  releaseStrategyId: number;

  @Column()
  releaseStrategyVersion: number;

  @Column({ length: 200 })
  strategyName: string;

  @Column({ length: 50, default: 'QUALITY' })
  moduleCode: string;

  @Column({ length: 100 })
  processCode: string;

  @Column({ length: 50, default: 'IN_PROGRESS' })
  status: string;

  @Column({ type: 'int', default: 1 })
  currentStepOrder: number;

  @Column({ type: 'int', nullable: true })
  initiatorUserId: number | null;

  @Column({ type: 'jsonb', nullable: true })
  contextSnapshot: Record<string, unknown> | null;

  @OneToMany(() => QualityCardApprovalStep, (step) => step.run, {
    cascade: true,
  })
  steps: QualityCardApprovalStep[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
