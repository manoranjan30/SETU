import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { WorkOrderItem } from './work-order-item.entity';
import { BoqItem } from '../../boq/entities/boq-item.entity';
import { BoqSubItem } from '../../boq/entities/boq-sub-item.entity';

@Entity('work_order_boq_maps')
export class WorkOrderBoqMap {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => WorkOrderItem, { onDelete: 'CASCADE' })
  workOrderItem: WorkOrderItem;

  @ManyToOne(() => BoqItem, { onDelete: 'CASCADE', nullable: true })
  boqItem: BoqItem;

  @Column({ nullable: true })
  boqItemId: number;

  @ManyToOne(() => BoqSubItem, { onDelete: 'CASCADE', nullable: true })
  boqSubItem: BoqSubItem;

  @Column({ nullable: true })
  boqSubItemId: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 1 })
  conversionFactor: number; // e.g., 1 Set (WO) = 10 Nos (BOQ) -> Factor = 0.1

  @CreateDateColumn()
  createdAt: Date;
}
