import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { QualityActivity } from './quality-activity.entity';
import { QualityActivityList } from './quality-activity-list.entity';
import { EpsNode } from '../../eps/eps.entity';
import { QualityInspectionStage } from './quality-inspection-stage.entity';

export enum InspectionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELED = 'CANCELED',
}

@Entity('quality_inspections')
export class QualityInspection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column({ nullable: true })
  epsNodeId: number;

  @ManyToOne(() => EpsNode, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'epsNodeId' })
  epsNode: EpsNode;

  @Column()
  listId: number;

  @ManyToOne(() => QualityActivityList, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listId' })
  list: QualityActivityList;

  @Column()
  activityId: number;

  @ManyToOne(() => QualityActivity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activityId' })
  activity: QualityActivity;

  @Column({ type: 'int', default: 0 })
  sequence: number; // Snapshot of sequence at creation

  @Column({
    type: 'enum',
    enum: InspectionStatus,
    default: InspectionStatus.PENDING,
  })
  status: InspectionStatus;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  requestDate: string;

  @Column({ type: 'date', nullable: true })
  inspectionDate: string;

  @Column({ nullable: true })
  inspectedBy: string; // User ID or Name

  @Column({ type: 'text', nullable: true })
  comments: string;

  @OneToMany(() => QualityInspectionStage, (stage) => stage.inspection, {
    cascade: true,
  })
  stages: QualityInspectionStage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
