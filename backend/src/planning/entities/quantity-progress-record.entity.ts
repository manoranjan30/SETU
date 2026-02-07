import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BoqItem } from '../../boq/entities/boq-item.entity';

export enum ProgressStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('quantity_progress_record')
export class QuantityProgressRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @ManyToOne(() => BoqItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'boq_item_id' })
  boqItem: BoqItem;

  @Column()
  boqItemId: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  measuredQty: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalToDate: number;

  @Column({ type: 'date' })
  measureDate: Date;

  @Column({
    type: 'enum',
    enum: ProgressStatus,
    default: ProgressStatus.DRAFT,
  })
  status: ProgressStatus;

  @Column({ nullable: true })
  locationId: string; // EPS/WBS Node execution location

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @CreateDateColumn()
  createdOn: Date;

  @UpdateDateColumn()
  updatedOn: Date;

  @Column({ nullable: true })
  createdBy: string;

  @Column({ nullable: true })
  approvedBy: string;

  @Column({ type: 'date', nullable: true })
  approvedDate: Date;
}
