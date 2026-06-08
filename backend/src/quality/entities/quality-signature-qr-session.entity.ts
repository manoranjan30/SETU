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
import { User } from '../../users/user.entity';
import { QualityPrePourClearanceCard } from './quality-pre-pour-clearance-card.entity';

export enum QualitySignatureQrSessionStatus {
  ACTIVE = 'ACTIVE',
  CONSUMED = 'CONSUMED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

@Entity('quality_signature_qr_sessions')
export class QualitySignatureQrSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128 })
  tokenHash: string;

  @Column()
  inspectionId: number;

  @Column()
  clearanceCardId: number;

  @ManyToOne(() => QualityPrePourClearanceCard, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clearanceCardId' })
  clearanceCard: QualityPrePourClearanceCard;

  @Column({ type: 'varchar', length: 180 })
  signoffId: string;

  @Column({ type: 'varchar', length: 255 })
  signoffDepartment: string;

  @Column({ type: 'int', nullable: true })
  requestedByUserId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'requestedByUserId' })
  requestedByUser: User | null;

  @Column({ type: 'int', nullable: true })
  consumedByUserId: number | null;

  @Column({
    type: 'enum',
    enum: QualitySignatureQrSessionStatus,
    default: QualitySignatureQrSessionStatus.ACTIVE,
  })
  status: QualitySignatureQrSessionStatus;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  consumedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
