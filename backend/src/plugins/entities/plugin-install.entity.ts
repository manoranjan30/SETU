import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PluginPackage } from './plugin-package.entity';
import { User } from '../../users/user.entity';
import { PluginPermission } from './plugin-permission.entity';
import { PluginMenu } from './plugin-menu.entity';
import { PluginPage } from './plugin-page.entity';
import { PluginWidget } from './plugin-widget.entity';
import { PluginReport } from './plugin-report.entity';
import { PluginWorkflow } from './plugin-workflow.entity';
import { PluginSetting } from './plugin-setting.entity';

@Entity()
export class PluginInstall {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => PluginPackage, (pluginPackage) => pluginPackage.installs, {
    eager: true,
  })
  @JoinColumn()
  pluginPackage: PluginPackage;

  @Column()
  pluginKey: string;

  @Column()
  version: string;

  @Column({ default: 'ENABLED' })
  status: string;

  @Column({ type: 'jsonb', nullable: true })
  installPolicy: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  uninstallPolicy: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  settingsSchema: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  settingsValues: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  archivedConfig: Record<string, any> | null;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn()
  installedBy: User | null;

  @Column({ type: 'timestamp', nullable: true })
  enabledAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  disabledAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  uninstalledAt: Date | null;

  @OneToMany(() => PluginPermission, (permission) => permission.pluginInstall)
  permissions: PluginPermission[];

  @OneToMany(() => PluginMenu, (menu) => menu.pluginInstall)
  menus: PluginMenu[];

  @OneToMany(() => PluginPage, (page) => page.pluginInstall)
  pages: PluginPage[];

  @OneToMany(() => PluginWidget, (widget) => widget.pluginInstall)
  widgets: PluginWidget[];

  @OneToMany(() => PluginReport, (report) => report.pluginInstall)
  reports: PluginReport[];

  @OneToMany(() => PluginWorkflow, (workflow) => workflow.pluginInstall)
  workflows: PluginWorkflow[];

  @OneToMany(() => PluginSetting, (setting) => setting.pluginInstall)
  settings: PluginSetting[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
