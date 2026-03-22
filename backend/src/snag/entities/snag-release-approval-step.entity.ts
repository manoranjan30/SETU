import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SnagReleaseApproval } from './snag-release-approval.entity';

export enum SnagReleaseApprovalStepStatus {
  WAITING = 'waiting',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('snag_release_approval_step')
export class SnagReleaseApprovalStep {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'approval_id' })
  approvalId: number;

  @ManyToOne(() => SnagReleaseApproval, (approval) => approval.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'approval_id' })
  approval: SnagReleaseApproval;

  @Column({ name: 'step_order', type: 'int' })
  stepOrder: number;

  @Column({ name: 'step_name', type: 'varchar', length: 255 })
  stepName: string;

  @Column({ name: 'assigned_role_id', type: 'int', nullable: true })
  assignedRoleId: number | null;

  @Column({ name: 'assigned_user_id', type: 'int', nullable: true })
  assignedUserId: number | null;

  @Column({ name: 'assigned_user_ids', type: 'jsonb', nullable: true })
  assignedUserIds: number[] | null;

  @Column({
    type: 'enum',
    enum: SnagReleaseApprovalStepStatus,
    default: SnagReleaseApprovalStepStatus.WAITING,
  })
  status: SnagReleaseApprovalStepStatus;

  @Column({ name: 'acted_by_user_id', type: 'int', nullable: true })
  actedByUserId: number | null;

  @Column({ name: 'acted_at', type: 'timestamp', nullable: true })
  actedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  comments: string | null;
}
