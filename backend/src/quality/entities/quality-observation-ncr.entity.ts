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

  @Column({ type: 'varchar', nullable: true })
  location: string | null;

  @Column({ type: 'date' })
  reportedDate: string;

  @Column()
  reportedBy: string;

  @Column({ type: 'varchar', nullable: true })
  assignedTo: string | null;

  @Column({ default: 'Open' })
  status: string; // Open, In Progress, Resolved, Verified, Closed

  @Column({ type: 'text', nullable: true })
  rootCause: string | null;

  @Column({ type: 'text', nullable: true })
  correctiveAction: string | null;

  @Column({ type: 'date', nullable: true })
  targetDate: string | null;

  @Column({ type: 'date', nullable: true })
  closedDate: string | null;

  @Column({ type: 'varchar', nullable: true })
  attachmentUrl: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  sourceType: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  sourceId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  sourceReference: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
