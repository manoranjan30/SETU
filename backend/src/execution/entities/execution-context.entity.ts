import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EpsNode } from '../../eps/eps.entity';
import { BoqElement } from '../../boq/entities/boq-element.entity';
import { Activity } from '../../wbs/entities/activity.entity';

@Entity()
export class ExecutionContext {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  // 1. WHERE (Granular Location)
  @ManyToOne(() => EpsNode, { onDelete: 'CASCADE' })
  epsNode: EpsNode; // e.g., "Tower A -> Floor 1"

  // 2. WHAT (Scope)
  @ManyToOne(() => BoqElement, { onDelete: 'CASCADE' })
  boqElement: BoqElement; // "Concrete M25"

  // 3. HOW/WHEN (Schedule)
  @ManyToOne(() => Activity, { onDelete: 'SET NULL', nullable: true })
  activity: Activity; // "Pouring Concrete"

  // 4. THE DATA
  @Column('decimal', { precision: 12, scale: 2 })
  plannedQuantity: number; // Allocation for this specific context

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  actualQuantity: number; // Progress log

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  remainingQuantity: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  percentComplete: number; // 0-100% of THIS context

  @Column({
    type: 'enum',
    enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'],
    default: 'NOT_STARTED',
  })
  status: string;

  @Column({ type: 'date', nullable: true })
  actualStartDate: Date;

  @Column({ type: 'date', nullable: true })
  actualFinishDate: Date;

  @CreateDateColumn()
  createdOn: Date;

  @UpdateDateColumn()
  updatedOn: Date;
}
