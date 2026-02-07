import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { ActivityVersion } from './activity-version.entity';

export enum ScheduleVersionType {
  BASELINE = 'BASELINE',
  REVISED = 'REVISED',
  WORKING = 'WORKING',
}

@Entity()
export class ScheduleVersion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column()
  versionCode: string; // e.g., "BL1", "R1", "Current"

  @Column({
    type: 'enum',
    enum: ScheduleVersionType,
    default: ScheduleVersionType.WORKING,
  })
  versionType: ScheduleVersionType;

  @Column({ default: 0 })
  sequenceNumber: number; // 0 for Baseline/R0, incremented for revisions

  @Column({ nullable: true })
  parentVersionId: number | null;

  @ManyToOne(() => ScheduleVersion, { onDelete: 'NO ACTION' }) // Prevent delete cascade to protect chain
  @JoinColumn({ name: 'parentVersionId' })
  parentVersion?: ScheduleVersion;

  @Column({ default: false })
  isActive: boolean; // Only one active working schedule per project usually

  @Column({ default: false })
  isLocked: boolean; // Baselines are locked

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column()
  createdBy: string;

  @CreateDateColumn()
  createdOn: Date;

  @UpdateDateColumn()
  updatedOn: Date;

  @OneToMany(() => ActivityVersion, (av) => av.scheduleVersion)
  activityVersions: ActivityVersion[];
}
