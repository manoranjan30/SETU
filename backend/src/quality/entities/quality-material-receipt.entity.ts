import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QualityMaterialItpTemplate } from './quality-material-itp-template.entity';
import { QualityMaterialTestObligation } from './quality-material-test-obligation.entity';

@Entity('quality_material_receipts')
export class QualityMaterialReceipt {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column()
  itpTemplateId: number;

  @ManyToOne(() => QualityMaterialItpTemplate, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'itpTemplateId' })
  itpTemplate: QualityMaterialItpTemplate;

  @Column({ length: 200 })
  materialName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  materialCode: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  brand: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  grade: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  supplier: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  manufacturer: string | null;

  @Column({ length: 150 })
  batchNumber: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  lotNumber: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  challanNumber: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 3, nullable: true })
  quantity: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  uom: string | null;

  @Column({ type: 'date' })
  receivedDate: string;

  @Column({ type: 'date', nullable: true })
  manufactureDate: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  packingWeekNo: string | null;

  @Column({ length: 50, default: 'RECEIVED' })
  status: string;

  @OneToMany(() => QualityMaterialTestObligation, (obligation) => obligation.receipt)
  obligations: QualityMaterialTestObligation[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
