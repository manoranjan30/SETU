import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ActionPreset } from './action-preset.entity';

@Entity()
export class RoleTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ default: 'Briefcase' })
  icon: string;

  @Column({ default: false })
  isSystem: boolean;

  @Column({ default: false })
  isLocked: boolean;

  @Column({ default: true })
  isActive: boolean;

  @ManyToMany(() => ActionPreset, { eager: true })
  @JoinTable()
  presets: ActionPreset[];
}
