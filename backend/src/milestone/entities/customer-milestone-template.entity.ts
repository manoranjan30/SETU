import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EpsNode } from '../../eps/eps.entity';
import { Activity } from '../../wbs/entities/activity.entity';
import { QualityActivity } from '../../quality/entities/quality-activity.entity';
import { User } from '../../users/user.entity';
import { CustomerMilestoneAchievement } from './customer-milestone-achievement.entity';
import { CustomerMilestoneTemplateActivityLink } from './customer-milestone-template-activity-link.entity';

export enum CustomerMilestoneTriggerType {
  QUALITY_APPROVED = 'QUALITY_APPROVED',
  PROGRESS_PCT = 'PROGRESS_PCT',
  SNAG_ROUND_RELEASED = 'SNAG_ROUND_RELEASED',
  MANUAL = 'MANUAL',
}

export enum CustomerMilestoneApplicability {
  ALL_UNITS = 'all_units',
  TOWER = 'tower',
  FLOOR = 'floor',
  UNIT = 'unit',
}

@Entity('customer_milestone_template')
export class CustomerMilestoneTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'project_id' })
  projectId: number;

  @ManyToOne(() => EpsNode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: EpsNode;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'int', default: 1 })
  sequence: number;

  @Column({ name: 'collection_pct', type: 'decimal', precision: 5, scale: 2 })
  collectionPct: string;

  @Column({
    name: 'trigger_type',
    type: 'enum',
    enum: CustomerMilestoneTriggerType,
  })
  triggerType: CustomerMilestoneTriggerType;

  @Column({ name: 'trigger_activity_id', type: 'int', nullable: true })
  triggerActivityId: number | null;

  @ManyToOne(() => Activity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'trigger_activity_id' })
  triggerActivity: Activity | null;

  @Column({
    name: 'trigger_quality_activity_id',
    type: 'int',
    nullable: true,
  })
  triggerQualityActivityId: number | null;

  @ManyToOne(() => QualityActivity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'trigger_quality_activity_id' })
  triggerQualityActivity: QualityActivity | null;

  @Column({ name: 'trigger_snag_round', type: 'int', nullable: true })
  triggerSnagRound: number | null;

  @Column({
    name: 'trigger_progress_pct',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  triggerProgressPct: string | null;

  @Column({
    name: 'applicable_to',
    type: 'enum',
    enum: CustomerMilestoneApplicability,
    default: CustomerMilestoneApplicability.ALL_UNITS,
  })
  applicableTo: CustomerMilestoneApplicability;

  @Column({ name: 'applicable_eps_ids', type: 'int', array: true, nullable: true })
  applicableEpsIds: number[] | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'allow_manual_completion', type: 'boolean', default: true })
  allowManualCompletion: boolean;

  @Column({ name: 'created_by_id', type: 'int', nullable: true })
  createdById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User | null;

  @OneToMany(
    () => CustomerMilestoneAchievement,
    (achievement) => achievement.template,
  )
  achievements: CustomerMilestoneAchievement[];

  @OneToMany(() => CustomerMilestoneTemplateActivityLink, (link) => link.template, {
    cascade: true,
  })
  activityLinks: CustomerMilestoneTemplateActivityLink[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
