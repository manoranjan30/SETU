import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ehs_competencies')
export class EhsCompetency {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column()
  name: string;

  @Column()
  role: string; // Operator, Driver, etc.

  @Column()
  vehicleMachine: string; // Machine assigned

  @Column({ type: 'date', nullable: true })
  licenseExpiry: string;

  @Column({ type: 'date', nullable: true })
  fitnessExpiry: string; // Medical/Physical fitness

  @Column({ default: false })
  fitnessExpiryNotApplicable: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  documentUrl: string | null;

  @Column({ type: 'text', nullable: true })
  documentOriginalName: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  documentMimeType: string | null;

  @Column({ type: 'bigint', nullable: true })
  documentSize: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
