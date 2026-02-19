import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { WorkOrder } from './work-order.entity';

@Entity('work_order_items')
export class WorkOrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => WorkOrder, (wo) => wo.items, { onDelete: 'CASCADE' })
  workOrder: WorkOrder;

  @Column({ nullable: true })
  serialNumber: string; // Hierarchical serial: 10, 10.1, 10.2, 20, 20.1, etc.

  @Column({ nullable: true })
  parentSerialNumber: string; // Parent's serial number (e.g., "10" for "10.1")

  @Column({ default: 0 })
  level: number; // 0 for parent items, 1+ for children

  @Column({ default: false })
  isParent: boolean; // True for group/parent items (amount only, no qty*rate)

  @Column()
  materialCode: string; // SAP Material/Service Code

  @Column()
  shortText: string; // Description

  @Column({ type: 'text', nullable: true })
  longText: string; // Additional spec / Detail description

  @Column()
  uom: string; // Unit

  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0 })
  quantity: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  rate: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  amount: number; // Imported amount from file

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  calculatedAmount: number; // qty * rate (for children) or sum of children (for parents)

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 3,
    default: 0,
    comment: 'Cumulative rolled up execution from mapped BOQ items',
  })
  executedQuantity: number;

  // --- BOQ Mapping Fields ---
  @Column({ nullable: true })
  boqItemId: number;

  @ManyToOne('BoqItem', { nullable: true })
  boqItem: any; // Using 'any' to avoid strict circular dependency issues if needed, or better use explicit type if possible

  @Column({
    type: 'enum',
    enum: ['PENDING', 'AUTO_CODE', 'AUTO_DESC', 'MANUAL'],
    default: 'PENDING',
  })
  mappingStatus: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
