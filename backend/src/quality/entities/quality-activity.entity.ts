import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QualityActivityList } from './quality-activity-list.entity';
import { QualitySequenceEdge } from './quality-sequence-edge.entity';

import { QualityChecklistTemplate } from './quality-checklist-template.entity';

export type ResponsibleParty = 'Contractor' | 'Consultant' | 'Client';

export enum QualityActivityStatus {
  NOT_STARTED = 'NOT_STARTED',
  RFI_RAISED = 'RFI_RAISED',
  UNDER_INSPECTION = 'UNDER_INSPECTION',
  PENDING_OBSERVATION = 'PENDING_OBSERVATION',
  APPROVED = 'APPROVED',
  PROVISIONALLY_APPROVED = 'PROVISIONALLY_APPROVED',
}

export enum QualityApplicabilityLevel {
  FLOOR = 'FLOOR',
  UNIT = 'UNIT',
  ROOM = 'ROOM',
}

@Entity('quality_activity')
export class QualityActivity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  listId: number;

  @ManyToOne(() => QualityActivityList, (l) => l.activities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'listId' })
  list: QualityActivityList;

  @Column({ type: 'int', default: 0 })
  sequence: number;

  @Column({ length: 255 })
  activityName: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  /** Self-referential: points to the activity that must be completed before this one */
  @Column({ nullable: true })
  previousActivityId: number;

  @Column({ default: false })
  holdPoint: boolean;

  @Column({ default: false })
  witnessPoint: boolean;

  @Column({ length: 50, default: 'Contractor' })
  responsibleParty: string;

  /** If true, RFI can be raised for this activity even if predecessor is not approved */
  @Column({ default: false })
  allowBreak: boolean;

  @Column({
    type: 'enum',
    enum: QualityApplicabilityLevel,
    default: QualityApplicabilityLevel.FLOOR,
  })
  applicabilityLevel: QualityApplicabilityLevel;

  @Column({
    type: 'enum',
    enum: QualityActivityStatus,
    default: QualityActivityStatus.NOT_STARTED,
  })
  status: QualityActivityStatus;

  @Column('int', { array: true, default: [] })
  assignedChecklistIds: number[];

  @Column({ default: false })
  requiresPourCard: boolean;

  @Column({ default: false })
  requiresPourClearanceCard: boolean;

  @Column({ type: 'jsonb', name: 'floor_visibility', nullable: true })
  floorVisibility: {
    mode?: 'ALL' | 'RESTRICTED';
    selectedNodeIds?: number[];
    selectedBlockIds?: number[];
    selectedTowerIds?: number[];
    selectedFloorIds?: number[];
    version?: number;
  } | null;

  @ManyToOne(() => QualityActivity, { nullable: true })
  @JoinColumn({ name: 'previousActivityId' })
  previousActivity: QualityActivity;

  @OneToMany(() => QualitySequenceEdge, (edge) => edge.source)
  outgoingEdges: QualitySequenceEdge[];

  @OneToMany(() => QualitySequenceEdge, (edge) => edge.target)
  incomingEdges: QualitySequenceEdge[];

  @Column({ type: 'jsonb', nullable: true, default: { x: 0, y: 0 } })
  position: { x: number; y: number }; // For canvas layout

  @Column({ nullable: true })
  checklistTemplateId: number;

  @ManyToOne(() => QualityChecklistTemplate)
  @JoinColumn({ name: 'checklistTemplateId' })
  checklistTemplate: QualityChecklistTemplate;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
