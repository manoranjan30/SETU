import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { MicroSchedule } from './micro-schedule.entity';
import { Activity } from '../../wbs/entities/activity.entity';
import { BoqItem } from '../../boq/entities/boq-item.entity';
import { WorkOrder } from '../../workdoc/entities/work-order.entity';
import { EpsNode } from '../../eps/eps.entity';

export enum MicroActivityStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  DELAYED = 'DELAYED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('micro_schedule_activity')
export class MicroScheduleActivity {
  @PrimaryGeneratedColumn()
  id: number;

  // Parent Micro Schedule
  @ManyToOne(() => MicroSchedule, (ms) => ms.activities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'microScheduleId' })
  microSchedule: MicroSchedule;

  @Column()
  microScheduleId: number;

  // Links to Master Data
  @ManyToOne(() => Activity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parentActivityId' })
  parentActivity: Activity;

  @Column()
  parentActivityId: number;

  @ManyToOne(() => BoqItem, { nullable: true })
  @JoinColumn({ name: 'boqItemId' })
  boqItem: BoqItem;

  @Column({ nullable: true })
  boqItemId: number;

  @ManyToOne(() => WorkOrder, { nullable: true })
  @JoinColumn({ name: 'workOrderId' })
  workOrder: WorkOrder;

  @Column({ nullable: true })
  workOrderId: number;

  @ManyToOne(() => EpsNode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'epsNodeId' })
  epsNode: EpsNode;

  @Column()
  epsNodeId: number;

  // Activity Details
  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  // Quantity Allocation
  @Column('decimal', { precision: 12, scale: 3 })
  allocatedQty: number;

  @Column({ length: 20 })
  uom: string;

  // Schedule Dates
  @Column({ type: 'date' })
  plannedStart: Date;

  @Column({ type: 'date' })
  plannedFinish: Date;

  @Column({ type: 'date', nullable: true })
  forecastFinish: Date;

  @Column({ type: 'date', nullable: true })
  actualStart: Date;

  @Column({ type: 'date', nullable: true })
  actualFinish: Date;

  // Progress Tracking
  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  progressPercent: number;

  @Column({ default: 0 })
  varianceDays: number;

  @Column({
    type: 'enum',
    enum: MicroActivityStatus,
    default: MicroActivityStatus.PLANNED,
  })
  status: MicroActivityStatus;

  // Relationships
  @OneToMany('MicroDailyLog', (log: any) => log.microActivity)
  dailyLogs: any[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Soft Delete
  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date;
}
