import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { EpsNode } from '../../eps/eps.entity';
import { Role } from '../../roles/role.entity';

export enum ProjectScopeType {
  FULL = 'FULL',
  LIMITED = 'LIMITED',
}

export enum AssignmentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

@Entity('user_project_assignment')
@Index(['user', 'project', 'status']) // Common query pattern
export class UserProjectAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', insert: false, update: false })
  userId: number;

  // The Project Node (Must be Type=PROJECT)
  @ManyToOne(() => EpsNode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: EpsNode;

  @Column({ name: 'project_id', insert: false, update: false })
  projectId: number;

  // The Role assigned for this project context
  @ManyToOne(() => Role)
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Column({ name: 'role_id', insert: false, update: false })
  roleId: number;

  @Column({
    type: 'enum',
    enum: ProjectScopeType,
    default: ProjectScopeType.FULL,
  })
  scopeType: ProjectScopeType;

  // If Limited, which Node defines the boundary? (e.g. A Block or Tower)
  @ManyToOne(() => EpsNode, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'scope_node_id' })
  scopeNode: EpsNode | null;

  @Column({
    name: 'scope_node_id',
    nullable: true,
    insert: false,
    update: false,
  })
  scopeNodeId: number | null;

  @Column({
    type: 'enum',
    enum: AssignmentStatus,
    default: AssignmentStatus.ACTIVE,
  })
  status: AssignmentStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
