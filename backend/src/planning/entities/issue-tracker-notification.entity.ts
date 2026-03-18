import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum IssueNotificationType {
  ISSUE_ASSIGNED = 'ISSUE_ASSIGNED',
  COMMITMENT_DUE_SOON = 'COMMITMENT_DUE_SOON',
  TARGET_DATE_DUE_SOON = 'TARGET_DATE_DUE_SOON',
  OVERDUE = 'OVERDUE',
  COMMITMENT_MISSED = 'COMMITMENT_MISSED',
  DEPT_CLOSED_MOVED = 'DEPT_CLOSED_MOVED',
  ISSUE_CLOSED = 'ISSUE_CLOSED',
}

@Entity('issue_tracker_notifications')
export class IssueTrackerNotification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  recipientUserId: number;

  @Column({ type: 'int' })
  issueId: number;

  @Column({ type: 'int' })
  projectId: number;

  @Column({ type: 'varchar', length: 60 })
  type: IssueNotificationType;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  issueTitle: string | null;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
