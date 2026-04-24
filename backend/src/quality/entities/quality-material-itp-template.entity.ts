import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QualityMaterialItpCheckpoint } from './quality-material-itp-checkpoint.entity';

export const MATERIAL_ITP_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVAL_IN_PROGRESS: 'APPROVAL_IN_PROGRESS',
  APPROVED: 'APPROVED',
  ACTIVE: 'ACTIVE',
  REJECTED: 'REJECTED',
  INACTIVE: 'INACTIVE',
  SUPERSEDED: 'SUPERSEDED',
} as const;

@Entity('quality_material_itp_templates')
export class QualityMaterialItpTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column({ length: 200 })
  materialName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  materialCode: string | null;

  @Column({ length: 100 })
  itpNo: string;

  @Column({ length: 20, default: '01' })
  revNo: string;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', nullable: true })
  standardRefs: string[] | null;

  @Column({ length: 50, default: MATERIAL_ITP_STATUS.DRAFT })
  status: string;

  @Column({ length: 50, default: 'NOT_SUBMITTED' })
  approvalStatus: string;

  @Column({ type: 'int', nullable: true })
  approvalRunId: number | null;

  @Column({ type: 'int', nullable: true })
  approvalStrategyId: number | null;

  @Column({ type: 'int', nullable: true })
  approvalStrategyVersion: number | null;

  @Column({ type: 'int', nullable: true })
  submittedById: number | null;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'date', nullable: true })
  effectiveFrom: string | null;

  @Column({ type: 'date', nullable: true })
  effectiveTo: string | null;

  @Column({ default: false })
  isGlobal: boolean;

  @Column({ type: 'int', nullable: true })
  sourceTemplateId: number | null;

  @Column({ type: 'int', nullable: true })
  copiedFromProjectId: number | null;

  @Column({ type: 'int', nullable: true })
  createdById: number | null;

  @Column({ type: 'int', nullable: true })
  approvedById: number | null;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @OneToMany(() => QualityMaterialItpCheckpoint, (checkpoint) => checkpoint.template, {
    cascade: true,
  })
  checkpoints: QualityMaterialItpCheckpoint[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
