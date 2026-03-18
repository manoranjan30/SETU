import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PluginInstall } from './plugin-install.entity';

@Entity()
export class PluginReport {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => PluginInstall, (pluginInstall) => pluginInstall.reports, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  pluginInstall: PluginInstall;

  @Column()
  reportKey: string;

  @Column()
  title: string;

  @Column({ type: 'varchar', nullable: true })
  permissionCode: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  exportTypes: string[];

  @Column({ type: 'varchar', nullable: true })
  dataSourceKey: string | null;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, any> | null;
}
