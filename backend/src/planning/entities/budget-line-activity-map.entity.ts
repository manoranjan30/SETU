import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { BudgetLineItem } from './budget-line-item.entity';
import { Activity } from '../../wbs/entities/activity.entity';

@Entity()
@Unique(['budgetLineItemId', 'activityId'])
export class BudgetLineActivityMap {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  budgetLineItemId: number;

  @ManyToOne(() => BudgetLineItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'budgetLineItemId' })
  budgetLineItem: BudgetLineItem;

  @Index()
  @Column()
  activityId: number;

  @ManyToOne(() => Activity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activityId' })
  activity: Activity;

  @Column({ type: 'varchar', default: 'system' })
  createdBy: string;

  @CreateDateColumn()
  createdOn: Date;
}
