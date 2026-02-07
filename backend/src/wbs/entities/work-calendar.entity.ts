import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import type { WorkWeek } from './work-week.entity';

@Entity('WorkCalendar')
export class WorkCalendar {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: false })
  isDefault: boolean;

  // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  // Default: Mon(1) to Fri(5)
  @Column('simple-array', { default: '1,2,3,4,5' })
  workingDays: string[];

  // ISO Date Strings "YYYY-MM-DD"
  @Column('simple-array', { default: '' })
  holidays: string[];

  @Column({ default: '09:00' })
  defaultStartTime: string;

  @Column({ default: '17:00' })
  defaultEndTime: string;

  // Daily working hours (e.g., 8, 9, 24)
  @Column({ type: 'decimal', precision: 4, scale: 2, default: 8.0 })
  dailyWorkHours: number;

  @CreateDateColumn()
  createdOn: Date;

  @UpdateDateColumn()
  updatedOn: Date;

  // Manual Relation Management to avoid Circular Dependency
  workWeeks?: WorkWeek[];
}
