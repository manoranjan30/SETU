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

@Entity('quality_material_test_obligations')
export class QualityMaterialTestObligation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column({ type: 'int', nullable: true })
  receiptId: number | null;

  @ManyToOne(() => QualityMaterialReceipt, (receipt) => receipt.obligations, {
    nullable: true,
    onDelete: 'CASCADE',
  })
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

  @Column({ length: 200 })
  materialName: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  brand: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  grade: string | null;

  @Column({ type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ type: 'date', nullable: true })
  warningDate: string | null;

  @Column({ length: 50, default: 'PENDING' })
  status: string;

  @Column({ length: 50, default: 'MEDIUM' })
  priority: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  assignedRole: string | null;

  @Column({ type: 'int', nullable: true })
  assignedUserId: number | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'int', nullable: true })
  lastResultId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
