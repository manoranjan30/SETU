import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
  OneToOne,
  Index,
} from 'typeorm';
import { WbsNode } from './wbs.entity';
import { ActivitySchedule } from './activity-schedule.entity';

export enum ActivityType {
  TASK = 'TASK',
  MILESTONE = 'MILESTONE',
}

export enum ActivityStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

@Entity()
@Unique(['projectId', 'activityCode'])
@Index(['projectId', 'mspUid'], { unique: true })
export class Activity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @ManyToOne(() => WbsNode, (node) => node.activities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'wbs_node_id' })
  wbsNode: WbsNode;

  @Column()
  activityCode: string;

  @Column()
  activityName: string;

  @Column({ type: 'varchar', nullable: true })
  mspUid: string | null;

  @Column({
    type: 'enum',
    enum: ActivityType,
    default: ActivityType.TASK,
  })
  activityType: ActivityType;

  @Column({
    type: 'enum',
    enum: ActivityStatus,
    default: ActivityStatus.NOT_STARTED,
  })
  status: ActivityStatus;

  // Scheduling Fields
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  durationPlanned: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  durationActual: number;

  @Column({ type: 'date', nullable: true })
  startDatePlanned: Date | null;

  @Column({ type: 'date', nullable: true })
  finishDatePlanned: Date | null;

  @Column({ type: 'date', nullable: true })
  startDateBaseline: Date | null;

  @Column({ type: 'date', nullable: true })
  finishDateBaseline: Date | null;

  @Column({ type: 'date', nullable: true, name: 'start_date_msp' })
  startDateMSP: Date | null;

  @Column({ type: 'date', nullable: true, name: 'finish_date_msp' })
  finishDateMSP: Date | null;

  @Column({ type: 'date', nullable: true })
  startDateActual: Date | null;

  @Column({ type: 'date', nullable: true })
  finishDateActual: Date | null;

  @Column({ default: false })
  isMilestone: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  percentComplete: number;

  // Financial Tracking
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  budgetedValue: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  actualValue: number;

  // Responsibility
  @Column({ nullable: true })
  responsibleRoleId: number;

  @Column({ nullable: true })
  responsibleUserId: number;

  // Audit
  @CreateDateColumn()
  createdOn: Date;

  @Column()
  createdBy: string;

  @OneToOne(() => ActivitySchedule, (schedule) => schedule.activity)
  schedule: ActivitySchedule;

  @Column({ nullable: true })
  masterActivityId: number;

  @ManyToOne(() => Activity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'masterActivityId' })
  masterActivity: Activity;
}
