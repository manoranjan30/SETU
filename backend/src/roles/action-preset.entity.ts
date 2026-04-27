import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Permission } from '../permissions/permission.entity';

@Entity()
export class ActionPreset {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column()
  group: string;

  @Column({ type: 'int' })
  tier: 1 | 2 | 3;

  @Column({ default: 'ShieldCheck' })
  icon: string;

  @Column({ default: false })
  isSystem: boolean;

  @Column({ default: false })
  isLocked: boolean;

  @Column({ default: true })
  isActive: boolean;

  @ManyToMany(() => Permission, { eager: true })
  @JoinTable()
  permissions: Permission[];
}
