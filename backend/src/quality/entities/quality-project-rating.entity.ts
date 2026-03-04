import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { EpsNode } from '../../eps/eps.entity';

@Entity('quality_project_rating')
export class ProjectRating {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'project_node_id' })
  projectNodeId: number;

  @ManyToOne(() => EpsNode)
  @JoinColumn({ name: 'project_node_id' })
  projectNode: EpsNode;

  // Rating Period (e.g., '2026-03')
  @Column()
  period: string;

  @Column('float')
  overallScore: number;

  @Column('float')
  observationScore: number;

  @Column('float')
  documentationScore: number;

  @Column('float')
  customerInspectionScore: number;

  @Column('float')
  pendingDeduction: number;

  @Column('integer')
  totalObservations: number;

  @Column('integer')
  openObservations: number;

  @Column('float')
  pendingRatioPercentage: number;

  @Column('jsonb', { nullable: true })
  details: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
