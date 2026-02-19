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

@Entity('micro_quantity_ledger')
@Index(['parentActivityId', 'boqItemId'], { unique: true })
export class MicroQuantityLedger {
  @PrimaryGeneratedColumn()
  id: number;

  // Parent Activity from Master Schedule
  @ManyToOne(() => Activity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parentActivityId' })
  parentActivity: Activity;

  @Column()
  parentActivityId: number;

  // Optional Work Order Link
  @ManyToOne(() => WorkOrder, { nullable: true })
  @JoinColumn({ name: 'workOrderId' })
  workOrder: WorkOrder;

  @Column({ nullable: true })
  workOrderId: number;

  // BOQ Item Link
  @ManyToOne(() => BoqItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'boqItemId' })
  boqItem: BoqItem;

  @Column()
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
