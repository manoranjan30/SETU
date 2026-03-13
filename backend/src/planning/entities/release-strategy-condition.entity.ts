import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ReleaseStrategy } from './release-strategy.entity';

export enum ReleaseStrategyOperator {
  EQ = 'EQ',
  NE = 'NE',
  IN = 'IN',
  NOT_IN = 'NOT_IN',
  GT = 'GT',
  GTE = 'GTE',
  LT = 'LT',
  LTE = 'LTE',
  BETWEEN = 'BETWEEN',
  EXISTS = 'EXISTS',
  NOT_EXISTS = 'NOT_EXISTS',
}

@Entity('release_strategy_conditions')
export class ReleaseStrategyCondition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  strategyId: number;

  @ManyToOne(() => ReleaseStrategy, (strategy) => strategy.conditions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'strategyId' })
  strategy: ReleaseStrategy;

  @Column({ length: 120 })
  fieldKey: string;

  @Column({
    type: 'enum',
    enum: ReleaseStrategyOperator,
  })
  operator: ReleaseStrategyOperator;

  @Column({ type: 'text', nullable: true })
  valueFrom: string | null;

  @Column({ type: 'text', nullable: true })
  valueTo: string | null;

  @Column({ type: 'jsonb', nullable: true })
  valueJson: any;

  @Column({ type: 'int', default: 1 })
  sequence: number;
}
