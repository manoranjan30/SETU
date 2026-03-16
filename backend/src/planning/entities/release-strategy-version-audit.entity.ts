import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ReleaseStrategy } from './release-strategy.entity';

@Entity('release_strategy_version_audits')
export class ReleaseStrategyVersionAudit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  strategyId: number;

  @ManyToOne(() => ReleaseStrategy, (strategy) => strategy.audits, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'strategyId' })
  strategy: ReleaseStrategy;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'int', nullable: true })
  changedBy: number | null;

  @Column({ type: 'jsonb' })
  snapshotJson: any;

  @Column({ type: 'timestamp', nullable: true })
  activatedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
