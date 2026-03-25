import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { WorkOrder } from './work-order.entity';
import { BoqItem } from '../../boq/entities/boq-item.entity';
import { BoqSubItem } from '../../boq/entities/boq-sub-item.entity';
import { MeasurementElement } from '../../boq/entities/measurement-element.entity';

export enum WorkOrderItemNodeType {
  ITEM = 'ITEM',
  SUB_ITEM = 'SUB_ITEM',
  MEASUREMENT = 'MEASUREMENT',
}

@Entity('work_order_items')
export class WorkOrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => WorkOrder, (wo) => wo.items, { onDelete: 'CASCADE' })
  workOrder: WorkOrder;

  // === BOQ Linkage (Source of Truth) ===

  @ManyToOne(() => BoqItem, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'boqItemId' })
  boqItem: BoqItem;

  @Column({ nullable: true })
  boqItemId: number;

  @ManyToOne(() => BoqSubItem, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'boqSubItemId' })
  boqSubItem: BoqSubItem;

  @Column({ nullable: true })
  boqSubItemId: number;

  @ManyToOne(() => MeasurementElement, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'measurementElementId' })
  measurementElement: MeasurementElement;

  @Column({ nullable: true })
  measurementElementId: number;

  @Column({
    type: 'enum',
    enum: WorkOrderItemNodeType,
    default: WorkOrderItemNodeType.ITEM,
  })
  nodeType: WorkOrderItemNodeType;

  @ManyToOne(() => WorkOrderItem, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parentWorkOrderItemId' })
  parentWorkOrderItem: WorkOrderItem | null;

  @Column({ nullable: true })
  parentWorkOrderItemId: number | null;

  // Hierarchy level: 0=Item, 1=SubItem, 2=Measurement
  @Column({ default: 0 })
  level: number;

  // === Item Details ===

  @Column()
  description: string;

  @Column({ nullable: true })
  materialCode: string;

  @Column({ length: 30 })
  uom: string;

  @Column({ nullable: true })
  serialNumber: string;

  @Column({ nullable: true })
  parentSerialNumber: string;

  @Column({ default: false })
  isParent: boolean;

  // BOQ Qty snapshot (frozen at time of assignment)
  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0 })
  boqQty: number;

  // Qty assigned from BOQ to this WO (full or partial)
  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0 })
  allocatedQty: number;

  // WO-specific rate (independent of BOQ rate)
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  rate: number;

  // allocatedQty × rate
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  amount: number;

  // Cumulative executed quantity from progress
  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0 })
  executedQuantity: number;

  // === WO Reference Fields (for external WO monitoring) ===

  @Column({ type: 'text', nullable: true })
  woRefText: string;

  @Column({ type: 'json', nullable: true })
  woRefColumnData: any;

  // === Status ===

  @Column({ default: 'ACTIVE' })
  status: string; // ACTIVE, COMPLETED, CANCELLED

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
