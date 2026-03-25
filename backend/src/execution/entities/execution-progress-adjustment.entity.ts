import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ExecutionProgressEntry } from './execution-progress-entry.entity';

@Entity('execution_progress_adjustment')
export class ExecutionProgressAdjustment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ExecutionProgressEntry, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'executionProgressEntryId' })
  executionProgressEntry: ExecutionProgressEntry;

  @Column()
  executionProgressEntryId: number;

  @Column('decimal', { precision: 12, scale: 3 })
  oldQty: number;

  @Column('decimal', { precision: 12, scale: 3 })
  newQty: number;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'varchar', nullable: true })
  changedBy: string | null;

  @CreateDateColumn()
  changedAt: Date;
}
