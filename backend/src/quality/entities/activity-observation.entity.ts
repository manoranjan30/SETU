import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { QualityActivity } from './quality-activity.entity';
import { QualityInspection } from './quality-inspection.entity';
import { QualityInspectionStage } from './quality-inspection-stage.entity';

export enum ActivityObservationStatus {
  PENDING = 'PENDING',
  RECTIFIED = 'RECTIFIED',
  CLOSED = 'CLOSED',
  RESOLVED = 'RESOLVED', // Keeping for backward compatibility temporarily
}

export interface ActivityObservationRectificationHistoryEntry {
  type: 'RECTIFIED' | 'REJECTED';
  text?: string | null;
  photos?: string[];
  rejectionRemarks?: string | null;
  actorId?: string | null;
  at: string;
}

@Entity('activity_observations')
export class ActivityObservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  activityId: number;

  @ManyToOne(() => QualityActivity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activityId' })
  activity: QualityActivity;

  @Column({ type: 'int', nullable: true })
  checklistId: number; // Optional context pointer

  @Column({ type: 'int', nullable: true })
  inspectionId: number; // FK -> quality_inspections.id

  @ManyToOne(() => QualityInspection, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'inspectionId' })
  inspection: QualityInspection;

  @Column({ type: 'int', nullable: true })
  stageId: number | null;

  @ManyToOne(() => QualityInspectionStage, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'stageId' })
  stage: QualityInspectionStage | null;

  @Column({ type: 'text', nullable: true })
  inspectorId: string; // Foreign Key to User (string based on current app pattern)

  @Column({ type: 'text', nullable: true })
  type: string; // e.g. Major, Minor, Critical

  @Column({ type: 'text' })
  observationText: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column('text', { array: true, default: [] })
  photos: string[];

  @Column({ type: 'text', nullable: true })
  closureText: string;

  @Column('text', { array: true, default: [] })
  closureEvidence: string[];

  @Column({
    type: 'enum',
    enum: ActivityObservationStatus,
    default: ActivityObservationStatus.PENDING,
  })
  status: ActivityObservationStatus;

  @Column({ type: 'text', nullable: true })
  resolvedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @Column({ type: 'text', nullable: true })
  rectificationRejectedRemarks: string | null;

  @Column({ type: 'text', nullable: true })
  rectificationRejectedBy: string | null;

  @Column({ type: 'timestamp', nullable: true })
  rectificationRejectedAt: Date | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  rectificationHistory: ActivityObservationRectificationHistoryEntry[];

  @CreateDateColumn()
  createdAt: Date;
}
