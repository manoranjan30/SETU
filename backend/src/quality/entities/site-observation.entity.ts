import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { EpsNode } from '../../eps/eps.entity';

export enum SiteObservationSeverity {
  INFO = 'INFO',
  MINOR = 'MINOR',
  MAJOR = 'MAJOR',
  CRITICAL = 'CRITICAL',
}

export enum SiteObservationStatus {
  OPEN = 'OPEN',
  RECTIFIED = 'RECTIFIED',
  CLOSED = 'CLOSED',
}

@Entity('site_observations')
export class SiteObservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: number;

  @Column({ nullable: true })
  epsNodeId: number;

  @ManyToOne(() => EpsNode, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'epsNodeId' })
  epsNode: EpsNode;

  /** Denormalised breadcrumb captured at creation time, e.g. "Block A › Tower 1 › Floor 3".
   *  Allows display of the location even when the EPS node has been renamed or deleted. */
  @Column({ type: 'text', nullable: true })
  locationLabel: string;

  @Column({
    type: 'enum',
    enum: SiteObservationSeverity,
    default: SiteObservationSeverity.MINOR,
  })
  severity: SiteObservationSeverity;

  @Column({ type: 'text', default: 'General' })
  category: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column('text', { array: true, default: [] })
  photos: string[];

  @Column({ nullable: true })
  raisedById: string;

  @Column({ type: 'text', nullable: true })
  rectificationText: string;

  @Column('text', { array: true, default: [] })
  rectificationPhotos: string[];

  @Column({ nullable: true })
  rectifiedById: string;

  @Column({ type: 'timestamp', nullable: true })
  rectifiedAt: Date;

  @Column({ nullable: true })
  closedById: string;

  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date;

  @Column({ type: 'text', nullable: true })
  closureRemarks: string;

  @Column({
    type: 'enum',
    enum: SiteObservationStatus,
    default: SiteObservationStatus.OPEN,
  })
  status: SiteObservationStatus;

  @Column({ type: 'date', nullable: true })
  targetDate: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
