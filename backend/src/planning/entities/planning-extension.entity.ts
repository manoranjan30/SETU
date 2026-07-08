import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export type PlanningPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type PlanningAssigneeType = 'INTERNAL_USER' | 'VENDOR_USER';

@Entity('project_tasks')
@Index('IDX_project_tasks_project_status', ['projectId', 'status'])
@Index('IDX_project_tasks_assignee_due', ['assignedToUserId', 'dueDate'])
@Index('IDX_project_tasks_activity', ['linkedActivityId'])
export class ProjectTask {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  projectId: number;

  @Column({ type: 'varchar', length: 240 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 32, default: 'TODO' })
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';

  @Column({ type: 'varchar', length: 32, default: 'MEDIUM' })
  priority: PlanningPriority;

  @Column({ type: 'varchar', length: 40, default: 'GENERAL' })
  taskType: string;

  @Column({ type: 'varchar', length: 24, default: 'INTERNAL_USER' })
  assignedToType: PlanningAssigneeType;

  @Column({ type: 'int', nullable: true })
  assignedToUserId: number | null;

  @Column({ type: 'int', nullable: true })
  assignedToTempUserId: number | null;

  @Column({ type: 'int' })
  createdByUserId: number;

  @Column({ type: 'int', nullable: true })
  completedByUserId: number | null;

  @Column({ type: 'int', nullable: true })
  parentTaskId: number | null;

  @Column({ type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ type: 'date', nullable: true })
  startDate: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reminderAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  linkedActivityId: number | null;

  @Column({ type: 'int', nullable: true })
  linkedIssueId: number | null;

  @Column({ type: 'int', nullable: true })
  epsNodeId: number | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  linkedModule: string | null;

  @Column({ type: 'int', nullable: true })
  linkedRecordId: number | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  recurrenceRule: string | null;

  @Column({ type: 'int', default: 0 })
  progressPercent: number;

  @Column({ type: 'int', default: 0 })
  subtaskCount: number;

  @Column({ type: 'int', default: 0 })
  completedSubtaskCount: number;

  @Column({ type: 'int', array: true, default: () => 'ARRAY[]::integer[]' })
  watcherUserIds: number[];

