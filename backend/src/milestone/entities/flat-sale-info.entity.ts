import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EpsNode } from '../../eps/eps.entity';
import { QualityUnit } from '../../quality/entities/quality-unit.entity';
import { User } from '../../users/user.entity';

@Entity('flat_sale_info')
export class FlatSaleInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'project_id' })
  projectId: number;

  @ManyToOne(() => EpsNode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: EpsNode;

  @Column({ name: 'eps_node_id', type: 'int', nullable: true })
  epsNodeId: number | null;

  @ManyToOne(() => EpsNode, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'eps_node_id' })
  epsNode: EpsNode | null;

  @Column({ name: 'quality_unit_id', type: 'int', nullable: true })
  qualityUnitId: number | null;

  @ManyToOne(() => QualityUnit, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'quality_unit_id' })
  qualityUnit: QualityUnit | null;

  @Column({ name: 'unit_label', length: 100 })
  unitLabel: string;

  @Column({ name: 'total_sale_value', type: 'decimal', precision: 15, scale: 2 })
  totalSaleValue: string;

  @Column({ name: 'customer_name', type: 'varchar', length: 255, nullable: true })
  customerName: string | null;

  @Column({ name: 'agreement_date', type: 'date', nullable: true })
  agreementDate: string | null;

  @Column({ name: 'loan_bank', type: 'varchar', length: 255, nullable: true })
  loanBank: string | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({ name: 'created_by_id', type: 'int', nullable: true })
  createdById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
