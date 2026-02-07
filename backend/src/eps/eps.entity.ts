import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';
import { ProjectProfile } from './project-profile.entity';

export enum EpsNodeType {
  COMPANY = 'COMPANY',
  PROJECT = 'PROJECT',
  BLOCK = 'BLOCK',
  TOWER = 'TOWER',
  FLOOR = 'FLOOR',
  UNIT = 'UNIT',
  ROOM = 'ROOM',
}

@Entity()
export class EpsNode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: EpsNodeType,
  })
  type: EpsNodeType;

  @Column({ nullable: true })
  parentId: number;

  @ManyToOne(() => EpsNode, (node) => node.children, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'parentId' })
  parent: EpsNode;

  @OneToMany(() => EpsNode, (node) => node.parent)
  children: EpsNode[];

  @Column({ default: 0 })
  order: number;

  @Column({ default: 'system' })
  createdBy: string;

  @Column({ default: 'system' })
  updatedBy: string;

  @OneToOne(() => ProjectProfile, (profile) => profile.epsNode, {
    cascade: true,
  })
  projectProfile: ProjectProfile;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
