import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Activity } from './activity.entity';

@Entity()
export class ActivitySchedule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  activityId: number;

  @OneToOne(() => Activity, (activity) => activity.schedule, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'activity_id' })
  activity: Activity;

  @Column({ type: 'date', nullable: true })
  earlyStart: Date;

  @Column({ type: 'date', nullable: true })
  earlyFinish: Date;

  @Column({ type: 'date', nullable: true })
  lateStart: Date;

  @Column({ type: 'date', nullable: true })
  lateFinish: Date;

  @Column({ type: 'int', default: 0 })
  totalFloat: number;

  @Column({ type: 'int', default: 0 })
  freeFloat: number;

  @Column({ default: false })
  isCritical: boolean;

  @Column({ type: 'timestamp', nullable: true })
  calculatedOn: Date;

  // Audit
  @CreateDateColumn()
  createdOn: Date;

  @UpdateDateColumn()
  updatedOn: Date;
}
