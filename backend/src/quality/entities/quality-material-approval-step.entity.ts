import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { QualityMaterialApprovalRun } from './quality-material-approval-run.entity';

@Entity('quality_material_approval_steps')
export class QualityMaterialApprovalStep {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  runId: number;

  @ManyToOne(() => QualityMaterialApprovalRun, (run) => run.steps, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'runId' })
  run: QualityMaterialApprovalRun;

  @Column({ type: 'int' })
  stepOrder: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  stepName: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  approverMode: string | null;

  @Column({ type: 'int', nullable: true })
  assignedUserId: number | null;

  @Column({ type: 'jsonb', nullable: true })
  assignedUserIds: number[] | null;

  @Column({ type: 'int', nullable: true })
  assignedRoleId: number | null;

  @Column({ type: 'int', default: 1 })
  minApprovalsRequired: number;

  @Column({ type: 'int', default: 0 })
  currentApprovalCount: number;

  @Column({ type: 'jsonb', nullable: true })
  approvedUserIds: number[] | null;

  @Column({ length: 50, default: 'WAITING' })
  status: string;

  @Column({ type: 'int', nullable: true })
  signatureId: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  signedBy: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  signerDisplayName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  signerCompany: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  signerRole: string | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  comments: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
