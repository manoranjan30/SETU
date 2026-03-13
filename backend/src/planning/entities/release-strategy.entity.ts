import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EpsNode } from '../../eps/eps.entity';
import { ReleaseStrategyCondition } from './release-strategy-condition.entity';
import { ReleaseStrategyStep } from './release-strategy-step.entity';
import { ReleaseStrategyVersionAudit } from './release-strategy-version-audit.entity';

export enum ReleaseStrategyStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum RestartPolicy {
  NO_RESTART = 'NO_RESTART',
  RESTART_FROM_LEVEL_1 = 'RESTART_FROM_LEVEL_1',
}

@Entity('release_strategies')
export class ReleaseStrategy {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @ManyToOne(() => EpsNode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: EpsNode;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 100 })
  moduleCode: string;

  @Column({ length: 100 })
  processCode: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  documentType: string | null;

  @Column({ type: 'int', default: 100 })
  priority: number;

  @Column({
    type: 'enum',
    enum: ReleaseStrategyStatus,
    default: ReleaseStrategyStatus.DRAFT,
  })
  status: ReleaseStrategyStatus;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ default: false })
  isDefault: boolean;

  @Column({
    type: 'enum',
    enum: RestartPolicy,
    default: RestartPolicy.RESTART_FROM_LEVEL_1,
  })
  restartPolicy: RestartPolicy;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'int', nullable: true })
  createdBy: number | null;

  @OneToMany(() => ReleaseStrategyCondition, (condition) => condition.strategy, {
    cascade: true,
  })
  conditions: ReleaseStrategyCondition[];

  @OneToMany(() => ReleaseStrategyStep, (step) => step.strategy, {
    cascade: true,
  })
  steps: ReleaseStrategyStep[];

  @OneToMany(() => ReleaseStrategyVersionAudit, (audit) => audit.strategy, {
    cascade: true,
  })
  audits: ReleaseStrategyVersionAudit[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
