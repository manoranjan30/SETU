import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('issue_tracker_tags')
export class IssueTrackerTag {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  projectId: number;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'int' })
  departmentId: number;

  @Column({ type: 'varchar', length: 150, nullable: true })
  departmentName: string | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
