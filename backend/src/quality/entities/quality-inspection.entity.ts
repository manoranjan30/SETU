import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { QualityActivity } from './quality-activity.entity';
import { QualityActivityList } from './quality-activity-list.entity';
import { EpsNode } from '../../eps/eps.entity';
import { QualityInspectionStage } from './quality-inspection-stage.entity';
import { Vendor } from '../../workdoc/entities/vendor.entity';

export enum InspectionStatus {
  PENDING = 'PENDING',
  PARTIALLY_APPROVED = 'PARTIALLY_APPROVED',
  APPROVED = 'APPROVED',
  PROVISIONALLY_APPROVED = 'PROVISIONALLY_APPROVED',
  REJECTED = 'REJECTED',
  CANCELED = 'CANCELED',
  REVERSED = 'REVERSED',
}

@Entity('quality_inspections')
export class QualityInspection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column({ nullable: true })
  epsNodeId: number;

  @ManyToOne(() => EpsNode, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'epsNodeId' })
  epsNode: EpsNode;

  @Column()
  listId: number;

  @ManyToOne(() => QualityActivityList, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listId' })
  list: QualityActivityList;

  @Column()
  activityId: number;

  @ManyToOne(() => QualityActivity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activityId' })
  activity: QualityActivity;

  @Column({ type: 'int', default: 0 })
  sequence: number; // Snapshot of sequence at creation

  @Column({
    type: 'enum',
    enum: InspectionStatus,
    default: InspectionStatus.PENDING,
  })
  status: InspectionStatus;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  requestDate: string;

  @Column({ type: 'date', nullable: true })
  inspectionDate: string;

  @Column({ nullable: true })
  inspectedBy: string; // User ID or Name

  @Column({ nullable: true })
  requestedById: number; // User ID who raised the RFI

  @Column({ nullable: true })
  vendorId: number;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @Column({ nullable: true })
  vendorName: string; // Snapshot for historical purposes

  @Column({ nullable: true })
  qualityUnitId: number;

  @Column({ nullable: true })
  qualityRoomId: number;

  @Column({ type: 'int', default: 1 })
  partNo: number;

  @Column({ type: 'int', default: 1 })
  totalParts: number;

  @Column({ type: 'varchar', nullable: true })
  partLabel: string | null;

  @Column({ type: 'int', name: 'go_no', nullable: true })
  goNo: number | null;

  @Column({ type: 'varchar', name: 'go_label', length: 100, nullable: true })
  goLabel: string | null;

  @Column({ type: 'varchar', name: 'drawing_no', length: 100, nullable: true })
  drawingNo: string | null;

  @Column({
    type: 'varchar',
    name: 'contractor_name',
    length: 255,
    nullable: true,
  })
  contractorName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  processCode: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  documentType: string | null;

  @Column({ type: 'text', nullable: true })
  comments: string;

  @Column({ default: false })
  isLocked: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lockedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  lockedByUserId: number | null;

  @OneToMany(() => QualityInspectionStage, (stage) => stage.inspection, {
    cascade: true,
  })
  stages: QualityInspectionStage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
