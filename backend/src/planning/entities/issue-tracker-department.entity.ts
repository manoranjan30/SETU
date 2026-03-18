import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('issue_tracker_departments')
export class IssueTrackerDepartment {
  @PrimaryGeneratedColumn()
  id: number;

  // Global — no projectId (departments are master data across all projects)

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  color: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  icon: string | null;

  @Column({ type: 'int', default: 0 })
  sequenceOrder: number;

  @Column({ type: 'int', nullable: true })
  defaultSlaDays: number | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
