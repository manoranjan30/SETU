import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ehs_inspections')
export class EhsInspection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column()
  inspectionName: string;

  @Column({ default: 'Pending' })
  status: string; // Completed, Pending, Overdue

  @Column({ type: 'date', nullable: true })
  month: string; // YYYY-MM-01

  @Column({ type: 'date', nullable: true })
  dueDate: string;

  @Column({ type: 'date', nullable: true })
  completedDate: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
