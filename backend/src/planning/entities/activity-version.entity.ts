import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ScheduleVersion } from './schedule-version.entity';
import { Activity } from '../../wbs/entities/activity.entity';

@Entity()
export class ActivityVersion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  versionId: number;

  @ManyToOne(() => ScheduleVersion, (version) => version.activityVersions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'versionId' })
  scheduleVersion: ScheduleVersion;

  @Column()
  activityId: number;

  @ManyToOne(() => Activity, { onDelete: 'CASCADE' }) // If master activity is deleted, version data should arguably go too? Or stay as orphan history? CASCADE is safer for now.
  @JoinColumn({ name: 'activityId' })
  activity: Activity;

  // Versioned Date Fields
  @Column({ type: 'date', nullable: true })
  startDate: Date | null;

  @Column({ type: 'date', nullable: true })
  finishDate: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  duration: number;

  // Calculated Fields specific to this version
  @Column({ default: false })
  isCritical: boolean;

  @Column({ type: 'int', default: 0 })
  totalFloat: number;

  @Column({ type: 'int', default: 0 })
  freeFloat: number;

  @Column({ type: 'text', nullable: true })
  remarks: string;
}
