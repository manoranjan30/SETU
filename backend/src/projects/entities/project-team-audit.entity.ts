import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('project_team_audit')
export class ProjectTeamAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id', nullable: true })
  projectId: number; // EPS Node ID

  @Column({ name: 'action_type', nullable: true })
  actionType: string; // ADD, UPDATE, REMOVE, ACTIVATE, DEACTIVATE

  @Column({ name: 'performed_by_user_id', nullable: true })
  performedByUserId: number;

  @Column({ name: 'target_user_id', nullable: true })
  targetUserId: number;

  @Column('jsonb', { nullable: true })
  details: any; // e.g. { oldRole: 'Viewer', newRole: 'Manager' }

  @CreateDateColumn({ name: 'performed_at' })
  performedAt: Date;
}
