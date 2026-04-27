import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QualityInspection } from './quality-inspection.entity';
import { QualityCardStatus } from './quality-pour-card.entity';

@Entity('quality_pre_pour_clearance_cards')
export class QualityPrePourClearanceCard {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  inspectionId: number;

  @ManyToOne(() => QualityInspection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inspectionId' })
  inspection: QualityInspection;

  @Column()
  projectId: number;

  @Column()
  activityId: number;

  @Column({ type: 'int', nullable: true })
  epsNodeId: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  activityLabel: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  projectNameSnapshot: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  elementName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  locationText: string | null;

  @Column({ type: 'date', nullable: true })
  cardDate: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  pourStartTime: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  pourEndTime: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contractorName: string | null;

  @Column({ type: 'varchar', length: 100, default: 'F/QA/20' })
  formatNo: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  revisionNo: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  pourLocation: string | null;

  @Column({ type: 'numeric', nullable: true })
  estimatedConcreteQty: number | null;

  @Column({ type: 'numeric', nullable: true })
  actualConcreteQty: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  pourNo: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  gradeOfConcrete: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  placementMethod: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  concreteSupplier: string | null;

  @Column({ type: 'int', nullable: true })
  cubeMouldCount: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  targetSlump: string | null;

  @Column({ type: 'int', nullable: true })
  vibratorCount: number | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  attachments: {
    checklistPccAttached?: 'YES' | 'NO' | 'NA';
    checklistWaterproofingAttached?: 'YES' | 'NO' | 'NA';
    checklistFormworkAttached?: 'YES' | 'NO' | 'NA';
    checklistReinforcementAttached?: 'YES' | 'NO' | 'NA';
    checklistMepAttached?: 'YES' | 'NO' | 'NA';
    checklistConcretingAttached?: 'YES' | 'NO' | 'NA';
    concretePourCardAttached?: 'YES' | 'NO' | 'NA';
  };

  @Column({ type: 'jsonb', default: () => "'[]'" })
  signoffs: Array<{
    department: string;
    personName?: string | null;
    signedDate?: string | null;
    signatureData?: string | null;
    status?: 'PENDING' | 'SIGNED' | 'WAIVED';
  }>;

  @Column({
    type: 'enum',
    enum: QualityCardStatus,
    default: QualityCardStatus.DRAFT,
  })
  status: QualityCardStatus;

  @Column({ type: 'int', nullable: true })
  createdByUserId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
