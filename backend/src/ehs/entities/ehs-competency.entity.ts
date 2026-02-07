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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
