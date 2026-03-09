import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WorkOrderItem } from '../../workdoc/entities/work-order-item.entity';
import { WorkOrder } from '../../workdoc/entities/work-order.entity';
import { Vendor } from '../../workdoc/entities/vendor.entity';
import { BoqItem } from '../../boq/entities/boq-item.entity';
import { Activity } from '../../wbs/entities/activity.entity';
import { MeasurementElement } from '../../boq/entities/measurement-element.entity';

export enum PlanningBasis {
  INITIAL = 'INITIAL',
  LOOKAHEAD = 'LOOKAHEAD',
  RECOVERY = 'RECOVERY',
}

export enum MappingType {
  DIRECT = 'DIRECT',
  PROPORTION = 'PROPORTION',
  PHASED = 'PHASED',
}

@Entity('wo_activity_plan')
export class WoActivityPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  // Primary mapping source: WO Item
  @ManyToOne(() => WorkOrderItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'work_order_item_id' })
  workOrderItem: WorkOrderItem;

  @Column({ name: 'work_order_item_id' })
  workOrderItemId: number;

  // WO context
  @ManyToOne(() => WorkOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'work_order_id' })
  workOrder: WorkOrder;

  @Column({ name: 'work_order_id' })
  workOrderId: number;

  // Vendor traceability
  @ManyToOne(() => Vendor, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @Column({ name: 'vendor_id', nullable: true })
  vendorId: number;

  // BOQ reference (derived from WO Item)
  @ManyToOne(() => BoqItem, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'boq_item_id' })
  boqItem: BoqItem;

  @Column({ name: 'boq_item_id', nullable: true })
  boqItemId: number;

  // Schedule activity target
  @ManyToOne(() => Activity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activity_id' })
  activity: Activity;

  @Column({ name: 'activity_id' })
  activityId: number;

  // Optional granular measurement link
  @ManyToOne(() => MeasurementElement, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'measurement_id' })
  measurement: MeasurementElement;

  @Column({ name: 'measurement_id', nullable: true })
  measurementId: number;

  // Sub-item level granularity (backward compat with planning service)
  @Column({ nullable: true })
  boqSubItemId: number;

  // WO Qty portion assigned to this activity
  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
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
