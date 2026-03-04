import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { CustomDashboard } from './custom-dashboard.entity';
import { User } from '../../users/user.entity';

@Entity('dashboard_share_log')
export class DashboardShareLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  dashboardId: number;

  @ManyToOne(() => CustomDashboard, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dashboardId' })
  dashboard: CustomDashboard;

  @Column()
  sharedById: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sharedById' })
  sharedBy: User;

  @Column()
  sharedWithUserId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sharedWithUserId' })
  sharedWithUser: User;

  @CreateDateColumn()
  sharedAt: Date;

  @Column({ type: 'varchar', length: 20, default: 'VIEW' })
  accessLevel: 'VIEW' | 'EDIT';
}
