import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum AdminDataCorrectionAction {
  UPDATE = 'UPDATE',
  REVERT = 'REVERT',
}

@Entity('admin_data_corrections')
export class AdminDataCorrection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 128 })
  tableName: string;

  @Column({ length: 128 })
  primaryKeyColumn: string;

  @Column({ type: 'text' })
  primaryKeyValue: string;

  @Column({
    type: 'enum',
    enum: AdminDataCorrectionAction,
    default: AdminDataCorrectionAction.UPDATE,
  })
  actionType: AdminDataCorrectionAction;

  @Column({ type: 'jsonb' })
  beforeData: Record<string, unknown>;

  @Column({ type: 'jsonb' })
  afterData: Record<string, unknown>;

  @Column({ type: 'jsonb' })
  changedFields: Record<string, { before: unknown; after: unknown }>;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'int', nullable: true })
  revertedFromCorrectionId: number | null;

  @Column({ type: 'int', nullable: true })
  createdByUserId: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  createdByName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
