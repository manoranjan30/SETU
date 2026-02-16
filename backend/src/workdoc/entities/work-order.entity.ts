import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Vendor } from './vendor.entity';
import { WorkOrderItem } from './work-order-item.entity';
import { WorkDocTemplate } from './work-doc-template.entity';

@Entity('work_orders')
export class WorkOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  woNumber: string;

  @ManyToOne(() => Vendor, (vendor) => vendor.workOrders, {
    onDelete: 'CASCADE',
  })
  vendor: Vendor;

  @ManyToOne(() => WorkDocTemplate, { nullable: true })
  @JoinColumn({ name: 'templateId' })
  template: WorkDocTemplate;

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
