import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { PluginInstall } from './plugin-install.entity';

@Entity()
@Unique(['pluginKey', 'version'])
export class PluginPackage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  pluginKey: string;

  @Column()
  name: string;

  @Column()
  version: string;

  @Column({ type: 'varchar', nullable: true })
  author: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column()
  appCompatibility: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  capabilities: string[];

  @Column({ type: 'jsonb' })
  manifestJson: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  bundleJson: Record<string, any> | null;

  @Column({ default: 'APPROVED' })
  approvalStatus: string;

  @Column({ type: 'varchar', nullable: true })
  approvalSource: string | null;

  @Column({ type: 'varchar', nullable: true })
  checksum: string | null;

  @OneToMany(() => PluginInstall, (install) => install.pluginPackage)
  installs: PluginInstall[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
