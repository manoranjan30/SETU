import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CustomReport } from './custom-report.entity';

@Entity('report_schedule')
export class ReportSchedule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  reportId: number;

  @OneToOne(() => CustomReport, (report) => report.schedule, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reportId' })
  report: CustomReport;

  @Column({ type: 'varchar', length: 20 })
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';

  @Column({ nullable: true })
  cronExpression: string;

  @Column({ type: 'varchar', length: 20, default: 'PDF' })
  format: 'PDF' | 'EXCEL' | 'CSV';

  @Column({ type: 'jsonb', nullable: true })
  recipients: string[]; // array of emails or userIds

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastRunAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  nextRunAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
