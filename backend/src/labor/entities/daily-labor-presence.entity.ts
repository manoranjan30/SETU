import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LaborCategory } from './labor-category.entity';

@Entity('daily_labor_presence')
export class DailyLaborPresence {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column({ type: 'date' })
  date: string;

  @Column()
  categoryId: number;

  @ManyToOne(() => LaborCategory)
  @JoinColumn({ name: 'categoryId' })
  category: LaborCategory;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  count: number;

  @Column({ nullable: true })
  contractorName: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @CreateDateColumn()
  createdOn: Date;

  @UpdateDateColumn()
  updatedOn: Date;

  @Column({ nullable: true })
  updatedBy: string;
}
