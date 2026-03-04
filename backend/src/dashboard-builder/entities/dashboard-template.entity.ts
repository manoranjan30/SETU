import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';

@Entity('dashboard_template')
export class DashboardTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'varchar', length: 100 })
  category: string; // 'Construction', 'Finance', 'Safety', etc.

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  thumbnailUrl: string;

  @Column({ type: 'jsonb', nullable: true })
  layoutConfig: any;

  @Column({ type: 'jsonb', nullable: true })
  widgetsConfig: any[];

  @Column({ default: false })
  isSystemTemplate: boolean;

  @Column({ nullable: true })
  createdById: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;
}
