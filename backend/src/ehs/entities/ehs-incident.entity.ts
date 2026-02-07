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

export enum IncidentType {
  NEAR_MISS = 'NEAR_MISS',
  FAC = 'FAC',
  MTC = 'MTC',
  LTI = 'LTI',
  PROPERTY_DAMAGE = 'PROPERTY_DAMAGE',
  ENVIRONMENTAL = 'ENVIRONMENTAL',
}

export enum InvestigationStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETE = 'COMPLETE',
}

export enum IncidentStatus {
  REPORTED = 'REPORTED',
  INVESTIGATING = 'INVESTIGATING',
  CLOSED = 'CLOSED',
}

@Entity('ehs_incidents')
export class EhsIncident {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @ManyToOne(() => EpsNode)
  @JoinColumn({ name: 'projectId' })
  project: EpsNode;

  @Column({ type: 'date' })
  incidentDate: string;

  @Column({
    type: 'enum',
    enum: IncidentType,
  })
  incidentType: IncidentType;

  @Column({ type: 'text' })
  location: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'json', nullable: true })
  affectedPersons: string[];

  @Column({ nullable: true })
  bodyPartAffected: string;

  @Column({ type: 'text' })
  immediateCause: string;

  @Column({ type: 'text', nullable: true })
  rootCause: string;

  @Column({ type: 'json', nullable: true })
  witnesses: string[];

  @Column({ type: 'json', nullable: true })
  photoUrls: string[];

  @Column({ default: false })
  firstAidGiven: boolean;

  @Column({ default: false })
  hospitalVisit: boolean;

  @Column({ default: 0 })
  daysLost: number;

  @Column({
    type: 'enum',
    enum: InvestigationStatus,
    default: InvestigationStatus.PENDING,
  })
  investigationStatus: InvestigationStatus;

  @Column({ nullable: true })
  investigatedById: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'investigatedById' })
  investigatedBy: User;

  @Column({ type: 'date', nullable: true })
  investigationDate: string;

  @Column({ type: 'text', nullable: true })
  correctiveActions: string;

  @Column({ type: 'text', nullable: true })
  preventiveActions: string;

  @Column({
    type: 'enum',
    enum: IncidentStatus,
    default: IncidentStatus.REPORTED,
  })
  status: IncidentStatus;

  @Column()
  reportedById: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reportedById' })
  reportedBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
