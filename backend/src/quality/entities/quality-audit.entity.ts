import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('quality_audits')
export class QualityAudit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column()
  auditType: string; // Internal, External, Client Audit

  @Column()
  auditorName: string;

  @Column({ type: 'date' })
  auditDate: string;

  @Column()
  scope: string; // Foundations, Overall project, Structure only

  @Column({ type: 'text', nullable: true })
  findings: string;

  @Column({ default: 0 })
  nonConformancesCount: number;

  @Column({ default: 0 })
  observationsCount: number;

  @Column({ default: 'Completed' })
  status: string; // Scheduled, In Progress, Completed

  @Column({ nullable: true })
  reportUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
