import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QualityInspection } from './quality-inspection.entity';

export enum QualityInspectionAttachmentType {
  DRAWING_MARKUP = 'DRAWING_MARKUP',
  SUPPORTING_DOCUMENT = 'SUPPORTING_DOCUMENT',
}

@Entity('quality_inspection_attachments')
@Index(['projectId', 'inspectionId'])
@Index(['draftToken'])
@Index(['clientUploadId'], { unique: true })
export class QualityInspectionAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: number;

  @Column({ type: 'int', nullable: true })
  inspectionId: number | null;

  @ManyToOne(() => QualityInspection, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inspectionId' })
  inspection: QualityInspection | null;

  @Column({ type: 'uuid' })
  draftToken: string;

  @Column({ type: 'uuid' })
  clientUploadId: string;

  @Column({
    type: 'enum',
    enum: QualityInspectionAttachmentType,
  })
  attachmentType: QualityInspectionAttachmentType;

  @Column({ length: 255 })
  originalName: string;

  @Column({ length: 255 })
  storedName: string;

  @Column({ type: 'text' })
  originalUrl: string;

  @Column({ type: 'text', nullable: true })
  annotatedUrl: string | null;

  @Column({ length: 120 })
  mimeType: string;

  @Column({ type: 'int' })
  size: number;

  @Column({ type: 'jsonb', nullable: true })
  annotationData: Record<string, unknown> | null;

  @Column({ type: 'int', nullable: true })
  uploadedByUserId: number | null;

  @Column({ default: false })
  isLocked: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lockedAt: Date | null;

  @CreateDateColumn()
  uploadedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
