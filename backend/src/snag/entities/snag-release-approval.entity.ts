import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SnagRound } from './snag-round.entity';
import { SnagReleaseApprovalStep } from './snag-release-approval-step.entity';

export enum SnagReleaseApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('snag_release_approval')
export class SnagReleaseApproval {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'snag_round_id' })
  snagRoundId: number;

  @ManyToOne(() => SnagRound, (round) => round.approvals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'snag_round_id' })
  snagRound: SnagRound;

  @Column({ name: 'project_id' })
  projectId: number;

  @Column({ name: 'current_step_order', type: 'int', default: 1 })
  currentStepOrder: number;

  @Column({
    type: 'enum',
    enum: SnagReleaseApprovalStatus,
    default: SnagReleaseApprovalStatus.PENDING,
  })
  status: SnagReleaseApprovalStatus;

  @Column({ name: 'release_strategy_id', type: 'int', nullable: true })
  releaseStrategyId: number | null;

  @Column({ name: 'process_code', type: 'varchar', length: 120, nullable: true })
  processCode: string | null;

  @OneToMany(() => SnagReleaseApprovalStep, (step) => step.approval, {
    cascade: true,
  })
  steps: SnagReleaseApprovalStep[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
