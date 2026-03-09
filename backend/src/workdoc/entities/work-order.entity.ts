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

  @Column({ nullable: true })
  orderAmendNo: string;

  @ManyToOne(() => Vendor, (vendor) => vendor.workOrders, {
    onDelete: 'CASCADE',
  })
  vendor: Vendor;

  @ManyToOne(() => WorkDocTemplate, { nullable: true })
  @JoinColumn({ name: 'templateId' })
  template: WorkDocTemplate;

  @Column()
  projectId: number;

  @Column({ nullable: true })
  projectCode: string; // SAP Project Code (e.g., "2C39")

  @Column({ nullable: true })
  projectDescription: string;

  @Column({ type: 'date' })
  woDate: Date;

  @Column({ type: 'date', nullable: true })
  orderAmendDate: Date;

  @Column({ type: 'date', nullable: true })
  orderValidityStart: Date;

  @Column({ type: 'date', nullable: true })
  orderValidityEnd: Date;

  @Column({ nullable: true })
  orderType: string; // e.g., "Project Services WO"

  @Column({ nullable: true })
  invoiceTo: string;

  @Column({ type: 'text', nullable: true })
  scopeOfWork: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ default: 'ACTIVE' })
  status: string; // DRAFT, ACTIVE, CLOSED, CANCELLED

  // === WO Reference Fields (External monitoring) ===

  @Column({ type: 'text', nullable: true })
  woRefText: string; // External WO reference text

  @Column({ nullable: true })
  woRefNumber: string; // External WO reference number

  @Column({ type: 'date', nullable: true })
  woRefDate: Date; // External WO reference date

  // Source: how this WO was created
  @Column({ default: 'BOQ_DERIVED' })
  source: string; // 'MANUAL', 'BOQ_DERIVED'

  // Legacy PDF fields (deprecated - kept for migration safety)
  @Column({ nullable: true })
  pdfPath: string;

  @Column({ nullable: true })
  originalFileName: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => WorkOrderItem, (item) => item.workOrder, { cascade: true })
  items: WorkOrderItem[];
}
