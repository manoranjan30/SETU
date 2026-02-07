import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Activity } from '../../wbs/entities/activity.entity';

@Entity('recovery_plan')
export class RecoveryPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @ManyToOne(() => Activity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activity_id' })
  activity: Activity;

  @Column()
  activityId: number;

  @Column({ type: 'text', nullable: true })
  reasonForDelay: string;

  @Column({ type: 'text' })
  recoveryStrategy: string;

  // Revised duration for the recovery
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  revisedDuration: number;

  // New target finish date based on recovery plan
  @Column({ type: 'date', nullable: true })
  targetFinish: Date;

  @Column({ type: 'text', nullable: true })
  additionalResourcesRequired: string;

  @Column({ default: 'PROPOSED' })
  status: string; // PROPOSED, APPROVED, REJECTED, EXECUTED

  @CreateDateColumn()
  createdOn: Date;

  @UpdateDateColumn()
  updatedOn: Date;

  @Column({ nullable: true })
  createdBy: string;
}
