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

export enum QualityCardStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  LOCKED = 'LOCKED',
}

@Entity('quality_pour_cards')
export class QualityPourCard {
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
  elementName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  locationText: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  projectNameSnapshot: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  clientName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  consultantName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contractorName: string | null;

  @Column({ type: 'varchar', length: 100, default: 'F/QA/16' })
  formatNo: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  revisionNo: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  approvedByName: string | null;

  @Column({
    type: 'enum',
    enum: QualityCardStatus,
    default: QualityCardStatus.DRAFT,
  })
  status: QualityCardStatus;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  entries: Array<{
    slNo?: number | null;
    pourDate?: string | null;
    truckNo?: string | null;
    deliveryChallanNo?: string | null;
    mixIdOrGrade?: string | null;
    quantityM3?: number | null;
    cumulativeQtyM3?: number | null;
    arrivalTimeAtSite?: string | null;
    batchStartTime?: string | null;
    finishingTime?: string | null;
    timeTakenMinutes?: number | null;
    slumpMm?: number | null;
    concreteTemperature?: number | null;
    noOfCubesTaken?: number | null;
    supplierRepresentative?: string | null;
    contractorRepresentative?: string | null;
    clientRepresentative?: string | null;
    remarks?: string | null;
  }>;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({ type: 'int', nullable: true })
  createdByUserId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
