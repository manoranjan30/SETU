import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PluginInstall } from './plugin-install.entity';

@Entity()
export class PluginPage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => PluginInstall, (pluginInstall) => pluginInstall.pages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  pluginInstall: PluginInstall;

  @Column()
  pageKey: string;

  @Column()
  title: string;

  @Column()
  rendererType: string;

  @Column({ type: 'varchar', nullable: true })
  routePath: string | null;

  @Column({ type: 'varchar', nullable: true })
  permissionCode: string | null;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, any> | null;
}
