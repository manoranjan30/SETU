import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BoqItem } from '../../boq/entities/boq-item.entity';
import { Activity } from '../../wbs/entities/activity.entity';
import { MeasurementElement } from '../../boq/entities/measurement-element.entity';

export enum PlanningBasis {
  INITIAL = 'INITIAL', // Initial budget/plan distribution
  LOOKAHEAD = 'LOOKAHEAD', // Refined plan for near-term
  RECOVERY = 'RECOVERY', // Recovery plan for delayed items
}

export enum MappingType {
  DIRECT = 'DIRECT',
  PROPORTION = 'PROPORTION',
  PHASED = 'PHASED',
}

@Entity('boq_activity_plan')
export class BoqActivityPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @ManyToOne(() => BoqItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'boq_item_id' })
  boqItem: BoqItem;

  @Column({ name: 'boq_item_id' })
  boqItemId: number;

  @ManyToOne(() => Activity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activity_id' })
  activity: Activity;

  @Column({ name: 'activity_id' })
  activityId: number;

  @Column({ nullable: true })
  boqSubItemId: number; // For linking Level 2

  @ManyToOne(() => MeasurementElement, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'measurement_id' })
  measurement: MeasurementElement;

  @Column({ name: 'measurement_id', nullable: true }) // Explicit column name matching join
  measurementId: number; // For linking Level 3/4

  // The portion of the BOQ quantity assigned to this activity
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  plannedQuantity: number;

  @Column({
    type: 'enum',
    enum: PlanningBasis,
    default: PlanningBasis.INITIAL,
  })
  planningBasis: PlanningBasis;

  @Column({
    type: 'enum',
    enum: MappingType,
    default: MappingType.DIRECT,
  })
  mappingType: MappingType;

  @Column({ type: 'json', nullable: true })
  mappingRules: any;

  // Planning Dates (Can differ from Schedule dates for Lookahead/Recovery scenarios)
  @Column({ type: 'date', nullable: true })
  plannedStart: Date | null;

  @Column({ type: 'date', nullable: true })
  plannedFinish: Date | null;

  @CreateDateColumn()
  createdOn: Date;

  @UpdateDateColumn()
  updatedOn: Date;

  @Column({ nullable: true })
  createdBy: string;
}
