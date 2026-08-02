import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { SnagList } from './snag-list.entity';
import { SnagItem } from './snag-item.entity';
import { SnagReleaseApproval } from './snag-release-approval.entity';
import { SnagRoundLevelClosure } from './snag-round-level-closure.entity';

export enum SnagRoundSnagPhaseStatus {
  OPEN = 'open',
  SUBMITTED = 'submitted',
}

export enum SnagRoundDesnagPhaseStatus {
  LOCKED = 'locked',
  OPEN = 'open',
  APPROVAL_PENDING = 'approval_pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum SnagRoundLevelStatus {
  READY_PENDING = 'ready_pending',
  SNAGGING = 'snagging',
  RECTIFICATION = 'rectification',
  DESNAGGING = 'desnagging',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}

@Entity('snag_round')
export class SnagRound {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'snag_list_id' })
  snagListId: number;

  @ManyToOne(() => SnagList, (snagList) => snagList.rounds, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'snag_list_id' })
  snagList: SnagList;

  @Column({ name: 'round_number', type: 'int' })
  roundNumber: number;

  @Column({
    name: 'snag_phase_status',
    type: 'enum',
    enum: SnagRoundSnagPhaseStatus,
    default: SnagRoundSnagPhaseStatus.OPEN,
  })
  snagPhaseStatus: SnagRoundSnagPhaseStatus;

  @Column({ name: 'snag_submitted_at', type: 'timestamp', nullable: true })
  snagSubmittedAt: Date | null;

  @Column({ name: 'snag_submitted_by_id', type: 'int', nullable: true })
  snagSubmittedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'snag_submitted_by_id' })
  snagSubmittedBy: User | null;

  @Column({ name: 'snag_submitted_comments', type: 'text', nullable: true })
  snagSubmittedComments: string | null;

  @Column({
    name: 'desnag_phase_status',
    type: 'enum',
    enum: SnagRoundDesnagPhaseStatus,
    default: SnagRoundDesnagPhaseStatus.LOCKED,
  })
  desnagPhaseStatus: SnagRoundDesnagPhaseStatus;

  @Column({ name: 'desnag_released_at', type: 'timestamp', nullable: true })
  desnagReleasedAt: Date | null;

  @Column({ name: 'desnag_release_comments', type: 'text', nullable: true })
  desnagReleaseComments: string | null;

  @Column({ name: 'current_verifier_level', type: 'int', default: 1 })
  currentVerifierLevel: number;

  @Column({
    name: 'current_verifier_level_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  currentVerifierLevelName: string | null;

  @Column({
    name: 'level_status',
    type: 'varchar',
    length: 40,
    default: SnagRoundLevelStatus.READY_PENDING,
  })
  levelStatus: SnagRoundLevelStatus;

  @Column({ name: 'level_closed_at', type: 'timestamp', nullable: true })
  levelClosedAt: Date | null;

  @Column({ name: 'level_closed_by_id', type: 'int', nullable: true })
  levelClosedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'level_closed_by_id' })
  levelClosedBy: User | null;

  @Column({ name: 'level_closure_signature_data', type: 'text', nullable: true })
  levelClosureSignatureData: string | null;

  @Column({ name: 'final_closure_signed_at', type: 'timestamp', nullable: true })
  finalClosureSignedAt: Date | null;

  @Column({ name: 'final_closure_signed_by_id', type: 'int', nullable: true })
  finalClosureSignedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'final_closure_signed_by_id' })
  finalClosureSignedBy: User | null;

  @Column({ name: 'final_closure_signature_data', type: 'text', nullable: true })
  finalClosureSignatureData: string | null;

  @Column({ name: 'final_closure_remarks', type: 'text', nullable: true })
  finalClosureRemarks: string | null;

  @Column({ name: 'is_skipped', type: 'boolean', default: false })
  isSkipped: boolean;

  @Column({ name: 'skipped_at', type: 'timestamp', nullable: true })
  skippedAt: Date | null;

  @Column({ name: 'skipped_by_id', type: 'int', nullable: true })
  skippedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'skipped_by_id' })
  skippedBy: User | null;

  @Column({ name: 'skip_reason', type: 'text', nullable: true })
  skipReason: string | null;

  @Column({ name: 'initiated_by_id', type: 'int', nullable: true })
  initiatedById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'initiated_by_id' })
  initiatedBy: User | null;

  @CreateDateColumn({ name: 'initiated_at' })
  initiatedAt: Date;

  @OneToMany(() => SnagItem, (item) => item.snagRound)
  items: SnagItem[];

  @OneToMany(() => SnagReleaseApproval, (approval) => approval.snagRound)
  approvals: SnagReleaseApproval[];

  @OneToMany(() => SnagRoundLevelClosure, (closure) => closure.snagRound)
  levelClosures: SnagRoundLevelClosure[];
}
