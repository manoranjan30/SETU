import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PermissionAction {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  SPECIAL = 'SPECIAL',
}

export enum PermissionScope {
  SYSTEM = 'SYSTEM',
  COMPANY = 'COMPANY',
  PROJECT = 'PROJECT',
  NODE = 'NODE',
}

@Entity()
export class Permission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  permissionCode: string; // e.g., EPS.NODE.CREATE

  @Column()
  permissionName: string; // Readable name

  @Column()
  moduleName: string; // e.g., EPS, AUTH

  @Column({ nullable: true })
  entityName: string; // e.g., NODE, USER

  @Column({
    type: 'enum',
    enum: PermissionAction,
    default: PermissionAction.READ,
  })
  actionType: PermissionAction;

  @Column({
    type: 'enum',
    enum: PermissionScope,
    default: PermissionScope.SYSTEM,
  })
  scopeLevel: PermissionScope;

  @Column({ nullable: true })
  description: string;

  @Column({ default: true })
  isSystem: boolean; // Cannot be deleted manually

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdOn: Date;

  @UpdateDateColumn()
  updatedOn: Date;
}
