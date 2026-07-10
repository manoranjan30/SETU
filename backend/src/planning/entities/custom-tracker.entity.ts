import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CustomTrackerStatus = 'ACTIVE' | 'ARCHIVED';
export type CustomTrackerRecordStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'BLOCKED'
  | 'ON_HOLD';
export type CustomTrackerFieldType =
  | 'TEXT'
  | 'NUMBER'
  | 'DATE'
  | 'BOOLEAN'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'PERCENT'
  | 'STATUS'
  | 'USER'
  | 'CURRENCY'
  | 'FORMULA';

@Entity('planning_custom_trackers')
@Index('IDX_planning_custom_trackers_project_status', ['projectId', 'status'])
export class PlanningCustomTracker {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  projectId: number;

  @Column({ type: 'varchar', length: 180 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 80, default: 'GENERAL' })
  trackerType: string;

  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' })
  status: CustomTrackerStatus;

  @Column({ type: 'text', array: true, default: () => 'ARRAY[]::text[]' })
  locationScopeTypes: string[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  categoryConfig: Array<{
    key: string;
    label: string;
    options?: string[];
  }>;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  chartConfig: Record<string, any>;

  @Column({ type: 'int', nullable: true })
  createdByUserId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('planning_custom_tracker_fields')
@Index('IDX_planning_custom_tracker_fields_tracker_sequence', [
  'trackerId',
  'sequence',
])
export class PlanningCustomTrackerField {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  trackerId: number;

  @Column({ type: 'varchar', length: 120 })
  label: string;

  @Column({ type: 'varchar', length: 120 })
  key: string;

  @Column({ type: 'varchar', length: 32, default: 'TEXT' })
  fieldType: CustomTrackerFieldType;

  @Column({ type: 'boolean', default: false })
  required: boolean;

  @Column({ type: 'varchar', length: 40, nullable: true })
  unit: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  options: string[];

  @Column({ type: 'text', nullable: true })
  formula: string | null;

  @Column({ type: 'int', default: 0 })
  sequence: number;

  @Column({ type: 'boolean', default: false })
  isKpi: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('planning_custom_tracker_records')
@Index('IDX_planning_custom_tracker_records_tracker_status', [
  'trackerId',
  'status',
])
@Index('IDX_planning_custom_tracker_records_project_location', [
  'projectId',
  'epsNodeId',
])
export class PlanningCustomTrackerRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  trackerId: number;

  @Column({ type: 'int' })
  projectId: number;

  @Column({ type: 'int', nullable: true })
  epsNodeId: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  locationText: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  categoryValues: Record<string, string>;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  values: Record<string, any>;

  @Column({ type: 'varchar', length: 32, default: 'NOT_STARTED' })
  status: CustomTrackerRecordStatus;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  progressPercent: number;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({ type: 'int', nullable: true })
  createdByUserId: number | null;

  @Column({ type: 'int', nullable: true })
  updatedByUserId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
