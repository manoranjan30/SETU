import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { EpsNode } from '../../eps/eps.entity';
import { User } from '../../users/user.entity';

export enum ObservationType {
  UNSAFE_ACT = 'UNSAFE_ACT',
  UNSAFE_CONDITION = 'UNSAFE_CONDITION',
  GOOD_PRACTICE = 'GOOD_PRACTICE',
}

export enum SeverityLevel {
  CRITICAL = 'CRITICAL',
  SERIOUS = 'SERIOUS',
  MINOR = 'MINOR',
  NEGLIGIBLE = 'NEGLIGIBLE',
}

export enum ObservationStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  CLOSED = 'CLOSED',
  ESCALATED = 'ESCALATED',
}

@Entity('ehs_observations')
export class EhsObservation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @ManyToOne(() => EpsNode)
  @JoinColumn({ name: 'projectId' })
  project: EpsNode;

  @Column({ type: 'date' })
  date: string;

  @Column()
  category: string;

  @Column({
    type: 'enum',
    enum: ObservationType,
    default: ObservationType.UNSAFE_CONDITION,
  })
  observationType: ObservationType;

  @Column({
    type: 'enum',
    enum: SeverityLevel,
    default: SeverityLevel.MINOR,
  })
  severity: SeverityLevel;

  @Column({ type: 'text' })
  location: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ nullable: true })
  photoUrl: string;

  @Column()
  reportedById: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reportedById' })
  reportedBy: User;

  @Column({ nullable: true })
  assignedToId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assignedToId' })
  assignedTo: User;

  @Column({ type: 'date', nullable: true })
  targetDate: string;

  @Column({ type: 'text', nullable: true })
  correctiveAction: string;

  @Column({
    type: 'enum',
    enum: ObservationStatus,
    default: ObservationStatus.OPEN,
  })
  status: ObservationStatus;

  @Column({ type: 'date', nullable: true })
  closedDate: string;

  @Column({ nullable: true })
  closedById: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'closedById' })
  closedBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
