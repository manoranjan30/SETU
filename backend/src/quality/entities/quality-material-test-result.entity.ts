import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QualityMaterialItpCheckpoint } from './quality-material-itp-checkpoint.entity';
import { QualityMaterialItpTemplate } from './quality-material-itp-template.entity';
import { QualityMaterialReceipt } from './quality-material-receipt.entity';
import { QualityMaterialTestObligation } from './quality-material-test-obligation.entity';

@Entity('quality_material_test_results')
export class QualityMaterialTestResult {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column()
  obligationId: number;

  @ManyToOne(() => QualityMaterialTestObligation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'obligationId' })
  obligation: QualityMaterialTestObligation;

  @Column({ type: 'int', nullable: true })
  receiptId: number | null;

  @ManyToOne(() => QualityMaterialReceipt, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'receiptId' })
  receipt: QualityMaterialReceipt | null;

  @Column()
  templateId: number;

  @ManyToOne(() => QualityMaterialItpTemplate, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'templateId' })
  template: QualityMaterialItpTemplate;

  @Column()
  checkpointId: number;

  @ManyToOne(() => QualityMaterialItpCheckpoint, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'checkpointId' })
  checkpoint: QualityMaterialItpCheckpoint;

  @Column({ type: 'date' })
  testDate: string;

  @Column({ type: 'int', nullable: true })
  testedById: number | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  testedByName: string | null;

  @Column({ length: 50, default: 'SITE' })
  labType: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  documentType: string | null;

  @Column({ type: 'text', nullable: true })
  primaryDocumentUrl: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 4, nullable: true })
  numericValue: string | null;

  @Column({ type: 'text', nullable: true })
  textValue: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  observedGrade: string | null;

  @Column({ length: 50, default: 'PENDING_REVIEW' })
  result: string;

  @Column({ length: 50, default: 'DRAFT' })
  reviewStatus: string;

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

  @Column({ type: 'int', nullable: true })
  reviewedById: number | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({ type: 'jsonb', nullable: true })
  criteriaSnapshot: any;

  @Column({ type: 'jsonb', nullable: true })
  itpSnapshot: any;

  @Column({ type: 'jsonb', nullable: true })
  evidenceSummary: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
