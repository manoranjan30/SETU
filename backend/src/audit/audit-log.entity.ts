import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'project_id', nullable: true })
  projectId: number;

  @Column()
  module: string; // e.g. 'SCHEDULE', 'QUALITY', 'BOQ'

  @Column()
  action: string; // e.g. 'CREATE', 'UPDATE', 'DELETE', 'APPROVE'

  @Column({ name: 'record_id', nullable: true })
  recordId: string;

  @Column({ type: 'jsonb', nullable: true })
  details: any;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string;

  @CreateDateColumn()
  timestamp: Date;
}
