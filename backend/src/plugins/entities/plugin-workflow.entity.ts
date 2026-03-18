import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PluginInstall } from './plugin-install.entity';

@Entity()
export class PluginWorkflow {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => PluginInstall, (pluginInstall) => pluginInstall.workflows, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  pluginInstall: PluginInstall;

  @Column()
  workflowKey: string;

  @Column()
  processCode: string;

  @Column()
  moduleCode: string;

  @Column({ type: 'varchar', nullable: true })
  permissionCode: string | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, any> | null;
}
