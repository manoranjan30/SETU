import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { EpsNode } from '../../eps/eps.entity';
import { User } from '../../users/user.entity';
import { Role } from '../../roles/role.entity';

export enum WbsStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

import { Activity } from './activity.entity';

@Entity()
export class WbsNode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'project_id' })
  projectId: number;

  @ManyToOne(() => EpsNode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: EpsNode;

  @Column({ name: 'parent_id', nullable: true })
  parentId: number | null;

  @ManyToOne(() => WbsNode, (node) => node.children, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id' })
  parent: WbsNode;

  @OneToMany(() => WbsNode, (node) => node.parent)
  children: WbsNode[];

  @Column({ name: 'wbs_code' })
  wbsCode: string;

  @Column({ name: 'wbs_name' })
  wbsName: string;

  @Column({ name: 'wbs_level', default: 1 })
  wbsLevel: number;

  @Column({ name: 'sequence_no', default: 0 })
  sequenceNo: number;

  @Column({ nullable: true })
  discipline: string; // e.g., Civil, Mechanical

  @Column({ name: 'is_control_account', default: false })
  isControlAccount: boolean;

  @Column({ name: 'responsible_role_id', nullable: true })
  responsibleRoleId: number | null;

  @ManyToOne(() => Role, { nullable: true })
  @JoinColumn({ name: 'responsible_role_id' })
  responsibleRole: Role;

  @Column({ name: 'responsible_user_id', nullable: true })
  responsibleUserId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'responsible_user_id' })
  responsibleUser: User;

  @Column({ type: 'enum', enum: WbsStatus, default: WbsStatus.ACTIVE })
  status: WbsStatus;

  // Rollup Fields
  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: Date | null;

  @Column({ name: 'finish_date', type: 'date', nullable: true })
  finishDate: Date | null;

  @Column({ name: 'start_date_actual', type: 'date', nullable: true })
  startDateActual: Date | null;

  @Column({ name: 'finish_date_actual', type: 'date', nullable: true })
  finishDateActual: Date | null;

  @Column({ name: 'start_date_baseline', type: 'date', nullable: true })
  startDateBaseline: Date | null;

  @Column({ name: 'finish_date_baseline', type: 'date', nullable: true })
  finishDateBaseline: Date | null;

  @Column({ name: 'start_date_planned', type: 'date', nullable: true })
  startDatePlanned: Date | null;

  @Column({ name: 'finish_date_planned', type: 'date', nullable: true })
  finishDatePlanned: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  duration: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  percentComplete: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  budgetedValue: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  actualValue: number;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string; // Username

  @CreateDateColumn({ name: 'created_on' })
  createdOn: Date;

  @UpdateDateColumn({ name: 'updated_on' })
  updatedOn: Date;

  @OneToMany(() => Activity, (activity) => activity.wbsNode)
  activities: Activity[];
}
