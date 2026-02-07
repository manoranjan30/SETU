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
import { Activity } from '../../wbs/entities/activity.entity';

@Entity('activity_labor_update')
export class ActivityLaborUpdate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  activityId: number;

  @ManyToOne(() => Activity)
  @JoinColumn({ name: 'activityId' })
  activity: Activity;

  @Column({ type: 'date' })
  date: string;

  @Column()
  categoryId: number;

  @ManyToOne(() => LaborCategory)
  @JoinColumn({ name: 'categoryId' })
  category: LaborCategory;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  count: number;

  @CreateDateColumn()
  createdOn: Date;

  @UpdateDateColumn()
  updatedOn: Date;

  @Column({ nullable: true })
  updatedBy: string;
}
