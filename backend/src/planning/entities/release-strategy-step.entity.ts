import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ReleaseStrategy } from './release-strategy.entity';

export enum ReleaseStrategyApproverMode {
  USER = 'USER',
  PROJECT_ROLE = 'PROJECT_ROLE',
}

@Entity('release_strategy_steps')
export class ReleaseStrategyStep {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  strategyId: number;

  @ManyToOne(() => ReleaseStrategy, (strategy) => strategy.steps, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'strategyId' })
  strategy: ReleaseStrategy;

  @Column({ type: 'int' })
  levelNo: number;

  @Column({ length: 200 })
  stepName: string;

  @Column({
    type: 'enum',
    enum: ReleaseStrategyApproverMode,
  })
  approverMode: ReleaseStrategyApproverMode;

  @Column({ type: 'int', nullable: true })
  userId: number | null;

  @Column({ type: 'int', nullable: true })
  roleId: number | null;

  @Column({ type: 'int', default: 1 })
  minApprovalsRequired: number;

  @Column({ default: false })
  canDelegate: boolean;

  @Column({ type: 'int', nullable: true })
  escalationDays: number | null;

  @Column({ type: 'int', default: 1 })
  sequence: number;
}
