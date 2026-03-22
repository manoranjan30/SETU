import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PluginInstall } from './plugin-install.entity';

@Entity()
export class PluginWidget {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => PluginInstall, (pluginInstall) => pluginInstall.widgets, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  pluginInstall: PluginInstall;

  @Column()
  widgetKey: string;

  @Column()
  title: string;

  @Column()
  widgetType: string;

  @Column({ type: 'varchar', nullable: true })
  permissionCode: string | null;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, any> | null;
}
