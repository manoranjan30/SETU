import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Role } from '../roles/role.entity';
import { EpsNode } from './eps.entity';

export enum AccessType {
  ALLOW = 'ALLOW',
  DENY = 'DENY',
}

@Entity()
export class UserRoleNodeAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Role, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @ManyToOne(() => EpsNode, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eps_node_id' })
  epsNode: EpsNode;

  @Column({ default: true })
  appliesToSubtree: boolean;

  @Column({ type: 'enum', enum: AccessType, default: AccessType.ALLOW })
  accessType: AccessType;

  @CreateDateColumn()
  createdOn: Date;
}
