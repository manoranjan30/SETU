import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { WorkCalendar } from './work-calendar.entity';

@Entity('WorkWeek')
export class WorkWeek {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string; // e.g., "Standard", "6-Day Work Week"

  @ManyToOne('WorkCalendar', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'calendar_id' })
  calendar: any;

  @Column({ type: 'date', nullable: true })
  fromDate: Date; // Inclusive

  @Column({ type: 'date', nullable: true })
  toDate: Date; // Inclusive

  // Store as string array "0,1,2..." (0=Sun) or "1,2,3..." depending on convention.
  // SETU Convention: 0=Sunday, 1=Monday ... 6=Saturday
  @Column('simple-array')
  workingDays: string[];
}
