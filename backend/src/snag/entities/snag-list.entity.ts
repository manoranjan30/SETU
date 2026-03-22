import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { EpsNode } from '../../eps/eps.entity';
import { QualityUnit } from '../../quality/entities/quality-unit.entity';
import { User } from '../../users/user.entity';
import { SnagRound } from './snag-round.entity';

export enum SnagListStatus {
  SNAGGING = 'snagging',
  DESNAGGING = 'desnagging',
  RELEASED = 'released',
  HANDOVER_READY = 'handover_ready',
}

export const SNAG_COMMON_CHECKLIST_STATUSES = [
  'IDENTIFIED',
  'RECTIFIED',
  'NA',
] as const;

export type SnagCommonChecklistStatus =
  (typeof SNAG_COMMON_CHECKLIST_STATUSES)[number];

export interface SnagCommonChecklistItem {
  id: string;
  title: string;
  qualityRoomId: number | null;
  roomLabel: string | null;
  trade: string | null;
  sequence: number;
  status: SnagCommonChecklistStatus;
  remarks: string | null;
  linkedSnagItemId: number | null;
  updatedAt: string | null;
  updatedById: number | null;
}

@Entity('snag_list')
@Unique('UQ_snag_list_project_quality_unit', ['projectId', 'qualityUnitId'])
export class SnagList {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'project_id' })
  projectId: number;

  @Column({ name: 'eps_node_id', type: 'int', nullable: true })
  epsNodeId: number | null;

  @ManyToOne(() => EpsNode, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'eps_node_id' })
  epsNode: EpsNode | null;

  @Column({ name: 'quality_unit_id' })
  qualityUnitId: number;

  @ManyToOne(() => QualityUnit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quality_unit_id' })
  qualityUnit: QualityUnit;

  @Column({ name: 'unit_label', length: 100 })
  unitLabel: string;

  @Column({ name: 'current_round', type: 'int', default: 1 })
  currentRound: number;

  @Column({
    name: 'overall_status',
    type: 'enum',
    enum: SnagListStatus,
    default: SnagListStatus.SNAGGING,
  })
  overallStatus: SnagListStatus;

  @Column({
    name: 'common_checklist',
    type: 'jsonb',
    default: () => "'[]'",
  })
  commonChecklist: SnagCommonChecklistItem[];

  @Column({ name: 'created_by_id', type: 'int', nullable: true })
  createdById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User | null;

  @OneToMany(() => SnagRound, (round) => round.snagList, { cascade: true })
  rounds: SnagRound[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
