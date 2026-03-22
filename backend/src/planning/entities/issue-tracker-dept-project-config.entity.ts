import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('issue_tracker_dept_project_config')
export class IssueTrackerDeptProjectConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  projectId: number;

  @Column({ type: 'int' })
  departmentId: number;

  @Column({ type: 'varchar', length: 150 })
  departmentName: string;

  @Column({ type: 'jsonb', nullable: true })
  memberUserIds: number[] | null;

  @Column({ type: 'int', nullable: true })
  coordinatorUserId: number | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  coordinatorName: string | null;

  @Column({ type: 'boolean', default: true })
  isIncludedInDefaultFlow: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
