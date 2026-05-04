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
import { BoqItem } from './boq-item.entity';
import { MeasurementElement } from './measurement-element.entity';

export enum BoqSubItemRateSource {
  SUB_ITEM = 'SUB_ITEM',
  MEASUREMENT = 'MEASUREMENT',
}

@Entity()
export class BoqSubItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  boqItemId: number;

  @ManyToOne(() => BoqItem, (item) => item.subItems, { onDelete: 'CASCADE' })
  boqItem: BoqItem;

  @Column()
  description: string; // "Substructure", "Block A", etc.

  @Column({ nullable: true })
  uom: string; // Specific UOM or inherited

  @Column({
    type: 'varchar',
    length: 20,
    default: BoqSubItemRateSource.SUB_ITEM,
  })
  rateSource: BoqSubItemRateSource;

  // Rate can be overridden at Sub Item level
  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  rate: number;

  // Derived from Measurements
  @Column('decimal', { precision: 12, scale: 3, default: 0 })
  qty: number;

  @Column('decimal', { precision: 12, scale: 3, default: 0 })
  executedQty: number;

  // Derived: qty * rate
  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  amount: number;

  @OneToMany(() => MeasurementElement, (measurement) => measurement.boqSubItem)
  measurements: MeasurementElement[];

  // Resource Analysis Link
  @Column({ nullable: true })
  analysisTemplateId: number;

  @ManyToOne('AnalysisTemplate', { nullable: true })
  @JoinColumn({ name: 'analysisTemplateId' })
  analysisTemplate: any;

  @CreateDateColumn()
  createdOn: Date;

  @UpdateDateColumn()
  updatedOn: Date;
}
