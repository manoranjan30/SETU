import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PluginInstall } from './plugin-install.entity';

@Entity()
export class PluginPermission {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => PluginInstall, (pluginInstall) => pluginInstall.permissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  pluginInstall: PluginInstall;

  @Column()
  permissionCode: string;

  @Column()
  permissionName: string;

  @Column()
  moduleName: string;

  @Column({ default: 'PROJECT' })
  scopeLevel: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;
}
