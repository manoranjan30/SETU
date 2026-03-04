import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { QualityInspectionStage } from './quality-inspection-stage.entity';
import { QualityInspection } from './quality-inspection.entity';

@Entity('quality_signatures')
export class QualitySignature {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  stageId: number;

  @ManyToOne(() => QualityInspectionStage, (s) => s.signatures, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'stageId' })
  stage: QualityInspectionStage;

  @Column({ nullable: true })
  inspectionId: number; // For final approval signatures

  @ManyToOne(() => QualityInspection, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'inspectionId' })
  inspection: QualityInspection;

  @Column({ nullable: true })
  workflowStepId: number; // Link to specific workflow step

  @Column({ nullable: true })
  userId: number; // The user who signed

  @Column({ nullable: true })
  actionType: string; // 'RAISE_RFI' | 'STAGE_APPROVE' | 'FINAL_APPROVE' | 'REVERSE'

  @Column({ length: 100 })
  role: string; // e.g., 'Site Engineer', 'QA Manager'

  @Column({ length: 100 })
  signedBy: string; // User ID or Name

  @Column({ type: 'text', nullable: true })
  signatureData: string; // Base64 or Image URL

  @Column({ type: 'text' })
  lockHash: string; // SHA-256 fingerprint of the stage data at time of signing

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    gps?: { lat: number; lng: number };
    ipAddress?: string;
    timestamp: Date;
  };

  @CreateDateColumn()
  createdAt: Date;
}
