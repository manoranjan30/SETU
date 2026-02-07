import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class ProjectCalendar {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  // Default: Mon(1) to Fri(5)
  @Column('simple-array', { default: '1,2,3,4,5' })
  workingDays: string[]; // TypeORM simple-array stores as string

  // ISO Date Strings "YYYY-MM-DD"
  @Column('simple-array', { default: '' })
  holidays: string[];

  @Column({ default: '09:00' })
  defaultStartTime: string;

  @Column({ default: '17:00' })
  defaultEndTime: string;

  @CreateDateColumn()
  createdOn: Date;

  @UpdateDateColumn()
  updatedOn: Date;
}
