import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { MicroScheduleActivity } from './micro-schedule-activity.entity';
import { DelayReason } from './delay-reason.entity';
import { User } from '../../users/user.entity';

@Entity('micro_daily_log')
export class MicroDailyLog {
  @PrimaryGeneratedColumn()
  id: number;

  // Parent Micro Activity
  @ManyToOne(() => MicroScheduleActivity, (activity) => activity.dailyLogs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'microActivityId' })
  microActivity: MicroScheduleActivity;

  @Column()
  microActivityId: number;

  // Log Details
  @Column({ type: 'date' })
  logDate: Date;

  @Column('decimal', { precision: 12, scale: 3 })
  qtyDone: number;

  // Resource Tracking
  @Column({ default: 0 })
  manpowerCount: number;

  @Column('decimal', { precision: 8, scale: 2, default: 0 })
  equipmentHours: number;

  // Delay Tracking
  @ManyToOne(() => DelayReason, { nullable: true })
  @JoinColumn({ name: 'delayReasonId' })
  delayReason: DelayReason;

  @Column({ nullable: true })
  delayReasonId: number;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  // Audit
  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdBy' })
  creator: User;

  @Column()
  createdBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
