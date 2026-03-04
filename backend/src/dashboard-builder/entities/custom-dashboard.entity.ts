import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { EpsNode } from '../../eps/eps.entity';
import { DashboardWidget } from './dashboard-widget.entity';
import { DashboardAssignment } from './dashboard-assignment.entity';

@Entity('custom_dashboard')
export class CustomDashboard {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 50, default: 'PROJECT' })
  scope: 'PROJECT' | 'GLOBAL';

  @Column({ nullable: true })
  projectId: number;

  @ManyToOne(() => EpsNode, { nullable: true })
  @JoinColumn({ name: 'projectId' })
  project: EpsNode;

  @Column({ type: 'jsonb', nullable: true })
  layoutConfig: any;

  @Column({ default: false })
  isTemplate: boolean;

  @Column({ default: false })
  isDefault: boolean;

  @Column({ nullable: true })
  createdById: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => DashboardWidget, (widget) => widget.dashboard, {
    cascade: true,
  })
  widgets: DashboardWidget[];

  @OneToMany(() => DashboardAssignment, (assignment) => assignment.dashboard, {
    cascade: true,
  })
  assignments: DashboardAssignment[];
}
