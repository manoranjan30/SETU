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

export enum EhsObservationSeverity {
  INFO = 'INFO',
  MINOR = 'MINOR',
  MAJOR = 'MAJOR',
  CRITICAL = 'CRITICAL',
}

export enum EhsObservationStatus {
  OPEN = 'OPEN',
  RECTIFIED = 'RECTIFIED',
  CLOSED = 'CLOSED',
}

@Entity('ehs_observations')
export class EhsObservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  projectId: number;

  @Column({ nullable: true })
  epsNodeId: number;

  @ManyToOne(() => EpsNode, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'epsNodeId' })
  epsNode: EpsNode;

  @Column({
    type: 'enum',
    enum: EhsObservationSeverity,
    default: EhsObservationSeverity.MINOR,
  })
  severity: EhsObservationSeverity;

  @Column({ type: 'text', default: 'General Safety' })
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
    enum: EhsObservationStatus,
    default: EhsObservationStatus.OPEN,
  })
  status: EhsObservationStatus;

  @Column({ type: 'date', nullable: true })
  targetDate: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
