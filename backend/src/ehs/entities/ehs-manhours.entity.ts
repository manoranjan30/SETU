import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ehs_manhours')
export class EhsManhours {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column({ type: 'date' })
  month: string; // YYYY-MM-01

  @Column({ default: 0 })
  staffMale: number;

  @Column({ default: 0 })
  staffFemale: number;

  @Column({ default: 0 })
  workersMale: number;

  @Column({ default: 0 })
  workersFemale: number;

  @Column({ default: 0 })
  totalWorkers: number;

  @Column({ default: 0 })
  totalManpower: number; // Staff + Workers

  @Column({ default: 0 })
  workingDays: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 8 })
  avgWorkHours: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalManhours: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  ltiDeductions: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  safeManhours: number;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
