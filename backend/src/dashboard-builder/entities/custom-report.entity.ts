import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { ReportSchedule } from './report-schedule.entity';

@Entity('custom_report')
export class CustomReport {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 50, default: 'TABULAR' })
  reportType: 'TABULAR' | 'VISUAL' | 'MATRIX' | 'SUMMARY';

  @Column({ type: 'varchar', length: 100 })
  dataSourceKey: string;

  @Column({ type: 'jsonb', nullable: true })
  columns: any; // fields selected

  @Column({ type: 'jsonb', nullable: true })
  filters: any; // static filters applied

  @Column({ type: 'jsonb', nullable: true })
  groupBy: any;

  @Column({ type: 'jsonb', nullable: true })
  sorting: any;

  @Column({ type: 'jsonb', nullable: true })
  formatting: any; // conditional formatting

  @Column({ type: 'jsonb', nullable: true })
  chartConfig: any; // if VISUAL

  @Column({ nullable: true })
  createdById: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column({ default: false })
  isShared: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => ReportSchedule, (schedule) => schedule.report, {
    cascade: true,
  })
  schedule: ReportSchedule;
}
