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

  @Column()
  materialCode: string; // SAP Material/Service Code

  @Column()
  shortText: string; // Description

  @Column({ type: 'decimal', precision: 15, scale: 3, default: 0 })
  quantity: number;

  @Column()
  uom: string; // Unit

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  rate: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  amount: number;

  @Column({ nullable: true })
  longText: string; // Additional spec

  @Column({
    type: 'decimal',
    precision: 15,
    scale: 3,
    default: 0,
    comment: 'Cumulative rolled up execution from mapped BOQ items',
  })
  executedQuantity: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
