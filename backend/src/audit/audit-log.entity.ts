import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity()
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  action: string; // CREATE, UPDATE, DELETE, IMPORT

  @Column()
  resourceType: string; // BOQ_ITEM, SUB_ITEM, MEASUREMENT

  @Column()
  resourceId: string; // Stored as string to be generic

  @Column({ type: 'text', nullable: true })
  details: string; // JSON string of changes or snapshot

  @Column()
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  timestamp: Date;
}
