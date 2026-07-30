import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { QualityActivity } from '../../quality/entities/quality-activity.entity';
import { SnagCommonPoint } from './snag-common-point.entity';
import { SnagProcessStep } from './snag-process-step.entity';

@Entity('snag_process_activity')
@Unique('UQ_snag_process_activity_project_activity', ['projectId', 'activityId'])
export class SnagProcessActivity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'project_id' })
  projectId: number;

  @Column({ name: 'process_step_id' })
  processStepId: number;

  @ManyToOne(() => SnagProcessStep, (step) => step.activities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'process_step_id' })
  processStep: SnagProcessStep;

  @Column({ name: 'activity_id' })
  activityId: number;

  @ManyToOne(() => QualityActivity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activity_id' })
  activity: QualityActivity;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => SnagCommonPoint, (point) => point.processActivity)
  commonPoints: SnagCommonPoint[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
