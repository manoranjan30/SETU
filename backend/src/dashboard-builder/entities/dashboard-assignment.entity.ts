import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CustomDashboard } from './custom-dashboard.entity';
import { Role } from '../../roles/role.entity';
import { User } from '../../users/user.entity';
import { EpsNode } from '../../eps/eps.entity';

@Entity('dashboard_assignment')
export class DashboardAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  dashboardId: number;

  @ManyToOne(() => CustomDashboard, (dashboard) => dashboard.assignments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'dashboardId' })
  dashboard: CustomDashboard;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'ROLE',
  })
  assignmentType: 'ROLE' | 'USER' | 'DEFAULT_GLOBAL' | 'DEFAULT_PROJECT';

  @Column({ nullable: true })
  roleId: number;

  @ManyToOne(() => Role, { nullable: true })
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @Column({ nullable: true })
  userId: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  projectId: number;

  @ManyToOne(() => EpsNode, { nullable: true })
  @JoinColumn({ name: 'projectId' })
  project: EpsNode;

  @Column({ default: 0 })
  priority: number;
}
