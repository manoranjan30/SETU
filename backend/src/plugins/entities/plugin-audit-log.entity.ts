import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class PluginAuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  pluginKey: string;

  @Column()
  action: string;

  @Column({ type: 'int', nullable: true })
  actorUserId: number | null;

  @Column({ type: 'int', nullable: true })
  pluginInstallId: number | null;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;
}
