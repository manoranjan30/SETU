import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { Activity } from '../../wbs/entities/activity.entity';
import { BoqItem } from '../../boq/entities/boq-item.entity';
import { WorkOrder } from '../../workdoc/entities/work-order.entity';
import { WorkOrderItem } from '../../workdoc/entities/work-order-item.entity';
import { Vendor } from '../../workdoc/entities/vendor.entity';

@Entity('micro_quantity_ledger')
@Index(['parentActivityId', 'workOrderItemId'], { unique: true })
export class MicroQuantityLedger {
  @PrimaryGeneratedColumn()
  id: number;

  // Parent Activity from Master Schedule
  @ManyToOne(() => Activity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parentActivityId' })
  parentActivity: Activity;

  @Column()
  parentActivityId: number;

  // Primary: WO Item (source of quantity)
  @ManyToOne(() => WorkOrderItem, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workOrderItemId' })
  workOrderItem: WorkOrderItem;

  @Column({ nullable: true })
  workOrderItemId: number;

  // WO context
  @ManyToOne(() => WorkOrder, { nullable: true })
  @JoinColumn({ name: 'workOrderId' })
  workOrder: WorkOrder;

  @Column({ nullable: true })
  workOrderId: number;

  // Vendor traceability
  @ManyToOne(() => Vendor, { nullable: true })
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @Column({ nullable: true })
  vendorId: number;

  // BOQ Item (derived from WO Item, for reports)
  @ManyToOne(() => BoqItem, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'boqItemId' })
  boqItem: BoqItem;

  @Column({ nullable: true })
  boqItemId: number;

  // Quantity Tracking
  @Column('decimal', { precision: 12, scale: 3 })
  totalParentQty: number;

  @Column('decimal', { precision: 12, scale: 3, default: 0 })
  allocatedQty: number; // Sum of all micro activity allocations

  @Column('decimal', { precision: 12, scale: 3, default: 0 })
  consumedQty: number; // Sum of all daily logs

  @Column('decimal', { precision: 12, scale: 3, default: 0 })
  balanceQty: number; // Computed: totalParentQty - allocatedQty

  @Column({ length: 20 })
  uom: string;

  // Reconciliation
  @Column({ type: 'timestamp', nullable: true })
  lastReconciled: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
