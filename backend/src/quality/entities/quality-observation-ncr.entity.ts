import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('quality_observations_ncr')
export class QualityObservationNcr {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column()
  type: string; // Observation, NCR

  @Column()
  severity: string; // Critical, Major, Minor

  @Column()
  category: string; // Structural, Architectural, MEP, External, etc.

  @Column({ type: 'text' })
  issueDescription: string;

  @Column({ nullable: true })
  location: string;

  @Column({ type: 'date' })
  reportedDate: string;

  @Column()
  reportedBy: string;

  @Column({ nullable: true })
  assignedTo: string;

  @Column({ default: 'Open' })
  status: string; // Open, In Progress, Resolved, Verified, Closed

  @Column({ type: 'text', nullable: true })
  rootCause: string;

  @Column({ type: 'text', nullable: true })
  correctiveAction: string;

  @Column({ type: 'date', nullable: true })
  targetDate: string;

  @Column({ type: 'date', nullable: true })
  closedDate: string;

  @Column({ nullable: true })
  attachmentUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
