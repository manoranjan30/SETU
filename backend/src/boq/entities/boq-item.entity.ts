import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { EpsNode } from '../../eps/eps.entity';
import { MeasurementElement } from './measurement-element.entity';
import { BoqSubItem } from './boq-sub-item.entity';
import { BudgetLineItem } from '../../planning/entities/budget-line-item.entity';

export enum BoqQtyMode {
  MANUAL = 'MANUAL',
  DERIVED = 'DERIVED',
}

@Entity()
export class BoqItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  // Commercial Reference Code
  @Column()
  boqCode: string;

  @Column()
  description: string;

  @Column()
  uom: string;

  @Column({ type: 'text', nullable: true })
  longDescription: string;

  @ManyToOne(() => EpsNode, { nullable: true })
  epsNode: EpsNode;

  @Column({ nullable: true })
  epsNodeId: number | null;

  @Column({ nullable: true })
  budgetLineItemId: number | null;

  @ManyToOne(() => BudgetLineItem, { nullable: true })
  @JoinColumn({ name: 'budgetLineItemId' })
  budgetLineItem: BudgetLineItem | null;

  // Manual vs Derived from Measurements
  @Column({
    type: 'enum',
    enum: BoqQtyMode,
    default: BoqQtyMode.DERIVED,
  })
  qtyMode: BoqQtyMode;

  // The Contractual Quantity
  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  qty: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  rate: number;

  // Track Total Executed Quantity
  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  consumedQty: number;

  // Derived: qty * rate
  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  amount: number;

  @Column({ default: 'DRAFT' })
  status: string;

  // Flexibility for future columns
  @Column({ type: 'json', nullable: true })
  customAttributes: any; // Dynamic storage for extra columns

  // Relationships
  @OneToMany(() => BoqSubItem, (subItem) => subItem.boqItem)
  subItems: BoqSubItem[];

  // Deprecated: Measurements now live under SubItems
  // Keeping for migration safety, but should be removed eventually
  @OneToMany(() => MeasurementElement, (measurement) => measurement.boqItem)
  measurements: MeasurementElement[];

  @CreateDateColumn()
  createdOn: Date;

  @UpdateDateColumn()
  updatedOn: Date;

  // Resource Analysis Link
  @Column({ nullable: true })
  analysisTemplateId: number;

  @ManyToOne('AnalysisTemplate', { nullable: true })
  @JoinColumn({ name: 'analysisTemplateId' })
  analysisTemplate: any; // Type as 'any' to avoid circular dependency or use require if needed, or import if possible.
}
