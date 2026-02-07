import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, CreateDateColumn } from 'typeorm';
import { WorkOrderItem } from './work-order-item.entity';
import { BoqItem } from '../../boq/entities/boq-item.entity';

@Entity('work_order_boq_maps')
export class WorkOrderBoqMap {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => WorkOrderItem, { onDelete: 'CASCADE' })
    workOrderItem: WorkOrderItem;

    @ManyToOne(() => BoqItem, { onDelete: 'CASCADE' })
    boqItem: BoqItem;

    @Column({ type: 'decimal', precision: 10, scale: 4, default: 1 })
    conversionFactor: number; // e.g., 1 Set (WO) = 10 Nos (BOQ) -> Factor = 0.1

    @CreateDateColumn()
    createdAt: Date;
}
