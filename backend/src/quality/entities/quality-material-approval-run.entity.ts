import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QualityMaterialApprovalStep } from './quality-material-approval-step.entity';

@Entity('quality_material_approval_runs')
export class QualityMaterialApprovalRun {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

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
  contextSnapshot: any;

  @OneToMany(() => QualityMaterialApprovalStep, (step) => step.run, {
    cascade: true,
  })
  steps: QualityMaterialApprovalStep[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
