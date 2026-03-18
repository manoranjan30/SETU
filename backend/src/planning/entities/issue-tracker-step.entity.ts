import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum IssueTrackerStepStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
}

export interface CommittedDateRecord {
  previousDate: string | null;
  newDate: string;
  changedAt: string;
  changedByName: string;
  reason: string;
}

@Entity('issue_tracker_steps')
export class IssueTrackerStep {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  issueId: number;

  @Column({ type: 'int' })
  projectId: number;

  @Column({ type: 'int' })
  sequenceNo: number;

  @Column({ type: 'int' })
  departmentId: number;

  @Column({ type: 'varchar', length: 150 })
  departmentName: string;

  @Column({ type: 'varchar', length: 20, default: IssueTrackerStepStatus.PENDING })
  status: IssueTrackerStepStatus;

  @Column({ type: 'int', nullable: true })
  slaDays: number | null;

  @Column({ type: 'text', nullable: true })
  responseText: string | null;

  @Column({ type: 'date', nullable: true })
  committedCompletionDate: string | null;

  @Column({ type: 'jsonb', nullable: true })
  committedDateHistory: CommittedDateRecord[] | null;

  @Column({ type: 'timestamptz', nullable: true })
  respondedDate: Date | null;

  @Column({ type: 'int', nullable: true })
  respondedByUserId: number | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  respondedByName: string | null;

  // Coordinator close fields
  @Column({ type: 'text', nullable: true })
  coordinatorRemarks: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  coordinatorClosedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  coordinatorClosedById: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  memberRespondedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
