import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('notification_log')
export class NotificationLog {
  @PrimaryGeneratedColumn()
  id: number;

  /** Notification type string, e.g. 'QUALITY_OBS_RAISED' */
  @Column()
  type: string;

  @Column({ type: 'int', nullable: true })
  projectId: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  permissionCode: string | null;

  @Column({ type: 'int', nullable: true })
  roleId: number | null;

  @Column({ default: 0 })
  recipientCount: number;

  @Column({ default: 0 })
  successCount: number;

  @Column({ default: 0 })
  failureCount: number;

  @Column({ type: 'jsonb', nullable: true })
  failedTokens: string[] | null;

  @CreateDateColumn()
  sentAt: Date;
}
