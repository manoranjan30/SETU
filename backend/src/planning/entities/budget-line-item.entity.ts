import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Budget } from './budget.entity';
import { WbsNode } from '../../wbs/entities/wbs.entity';
import { EpsNode } from '../../eps/eps.entity';
import { BudgetBoqMap } from './budget-boq-map.entity';
import { BudgetLineActivityMap } from './budget-line-activity-map.entity';

export enum BudgetLineStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

@Entity()
export class BudgetLineItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  budgetId: number;

  @ManyToOne(() => Budget, (budget) => budget.lineItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'budgetId' })
  budget: Budget;

  @Column()
  code: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  category: string | null;

  @Column({ type: 'varchar', nullable: true })
  uom: string | null;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  qty: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  rate: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({
    type: 'enum',
    enum: BudgetLineStatus,
    default: BudgetLineStatus.ACTIVE,
  })
  status: BudgetLineStatus;

  @Column({ nullable: true })
  wbsNodeId: number | null;

  @ManyToOne(() => WbsNode, { nullable: true })
  @JoinColumn({ name: 'wbsNodeId' })
  wbsNode: WbsNode | null;

  @Column({ nullable: true })
  epsNodeId: number | null;

  @ManyToOne(() => EpsNode, { nullable: true })
  @JoinColumn({ name: 'epsNodeId' })
  epsNode: EpsNode | null;

  @CreateDateColumn()
  createdOn: Date;

  @UpdateDateColumn()
  updatedOn: Date;

  @OneToMany(() => BudgetBoqMap, (map) => map.budgetLineItem)
  boqMappings: BudgetBoqMap[];

  @OneToMany(() => BudgetLineActivityMap, (map) => map.budgetLineItem)
  activityMappings: BudgetLineActivityMap[];
}
