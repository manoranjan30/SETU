import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { EpsNode } from '../../eps/eps.entity';

@Entity('quality_rating_config')
export class QualityRatingConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'project_node_id' })
  projectNodeId: number;

  @OneToOne(() => EpsNode)
  @JoinColumn({ name: 'project_node_id' })
  projectNode: EpsNode;

  // Rating for each severity level (Default: OFI=5, Minor=4, Moderate=3, Major=2, Critical=1)
  @Column('jsonb', {
    default: {
      OFI: 5,
      MINOR: 4,
      MODERATE: 3,
      MAJOR: 2,
      CRITICAL: 1,
    },
  })
  severityRatings: Record<string, number>;

  // Category weightages based on project status (e.g. Structure, Finishes)
  @Column('jsonb', {
    default: [
      {
        status: 'Structure',
        observations: 5,
        documentation: 5,
        customerInspections: 0,
      },
      {
        status: 'Structure + Finishes',
        observations: 5,
        documentation: 5,
        customerInspections: 0,
      },
      {
        status: 'Finishes',
        observations: 5,
        documentation: 5,
        customerInspections: 0,
      },
      {
        status: 'Finishes + Customer Inspections',
        observations: 4,
        documentation: 2,
        customerInspections: 4,
      },
    ],
  })
  categoryWeights: any[];

  // Deduction points based on % of pending observations
  @Column('jsonb', {
    default: [
      { min: 0, max: 0, points: 0 },
      { min: 1, max: 24, points: 1 },
      { min: 25, max: 49, points: 1.25 },
      { min: 50, max: 74, points: 1.5 },
      { min: 75, max: 100, points: 1.75 },
    ],
  })
  deductionRules: any[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
