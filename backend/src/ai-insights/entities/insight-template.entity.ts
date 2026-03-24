import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, JoinColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { InsightRun } from './insight-run.entity';

@Entity('insight_template')
export class InsightTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: false })
  isSystem: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 150, default: 'AI.INSIGHTS.RUN' })
  requiredPermission: string;

  @Column({ type: 'varchar', length: 20, default: 'PROJECT' })
  scope: string;

  @Column({ type: 'jsonb', default: [] })
  dataSources: object[];

  @Column({ type: 'text' })
  promptTemplate: string;

  @Column({ type: 'jsonb', nullable: true })
  outputSchema: object | null;

  @Column({ type: 'varchar', length: 50, nullable: true, default: 'Brain' })
  icon: string | null;

  @Column({ type: 'jsonb', default: [] })
  tags: string[];

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User | null;

  @Column({ type: 'int', nullable: true })
  createdById: number | null;

  @OneToMany(() => InsightRun, (run) => run.template)
  runs: InsightRun[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
