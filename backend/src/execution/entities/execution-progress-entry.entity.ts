import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WorkOrder } from '../../workdoc/entities/work-order.entity';
import { WorkOrderItem } from '../../workdoc/entities/work-order-item.entity';
import { Activity } from '../../wbs/entities/activity.entity';
import { WoActivityPlan } from '../../planning/entities/wo-activity-plan.entity';
import { EpsNode } from '../../eps/eps.entity';
import { MicroScheduleActivity } from '../../micro-schedule/entities/micro-schedule-activity.entity';

export enum ExecutionProgressEntryStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('execution_progress_entry')
export class ExecutionProgressEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @ManyToOne(() => WorkOrder, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'workOrderId' })
  workOrder: WorkOrder | null;

  @Column({ type: 'integer', nullable: true })
  workOrderId: number | null;

  @ManyToOne(() => WorkOrderItem, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'workOrderItemId' })
  workOrderItem: WorkOrderItem | null;

  @Column({ type: 'integer', nullable: true })
  workOrderItemId: number | null;

  @ManyToOne(() => Activity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'activityId' })
  activity: Activity | null;

  @Column({ type: 'integer', nullable: true })
  activityId: number | null;

  @ManyToOne(() => WoActivityPlan, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'woActivityPlanId' })
  woActivityPlan: WoActivityPlan | null;

  @Column({ type: 'integer', nullable: true })
  woActivityPlanId: number | null;

  @ManyToOne(() => EpsNode, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'executionEpsNodeId' })
  executionEpsNode: EpsNode | null;

  @Column({ type: 'integer', nullable: true })
  executionEpsNodeId: number | null;

  @ManyToOne(() => MicroScheduleActivity, {
    nullable: true,
    onDelete: 'SET NULL',
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'microActivityId' })
  microActivity: MicroScheduleActivity | null;

  @Column({ type: 'integer', nullable: true })
  microActivityId: number | null;

  @Column({ type: 'date' })
  entryDate: Date;

  @Column('decimal', { precision: 12, scale: 3 })
  enteredQty: number;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({
    type: 'enum',
    enum: ExecutionProgressEntryStatus,
    default: ExecutionProgressEntryStatus.PENDING,
  })
  status: ExecutionProgressEntryStatus;

  @Column({ type: 'varchar', nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar', nullable: true })
  approvedBy: string | null;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'integer', nullable: true })
  legacyMeasurementProgressId: number | null;

  @Column({ type: 'integer', nullable: true })
  legacyQuantityProgressRecordId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
