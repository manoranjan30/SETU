import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('quality_inspections')
export class QualityInspection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column()
  inspectionType: string; // ITP, WIR

  @Column()
  description: string;

  @Column({ nullable: true })
  location: string; // Floor, Zone, Unit

  @Column({ nullable: true })
  trade: string; // Civil, MEP, Finishes

  @Column({ default: 'Pending' })
  status: string; // Pending, In Progress, Pass, Fail, Conditional

  @Column({ type: 'date' })
  scheduledDate: string;

  @Column({ type: 'date', nullable: true })
  inspectedDate: string;

  @Column({ nullable: true })
  inspectedBy: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ nullable: true })
  attachmentUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
