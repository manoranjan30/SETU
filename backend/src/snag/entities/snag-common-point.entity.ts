import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QualityActivity } from '../../quality/entities/quality-activity.entity';
import { SnagProcessActivity } from './snag-process-activity.entity';

@Entity('snag_common_point')
export class SnagCommonPoint {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'project_id' })
  projectId: number;

  @Column({ name: 'process_activity_id' })
  processActivityId: number;

  @ManyToOne(() => SnagProcessActivity, (activity) => activity.commonPoints, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'process_activity_id' })
  processActivity: SnagProcessActivity;

  @Column({ name: 'activity_id' })
  activityId: number;

  @ManyToOne(() => QualityActivity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activity_id' })
  activity: QualityActivity;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 40, default: 'medium' })
  severity: string;

  @Column({ name: 'requires_evidence', type: 'boolean', default: false })
  requiresEvidence: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
