import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('issue_tracker_activity_log')
export class IssueTrackerActivityLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  issueId: number;

  @Column({ type: 'int' })
  projectId: number;

  @Column({ type: 'varchar', length: 60 })
  action: string;
  // 'CREATED' | 'RESPONDED' | 'COORDINATOR_CLOSED' | 'STEP_MOVED'
  // 'COMMITMENT_DATE_CHANGED' | 'PRIORITY_CHANGED' | 'FLOW_EDITED'
  // 'ISSUE_CLOSED' | 'ATTACHMENT_ADDED' | 'DEPARTMENT_ADDED' | 'DEPARTMENT_REMOVED'

  @Column({ type: 'text', nullable: true })
  detail: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'int', nullable: true })
  actorUserId: number | null;

  @Column({ type: 'varchar', length: 150 })
  actorName: string;

  @CreateDateColumn()
  createdAt: Date;
}
