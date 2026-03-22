import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PluginInstall } from './plugin-install.entity';

@Entity()
export class PluginMenu {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => PluginInstall, (pluginInstall) => pluginInstall.menus, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  pluginInstall: PluginInstall;

  @Column()
  menuKey: string;

  @Column()
  label: string;

  @Column({ default: 'SIDEBAR' })
  location: string;

  @Column({ type: 'varchar', nullable: true })
  pageKey: string | null;

  @Column({ type: 'varchar', nullable: true })
  pathTemplate: string | null;

  @Column({ type: 'varchar', nullable: true })
  icon: string | null;

  @Column({ type: 'varchar', nullable: true })
  permissionCode: string | null;

  @Column({ default: false })
  requiresProject: boolean;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, any> | null;
}
