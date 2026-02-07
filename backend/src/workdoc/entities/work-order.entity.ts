import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { Vendor } from './vendor.entity';
import { WorkOrderItem } from './work-order-item.entity';

@Entity('work_orders')
export class WorkOrder {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    woNumber: string;

    @ManyToOne(() => Vendor, (vendor) => vendor.workOrders, { onDelete: 'CASCADE' })
    vendor: Vendor;

    @Column()
    projectId: number;

    @Column({ type: 'date' })
    woDate: Date;

    @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
    totalAmount: number;

    @Column({ default: 'DRAFT' })
    status: string; // DRAFT, ACTIVE, CLOSED, CANCELLED

    @Column({ nullable: true })
    pdfPath: string; // Path to original file

    @Column({ nullable: true })
    originalFileName: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @OneToMany(() => WorkOrderItem, (item) => item.workOrder, { cascade: true })
    items: WorkOrderItem[];
}
