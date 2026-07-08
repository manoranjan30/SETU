import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const PROJECT_HEALTH_REPORT_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'LOCKED',
  'REOPENED',
] as const;

export type ProjectHealthReportStatus =
  (typeof PROJECT_HEALTH_REPORT_STATUSES)[number];

@Entity('project_health_reports')
@Index('IDX_project_health_reports_project_month', [
  'projectId',
  'reportingMonth',
])
export class ProjectHealthReport {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  projectId: number;

  @Column({ type: 'date' })
  reportingMonth: string;

  @Column({ type: 'date', nullable: true })
  cbeSubmissionMonth: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  fiscalYear: string | null;

  @Column({ type: 'varchar', length: 24, default: 'DRAFT' })
  status: ProjectHealthReportStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  projectNameSnapshot: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  zoneSnapshot: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  regionSnapshot: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  plannerSnapshot: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  picSnapshot: string | null;

  @Column({ type: 'float', default: 100 })
  overallHealthScore: number;

  @Column({ type: 'float', default: 100 })
  leadHealthScore: number;

  @Column({ type: 'float', default: 100 })
  lagHealthScore: number;

  @Column({ type: 'jsonb', nullable: true })
  calculationBreakdown: Record<string, any> | null;

  @Column({ type: 'int', nullable: true })
  preparedBy: number | null;

  @Column({ type: 'int', nullable: true })
  submittedBy: number | null;

  @Column({ type: 'int', nullable: true })
  lockedBy: number | null;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lockedAt: Date | null;

  @OneToMany(() => ProjectHealthBurnRow, (row) => row.report)
  burnRows: ProjectHealthBurnRow[];

  @OneToMany(() => ProjectHealthResourceRow, (row) => row.report)
  resourceRows: ProjectHealthResourceRow[];

  @OneToMany(() => ProjectHealthCycleMetric, (row) => row.report)
  cycleMetrics: ProjectHealthCycleMetric[];

  @OneToMany(() => ProjectHealthRisk, (row) => row.report)
  risks: ProjectHealthRisk[];

  @OneToMany(() => ProjectHealthCatchupPlan, (row) => row.report)
  catchupPlans: ProjectHealthCatchupPlan[];

