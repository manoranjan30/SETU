import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  ManyToMany,
  JoinTable,
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
@Index(['status'])
export class UserProjectAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // The Project Node (Must be Type=PROJECT)
  @ManyToOne(() => EpsNode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: EpsNode;

  // The Roles assigned for this project context
  @ManyToMany(() => Role)
  @JoinTable({
    name: 'user_project_assignment_roles',
    joinColumn: { name: 'assignment_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles: Role[];

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
