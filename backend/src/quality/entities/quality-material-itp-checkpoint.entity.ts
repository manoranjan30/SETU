import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QualityMaterialItpTemplate } from './quality-material-itp-template.entity';

@Entity('quality_material_itp_checkpoints')
export class QualityMaterialItpCheckpoint {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  templateId: number;

  @ManyToOne(() => QualityMaterialItpTemplate, (template) => template.checkpoints, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'templateId' })
  template: QualityMaterialItpTemplate;

  @Column({ type: 'int', default: 0 })
  sequence: number;

  @Column({ length: 80, default: 'OTHER' })
  section: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  slNo: string | null;

  @Column({ type: 'text' })
  characteristic: string;

  @Column({ type: 'text', nullable: true })
  testSpecification: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit: string | null;

  @Column({ length: 80, default: 'OTHER' })
  verifyingDocument: string;

  @Column({ length: 80, default: 'MANUAL' })
  frequencyType: string;

  @Column({ type: 'int', nullable: true })
  frequencyValue: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  frequencyUnit: string | null;

  @Column({ type: 'jsonb', nullable: true })
  acceptanceCriteria: any;

  @Column({ type: 'jsonb', nullable: true })
  applicableGrades: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  inspectionCategory: any;

  @Column({ type: 'jsonb', nullable: true })
  contractorAction: any;

  @Column({ type: 'jsonb', nullable: true })
  pmcAction: any;

  @Column({ default: true })
  isMandatory: boolean;

  @Column({ default: false })
  requiresDocument: boolean;

  @Column({ default: false })
  requiresPhotoEvidence: boolean;

  @Column({ default: false })
  requiresNumericResult: boolean;

  @Column({ default: false })
  requiresLabReport: boolean;

  @Column({ default: false })
  requiresThirdParty: boolean;

  @Column({ type: 'jsonb', nullable: true })
  requiredEvidenceTypes: string[] | null;

  @Column({ type: 'int', default: 0 })
  minPhotoCount: number;

  @Column({ type: 'int', nullable: true })
  dueOffsetHours: number | null;

  @Column({ type: 'int', nullable: true })
  expiryWindowDays: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
