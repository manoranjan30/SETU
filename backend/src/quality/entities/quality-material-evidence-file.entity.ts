import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('quality_material_evidence_files')
export class QualityMaterialEvidenceFile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column({ length: 50 })
  ownerType: string;

  @Column()
  ownerId: number;

  @Column({ type: 'int', nullable: true })
  resultId: number | null;

  @Column({ type: 'int', nullable: true })
  receiptId: number | null;

  @Column({ type: 'int', nullable: true })
  templateId: number | null;

  @Column({ type: 'int', nullable: true })
  checkpointId: number | null;

  @Column({ length: 80 })
  evidenceType: string;

  @Column({ length: 30 })
  fileKind: string;

  @Column({ length: 255 })
  fileName: string;

  @Column({ length: 255 })
  originalName: string;

  @Column({ length: 120 })
  mimeType: string;

  @Column({ type: 'int' })
  sizeBytes: number;

  @Column({ type: 'text' })
  relativeUrl: string;

  @Column({ type: 'text', nullable: true })
  thumbnailUrl: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'int', nullable: true })
  uploadedById: number | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  uploadedAt: Date;

  @Column({ default: false })
  isRequired: boolean;

  @Column({ default: false })
  isLocked: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lockedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lockReason: string | null;

  @Column({ type: 'int', default: 1 })
  revisionNo: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
