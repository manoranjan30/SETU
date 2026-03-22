import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PluginInstall } from './plugin-install.entity';

@Entity()
export class PluginSetting {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => PluginInstall, (pluginInstall) => pluginInstall.settings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  pluginInstall: PluginInstall;

  @Column()
  settingKey: string;

  @Column()
  label: string;

  @Column()
  fieldType: string;

  @Column({ default: false })
  required: boolean;

  @Column({ type: 'jsonb', nullable: true })
  defaultValue: any;

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, any> | null;

  @Column({ default: 0 })
  sortOrder: number;
}
