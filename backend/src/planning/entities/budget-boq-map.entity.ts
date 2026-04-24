import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { BudgetLineItem } from './budget-line-item.entity';
import { BoqItem } from '../../boq/entities/boq-item.entity';

export enum BudgetAllocationType {
  FULL = 'FULL',
}

@Entity()
export class BudgetBoqMap {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  budgetLineItemId: number;

  @ManyToOne(() => BudgetLineItem, (line) => line.boqMappings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'budgetLineItemId' })
  budgetLineItem: BudgetLineItem;

  @Index()
  @Column()
  boqItemId: number;

  @ManyToOne(() => BoqItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'boqItemId' })
  boqItem: BoqItem;

  @Column({
    type: 'enum',
    enum: BudgetAllocationType,
    default: BudgetAllocationType.FULL,
  })
  allocationType: BudgetAllocationType;

  @Column('decimal', { precision: 6, scale: 2, default: 100 })
  allocationValue: number;

  @Column({ default: 'system' })
  createdBy: string;

  @CreateDateColumn()
  createdOn: Date;
}
