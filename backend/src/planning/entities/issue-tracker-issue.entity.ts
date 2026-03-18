import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum IssueTrackerStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CLOSED = 'CLOSED',
}

export enum IssuePriority {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

@Entity('issue_tracker_issues')
export class IssueTrackerIssue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  projectId: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  issueNumber: string | null;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb' })
  tagIds: number[];

  @Column({ type: 'jsonb', nullable: true })
  tagNames: string[] | null;

  @Column({ type: 'int', nullable: true })
  raisedByUserId: number | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  raisedByName: string | null;

  @Column({ type: 'timestamptz' })
  raisedDate: Date;

  @Column({ type: 'date', nullable: true })
  requiredDate: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  respondedDate: Date | null;

  @Column({ type: 'date', nullable: true })
  committedCompletionDate: string | null;

  @Column({ type: 'varchar', length: 20, default: IssueTrackerStatus.OPEN })
  status: IssueTrackerStatus;

  @Column({ type: 'varchar', length: 20, default: IssuePriority.MEDIUM })
  priority: IssuePriority;

  @Column({ type: 'int', nullable: true })
  currentDepartmentId: number | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  currentDepartmentName: string | null;

  @Column({ type: 'int', default: 0 })
  currentStepIndex: number;

  @Column({ type: 'jsonb', nullable: true })
  customFlowDepartmentIds: number[] | null;

  @Column({ type: 'int', default: 0 })
  attachmentCount: number;

  @Column({ type: 'int', default: 0 })
  commentCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  closedDate: Date | null;

  @Column({ type: 'text', nullable: true })
  closedRemarks: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  closedByName: string | null;

  @Column({ type: 'int', nullable: true })
  closedByUserId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
