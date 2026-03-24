import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { InsightTemplate } from './insight-template.entity';
import { AiModelConfig } from './ai-model-config.entity';

@Entity('insight_run')
export class InsightRun {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => InsightTemplate, (t) => t.runs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'templateId' })
  template: InsightTemplate;

  @Column({ type: 'int' })
  templateId: number;

  @Column({ type: 'int', nullable: true })
  projectId: number | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requestedById' })
  requestedBy: User;

  @Column({ type: 'int' })
  requestedById: number;

  @ManyToOne(() => AiModelConfig, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'modelConfigId' })
  modelConfig: AiModelConfig | null;

  @Column({ type: 'int', nullable: true })
  modelConfigId: number | null;

  /** PENDING | RUNNING | COMPLETED | FAILED */
  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: string;

  @Column({ type: 'jsonb', nullable: true })
  parameters: object | null;

  @Column({ type: 'jsonb', nullable: true })
  dataSnapshot: object | null;

  @Column({ type: 'text', nullable: true })
  promptRendered: string | null;

  @Column({ type: 'jsonb', nullable: true })
  result: object | null;

  @Column({ type: 'text', nullable: true })
  rawResponse: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  modelUsed: string | null;

  @Column({ type: 'int', nullable: true })
  tokensUsed: number | null;

  @Column({ type: 'int', nullable: true })
  durationMs: number | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
