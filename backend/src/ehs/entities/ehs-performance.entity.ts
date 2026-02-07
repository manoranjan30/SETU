import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ehs_performance')
export class EhsPerformance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column({ type: 'date' })
  month: string; // YYYY-MM-01

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  ehsRating: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  housekeepingRating: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