  @OneToMany(() => ProjectHealthMilestone, (row) => row.report)
  milestones: ProjectHealthMilestone[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

abstract class ReportChildRow {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  reportId: number;

  @Column({ type: 'varchar', length: 24, default: 'MANUAL' })
  sourceType: 'SYSTEM' | 'MANUAL' | 'IMPORTED';

  @Column({ type: 'text', nullable: true })
  overrideReason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  auditSnapshot: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('project_health_burn_rows')
@Index('IDX_project_health_burn_report_month', ['reportId', 'month'])
export class ProjectHealthBurnRow extends ReportChildRow {
  @Column({ type: 'date' })
  month: string;

  @Column({ type: 'varchar', length: 24 })
  metricType: 'AOP' | 'CBE' | 'ACTUAL';

  @Column({ type: 'float', default: 0 })
  valueCrores: number;

  @ManyToOne(() => ProjectHealthReport, (report) => report.burnRows, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reportId' })
  report: ProjectHealthReport;
}

@Entity('project_health_resource_rows')
@Index('IDX_project_health_resource_report_month', ['reportId', 'month'])
export class ProjectHealthResourceRow extends ReportChildRow {
  @Column({ type: 'varchar', length: 24 })
  resourceType: 'LABOUR' | 'STAFF';

  @Column({ type: 'date' })
  month: string;

  @Column({ type: 'float', default: 0 })
  aop: number;

  @Column({ type: 'float', default: 0 })
  planned: number;

  @Column({ type: 'float', default: 0 })
  actual: number;

  @ManyToOne(() => ProjectHealthReport, (report) => report.resourceRows, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reportId' })
  report: ProjectHealthReport;
}

@Entity('project_health_cycle_metrics')
@Index('IDX_project_health_cycle_report_month', ['reportId', 'month'])
export class ProjectHealthCycleMetric extends ReportChildRow {
  @Column({ type: 'date' })
  month: string;

  @Column({ type: 'float', nullable: true })
  rccSlabCycle: number | null;

  @Column({ type: 'float', nullable: true })
  postPourGap: number | null;

  @Column({ type: 'float', nullable: true })
  internalPlasterGap: number | null;

  @Column({ type: 'float', nullable: true })
  tileFlooringGap: number | null;

  @Column({ type: 'float', nullable: true })
  windowGap: number | null;

  @Column({ type: 'float', nullable: true })
  projected: number | null;

  @Column({ type: 'float', nullable: true })
  actual: number | null;

  @Column({ type: 'float', nullable: true })
  aop: number | null;

  @ManyToOne(() => ProjectHealthReport, (report) => report.cycleMetrics, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reportId' })
  report: ProjectHealthReport;
}

@Entity('project_health_risks')
@Index('IDX_project_health_risks_report_status', ['reportId', 'status'])
export class ProjectHealthRisk extends ReportChildRow {
  @Column({ type: 'varchar', length: 120, nullable: true })
  tower: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  package: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  taskGroup: string | null;

  @Column({ type: 'text' })
  taskDescription: string;

  @Column({ type: 'date', nullable: true })
  raisedDate: string | null;

  @Column({ type: 'date', nullable: true })
  plannedDate: string | null;

  @Column({ type: 'date', nullable: true })
  cbeDate: string | null;

  @Column({ type: 'int', default: 0 })
  delayDays: number;

  @Column({ type: 'varchar', length: 120, nullable: true })
  accountabilityFunction: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  accountabilityPerson: string | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({ type: 'varchar', length: 32, default: 'OPEN' })
  status: string;

  @Column({ type: 'varchar', length: 24, default: 'LOW' })
  riskProbability: 'LOW' | 'MEDIUM' | 'HIGH';

  @Column({ type: 'varchar', length: 24, default: 'LOW' })
  severity: 'NO_IMPACT' | 'LOW' | 'MEDIUM' | 'HIGH';

  @Column({ type: 'int', default: 1 })
  riskScore: number;

  @Column({ type: 'int', nullable: true })
  linkedDesignItemId: number | null;

  @Column({ type: 'int', nullable: true })
  linkedWoId: number | null;

  @Column({ type: 'int', nullable: true })
  linkedScheduleActivityId: number | null;

  @ManyToOne(() => ProjectHealthReport, (report) => report.risks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reportId' })
  report: ProjectHealthReport;
}

@Entity('project_health_catchup_plans')
@Index('IDX_project_health_catchup_report_status', ['reportId', 'status'])
export class ProjectHealthCatchupPlan extends ReportChildRow {
  @Column({ type: 'varchar', length: 160, nullable: true })
  package: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  contractor: string | null;

  @Column({ type: 'float', default: 0 })
  plannedCatchupCocCrores: number;

  @Column({ type: 'text', nullable: true })
  strategy: string | null;

  @Column({ type: 'text', nullable: true })
  details: string | null;

  @Column({ type: 'int', nullable: true })
  ownerUserId: number | null;

  @Column({ type: 'date', nullable: true })
  targetDate: string | null;

  @Column({ type: 'varchar', length: 32, default: 'OPEN' })
  status: string;

  @ManyToOne(() => ProjectHealthReport, (report) => report.catchupPlans, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reportId' })
  report: ProjectHealthReport;
}

@Entity('project_health_milestones')
@Index('IDX_project_health_milestones_report_tower', ['reportId', 'towerName'])
export class ProjectHealthMilestone extends ReportChildRow {
  @Column({ type: 'varchar', length: 160, nullable: true })
  towerName: string | null;

  @Column({ type: 'varchar', length: 220 })
  milestoneName: string;

  @Column({ type: 'date', nullable: true })
  aopDate: string | null;

  @Column({ type: 'date', nullable: true })
  cbeDate: string | null;

  @Column({ type: 'date', nullable: true })
  actualDate: string | null;

  @Column({ type: 'int', default: 0 })
  delayDays: number;

  @Column({ type: 'varchar', length: 80, nullable: true })
  milestoneGroup: string | null;

  @Column({ type: 'int', nullable: true })
  sourceActivityId: number | null;

  @ManyToOne(() => ProjectHealthReport, (report) => report.milestones, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reportId' })
  report: ProjectHealthReport;
}

@Entity('project_health_escalation_rules')
@Index('IDX_project_health_escalation_project_scope', [
  'projectId',
  'scopeType',
])
export class ProjectHealthEscalationRule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  projectId: number | null;

  @Column({ type: 'varchar', length: 24 })
  scopeType: 'OVERALL' | 'FUNCTIONAL';

  @Column({ type: 'varchar', length: 120, nullable: true })
  functionName: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  greenRole: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  amberRole: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  redRole: string | null;

  @Column({ type: 'float', default: 80 })
  greenThreshold: number;

  @Column({ type: 'float', default: 60 })
  amberThreshold: number;

  @Column({ type: 'float', default: 0 })
  redThreshold: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('project_health_score_config')
@Index('IDX_project_health_score_config_project_group', [
  'projectId',
  'indicatorGroup',
])
export class ProjectHealthScoreConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  projectId: number | null;

  @Column({ type: 'varchar', length: 40 })
  indicatorGroup: 'LEAD' | 'LAG';

  @Column({ type: 'varchar', length: 160 })
  indicatorName: string;

  @Column({ type: 'float', default: 1 })
  weightage: number;

  @Column({ type: 'text', nullable: true })
  sourceRule: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
