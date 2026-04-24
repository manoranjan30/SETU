import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { BudgetLineItem } from './budget-line-item.entity';

export enum BudgetStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  LOCKED = 'LOCKED',
}

@Entity()
export class Budget {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  projectId: number;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: BudgetStatus,
    default: BudgetStatus.DRAFT,
  })
  status: BudgetStatus;

  @Column({ default: 1 })
  version: number;

  @Column({ default: 'system' })
  createdBy: string;

  @CreateDateColumn()
  createdOn: Date;

  @UpdateDateColumn()
  updatedOn: Date;

  @OneToMany(() => BudgetLineItem, (line) => line.budget)
  lineItems: BudgetLineItem[];
}