  @Column({ type: 'int', array: true, default: () => 'ARRAY[]::integer[]' })
  watcherTempUserIds: number[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  checklistItems: Array<{ text: string; done?: boolean }>;

  @Column({ type: 'text', array: true, default: () => 'ARRAY[]::text[]' })
  tags: string[];

  @Column({ type: 'text', array: true, default: () => 'ARRAY[]::text[]' })
  attachments: string[];

  @Column({ type: 'int', default: 0 })
  commentsCount: number;

  @Column({ type: 'timestamp', nullable: true })
  lastActivityAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('project_task_comments')
@Index('IDX_project_task_comments_task', ['taskId', 'createdAt'])
export class ProjectTaskComment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  taskId: number;

  @Column({ type: 'int' })
  projectId: number;

  @Column({ type: 'int' })
  authorUserId: number;

  @Column({ type: 'text' })
  comment: string;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('followup_actions')
@Index('IDX_followup_actions_project_status', ['projectId', 'status'])
@Index('IDX_followup_actions_assignee_due', ['assignedToUserId', 'dueDate'])
export class FollowUpAction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  projectId: number;

  @Column({ type: 'text' })
  actionItem: string;

  @Column({ type: 'int' })
  raisedByUserId: number;

  @Column({ type: 'int' })
  assignedToUserId: number;

  @Column({ type: 'varchar', length: 24, default: 'INTERNAL_USER' })
  assignedToType: PlanningAssigneeType;

  @Column({ type: 'int', nullable: true })
  assignedToTempUserId: number | null;

  @Column({ type: 'date' })
  raisedDate: string;

  @Column({ type: 'date' })
  dueDate: string;

  @Column({ type: 'date', nullable: true })
  closedDate: string | null;

  @Column({ type: 'int', nullable: true })
  closedByUserId: number | null;

  @Column({ type: 'varchar', length: 32, default: 'OPEN' })
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED' | 'OVERDUE';

  @Column({ type: 'varchar', length: 32, default: 'MEDIUM' })
  priority: 'LOW' | 'MEDIUM' | 'HIGH';

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({ type: 'int', nullable: true })
  linkedIssueId: number | null;

  @Column({ type: 'int', nullable: true })
  linkedTaskId: number | null;

  @Column({ type: 'varchar', length: 220, nullable: true })
  meetingReference: string | null;

  @Column({ type: 'date', nullable: true })
  meetingDate: string | null;

  @Column({ type: 'varchar', length: 40, default: 'GENERAL' })
  followupType: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  sourceModule: string | null;

  @Column({ type: 'int', nullable: true })
  sourceRecordId: number | null;

  @Column({ type: 'int', nullable: true })
  epsNodeId: number | null;

  @Column({ type: 'varchar', length: 260, nullable: true })
  locationText: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reminderAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  nextReminderAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastReminderSentAt: Date | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  repeatRule: string | null;

  @Column({ type: 'text', nullable: true })
  closureRemarks: string | null;

  @Column({ type: 'int', array: true, default: () => 'ARRAY[]::integer[]' })
  watcherUserIds: number[];

  @Column({ type: 'int', array: true, default: () => 'ARRAY[]::integer[]' })
  watcherTempUserIds: number[];

  @Column({ type: 'text', array: true, default: () => 'ARRAY[]::text[]' })
  attachments: string[];

  @Column({ type: 'int', default: 0 })
  commentsCount: number;

  @Column({ type: 'timestamp', nullable: true })
  lastActivityAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('site_journal_entries')
@Unique('UQ_site_journal_project_date', ['projectId', 'date'])
@Index('IDX_site_journal_project_date', ['projectId', 'date'])
export class SiteJournalEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  projectId: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'int' })
  authorUserId: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  weather: 'SUNNY' | 'CLOUDY' | 'RAINY' | 'FOGGY' | null;

  @Column({ type: 'varchar', length: 32, default: 'DRAFT' })
  status: 'DRAFT' | 'SUBMITTED' | 'LOCKED';

  @Column({ type: 'varchar', length: 40, default: 'DAILY_PROGRESS' })
  journalType: string;

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'text', nullable: true })
  workDoneToday: string | null;

  @Column({ type: 'text', nullable: true })
  issuesRaised: string | null;

  @Column({ type: 'text', nullable: true })
  safetyObservations: string | null;

  @Column({ type: 'text', nullable: true })
  qualityObservations: string | null;

  @Column({ type: 'text', nullable: true })
  progressNotes: string | null;

  @Column({ type: 'text', nullable: true })
  decisionsTaken: string | null;

  @Column({ type: 'text', nullable: true })
  instructionsGiven: string | null;

  @Column({ type: 'text', nullable: true })
  materialReceived: string | null;

  @Column({ type: 'text', nullable: true })
  delaysOrConstraints: string | null;

  @Column({ type: 'text', nullable: true })
  tomorrowPlan: string | null;

  @Column({ type: 'int', nullable: true })
  laborCount: number | null;

  @Column({ type: 'text', nullable: true })
  equipmentOnSite: string | null;

  @Column({ type: 'text', nullable: true })
  visitorsOnSite: string | null;

  @Column({ type: 'int', nullable: true })
  epsNodeId: number | null;

  @Column({ type: 'varchar', length: 260, nullable: true })
  locationText: string | null;

  @Column({ type: 'int', array: true, default: () => 'ARRAY[]::integer[]' })
  linkedActivityIds: number[];

  @Column({ type: 'int', array: true, default: () => 'ARRAY[]::integer[]' })
  linkedTaskIds: number[];

  @Column({ type: 'int', array: true, default: () => 'ARRAY[]::integer[]' })
  linkedFollowupIds: number[];

  @Column({ type: 'int', array: true, default: () => 'ARRAY[]::integer[]' })
  linkedRfiIds: number[];

  @Column({ type: 'text', array: true, default: () => 'ARRAY[]::text[]' })
  photoUrls: string[];

  @Column({ type: 'text', array: true, default: () => 'ARRAY[]::text[]' })
  attachments: string[];

  @Column({ type: 'text', array: true, default: () => 'ARRAY[]::text[]' })
  tags: string[];

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lockedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
