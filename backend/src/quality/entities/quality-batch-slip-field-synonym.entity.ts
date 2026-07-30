import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const BATCH_SLIP_FIELD_KEYS = [
  'TRUCK_NO',
  'DELIVERY_CHALLAN_NO',
  'MIX_GRADE',
  'QUANTITY_M3',
  'SLUMP_MM',
  'BATCH_START_TIME',
  'SUPPLIER_NAME',
] as const;

export type BatchSlipFieldKey = (typeof BATCH_SLIP_FIELD_KEYS)[number];

@Entity('quality_batch_slip_field_synonyms')
@Index(['projectId', 'fieldKey'])
export class QualityBatchSlipFieldSynonym {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  projectId: number | null;

  @Column({ type: 'varchar', length: 40 })
  fieldKey: BatchSlipFieldKey;

  @Column({ type: 'varchar', length: 60 })
  label: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', nullable: true })
  createdByUserId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
