import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EpsNode, EpsNodeType } from '../eps/eps.entity';
import { Activity, ActivityStatus } from '../wbs/entities/activity.entity';
import { MeasurementProgress } from '../boq/entities/measurement-progress.entity';
import { DailyLaborPresence } from '../labor/entities/daily-labor-presence.entity';
import { CustomerMilestoneAchievement } from '../milestone/entities/customer-milestone-achievement.entity';
import {
  IssuePriority,
  IssueTrackerIssue,
  IssueTrackerStatus,
} from '../planning/entities/issue-tracker-issue.entity';
import {
  QualityInspection,
  InspectionStatus,
} from '../quality/entities/quality-inspection.entity';
import { QualityAudit } from '../quality/entities/quality-audit.entity';
import { SnagList, SnagListStatus } from '../snag/entities/snag-list.entity';
import { EhsTraining } from '../ehs/entities/ehs-training.entity';
import { EhsInspection } from '../ehs/entities/ehs-inspection.entity';
import { EhsLegalRegister } from '../ehs/entities/ehs-legal-register.entity';
import { EhsMachinery } from '../ehs/entities/ehs-machinery.entity';
import { EhsVehicle } from '../ehs/entities/ehs-vehicle.entity';
import {
  EhsObservation,
  EhsObservationSeverity,
  EhsObservationStatus,
} from '../ehs/entities/ehs-observation.entity';
import { EhsCompetency } from '../ehs/entities/ehs-competency.entity';
import { ProjectRating } from '../quality/entities/quality-project-rating.entity';
import {
  SiteObservation,
  SiteObservationSeverity,
  SiteObservationStatus,
} from '../quality/entities/site-observation.entity';
import { EhsIncident, IncidentType } from '../ehs/entities/ehs-incident.entity';
import { EhsManhours } from '../ehs/entities/ehs-manhours.entity';
import {
  DrawingRegister,
  DrawingStatus,
} from '../design/entities/drawing-register.entity';
import { WorkOrder } from '../workdoc/entities/work-order.entity';

type ExecutiveMode = 'enterprise' | 'company' | 'project';
type MetricFormat = 'number' | 'currency' | 'percent' | 'text';
type MetricTone = 'default' | 'positive' | 'warning' | 'danger';
type ListItemSeverity = 'info' | 'warning' | 'danger' | 'positive';

interface DateWindow {
  dateFrom: string;
  dateTo: string;
  start: Date;
  end: Date;
  endExclusive: Date;
  monthStart: string;
  monthEnd: string;
  dueSoon: string;
}

interface ScopeCompany {
  id: number;
  name: string;
}

interface ScopeProject {
  id: number;
  name: string;
  companyId: number | null;
  companyName: string | null;
  status: string | null;
  estimatedCost: number;
  approvedBudget: number;
}

interface ScopeHierarchy {
  companies: ScopeCompany[];
  projects: ScopeProject[];
  companyProjectIds: Map<number, number[]>;
  projectIds: number[];
  projectMap: Map<number, ScopeProject>;
}

interface DashboardMetric {
  key: string;
  label: string;
  value: number | string;
  format?: MetricFormat;
  tone?: MetricTone;
  helper?: string;
  route?: string;
  visualPercent?: number;
  visualLabel?: string;
}

interface DashboardTrendPoint {
  label: string;
  value: number;
}

interface DashboardTrend {
  key: string;
  label: string;
  format?: MetricFormat;
  points: DashboardTrendPoint[];
}

interface DashboardListItem {
  key: string;
  title: string;
  description: string;
  severity: ListItemSeverity;
  value?: number | string;
  projectId?: number;
  projectName?: string;
  route?: string;
}

interface DashboardSection {
  kpis: DashboardMetric[];
  trend: DashboardTrend;
  alerts: DashboardListItem[];
  actions: DashboardListItem[];
}

interface RankingMetric {
  label: string;
  value: number | string;
  format?: MetricFormat;
  tone?: MetricTone;
}

interface RankingRow {
  key: string;
  label: string;
  secondaryLabel?: string;
  route?: string;
  metrics: RankingMetric[];
}

interface RankingGroup {
  key: string;
  label: string;
  rows: RankingRow[];
}

interface ExecutiveSummaryResponse {
  scope: {
    mode: ExecutiveMode;
    dateFrom: string;
    dateTo: string;
    companyId: number | null;
    companyName: string | null;
    projectId: number | null;
    projectName: string | null;
    visibleCompanyCount: number;
    visibleProjectCount: number;
  };
  headline: DashboardMetric[];
  progressExecution: DashboardSection;
  quality: DashboardSection;
  ehs: DashboardSection;
  rankings: RankingGroup[];
}

interface ExecutiveProjectRow extends ScopeProject {
  totalActivities: number;
  completedActivities: number;
  delayedActivities: number;
  progressPercent: number;
  burnValue: number;
  manpower: number;
  activeWorkOrders: number;
  activeWorkOrderValue: number;
  milestoneDue: number;
  milestoneCollected: number;
  pendingMilestoneAmount: number;
  pendingMilestoneCount: number;
  openIssues: number;
  overdueIssues: number;
  criticalIssues: number;
  drawingBlockers: number;
  totalRfis: number;
  approvedRfis: number;
  pendingRfis: number;
  openQualityObservations: number;
  criticalQualityObservations: number;
  auditCount: number;
  auditFindings: number;
  handoverReadyUnits: number;
  activeSnagUnits: number;
  qualityScore: number;
  safeManhours: number;
  totalIncidents: number;
  ltiCount: number;
  nearMissCount: number;
  medicalCases: number;
  overdueEhsInspections: number;
  pendingEhsInspections: number;
  completedTrainings: number;
  totalTrainings: number;
  trainingAttendees: number;
  complianceAlerts: number;
  competencyAlerts: number;
  openEhsObservations: number;
  criticalEhsObservations: number;
  scheduleHealth: number;
  inspectionApprovalRate: number;
  trainingCompliance: number;
  qualityRiskScore: number;
  ehsRiskScore: number;
  executionRiskScore: number;
}

interface ExecutiveCompanyRow {
  companyId: number;
  companyName: string;
  projectCount: number;
  activeProjects: number;
  portfolioValue: number;
  workOrderValue: number;
  burnValue: number;
  collectionsDue: number;
  collectionsCollected: number;
  delayedActivities: number;
  progressPercent: number;
  qualityRiskScore: number;
  ehsRiskScore: number;
  openQualityObservations: number;
  openEhsObservations: number;
}

interface ExecutiveAggregateTotals {
  totalProjects: number;
  activeProjects: number;
  delayedProjects: number;
  delayedActivities: number;
  portfolioValue: number;
  workOrderValue: number;
  burnValue: number;
  manpower: number;
  activeWorkOrders: number;
  milestoneDue: number;
  milestoneCollected: number;
  pendingMilestoneAmount: number;
  openIssues: number;
  overdueIssues: number;
  criticalIssues: number;
  drawingBlockers: number;
  totalRfis: number;
  approvedRfis: number;
  pendingRfis: number;
  openQualityObservations: number;
  criticalQualityObservations: number;
  auditFindings: number;
  handoverReadyUnits: number;
  activeSnagUnits: number;
  qualityScore: number;
  safeManhours: number;
  totalIncidents: number;
  ltiCount: number;
  nearMissCount: number;
  medicalCases: number;
  overdueEhsInspections: number;
  trainingCompliance: number;
  complianceAlerts: number;
  competencyAlerts: number;
  openEhsObservations: number;
  criticalEhsObservations: number;
  scheduleHealth: number;
  inspectionApprovalRate: number;
}

const EMPTY_TREND: DashboardTrend = {
  key: 'empty',
  label: 'No trend available',
  format: 'number',
  points: [],
};

@Injectable()
export class DashboardExecutiveService {
  constructor(
    @InjectRepository(EpsNode)
    private readonly epsRepo: Repository<EpsNode>,
    @InjectRepository(Activity)
    private readonly activityRepo: Repository<Activity>,
    @InjectRepository(MeasurementProgress)
    private readonly progressRepo: Repository<MeasurementProgress>,
    @InjectRepository(DailyLaborPresence)
    private readonly laborRepo: Repository<DailyLaborPresence>,
    @InjectRepository(CustomerMilestoneAchievement)
    private readonly milestoneAchievementRepo: Repository<CustomerMilestoneAchievement>,
    @InjectRepository(IssueTrackerIssue)
    private readonly issueTrackerRepo: Repository<IssueTrackerIssue>,
    @InjectRepository(QualityInspection)
    private readonly qualityInspectionRepo: Repository<QualityInspection>,
    @InjectRepository(QualityAudit)
    private readonly qualityAuditRepo: Repository<QualityAudit>,
    @InjectRepository(SnagList)
    private readonly snagListRepo: Repository<SnagList>,
    @InjectRepository(EhsTraining)
    private readonly ehsTrainingRepo: Repository<EhsTraining>,
    @InjectRepository(EhsInspection)
    private readonly ehsInspectionRepo: Repository<EhsInspection>,
    @InjectRepository(EhsLegalRegister)
    private readonly ehsLegalRepo: Repository<EhsLegalRegister>,
    @InjectRepository(EhsMachinery)
    private readonly ehsMachineryRepo: Repository<EhsMachinery>,
    @InjectRepository(EhsVehicle)
    private readonly ehsVehicleRepo: Repository<EhsVehicle>,
    @InjectRepository(EhsObservation)
    private readonly ehsObservationRepo: Repository<EhsObservation>,
    @InjectRepository(EhsCompetency)
    private readonly ehsCompetencyRepo: Repository<EhsCompetency>,
    @InjectRepository(ProjectRating)
    private readonly projectRatingRepo: Repository<ProjectRating>,
    @InjectRepository(SiteObservation)
    private readonly qualityObservationRepo: Repository<SiteObservation>,
    @InjectRepository(EhsIncident)
    private readonly incidentRepo: Repository<EhsIncident>,
    @InjectRepository(EhsManhours)
    private readonly manhoursRepo: Repository<EhsManhours>,
    @InjectRepository(DrawingRegister)
    private readonly drawingRepo: Repository<DrawingRegister>,
    @InjectRepository(WorkOrder)
    private readonly workOrderRepo: Repository<WorkOrder>,
  ) {}

  async listCompanies(user: any) {
    const scope = await this.getScopeHierarchy(user);
    return scope.companies.map((company) => ({
      id: company.id,
      name: company.name,
      projectCount: scope.companyProjectIds.get(company.id)?.length || 0,
    }));
  }

  async listProjects(user: any, companyId?: number | null) {
    const scope = await this.getScopeHierarchy(user);
    const projects =
      companyId && scope.companyProjectIds.has(companyId)
        ? scope.projects.filter((project) => project.companyId === companyId)
        : companyId
          ? []
          : scope.projects;

    return projects.map((project) => ({
      id: project.id,
      name: project.name,
      companyId: project.companyId,
      companyName: project.companyName,
      status: project.status,
      estimatedCost: project.estimatedCost,
      approvedBudget: project.approvedBudget,
    }));
  }

  async getEnterpriseSummary(user: any, dateFrom?: string, dateTo?: string) {
    const scope = await this.getScopeHierarchy(user);
    return this.buildSummary(
      scope,
      'enterprise',
      scope.projectIds,
      this.getDateWindow(dateFrom, dateTo),
      null,
      null,
    );
  }

  async getCompanySummary(
    user: any,
    companyId: number,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const scope = await this.getScopeHierarchy(user);
    const company = scope.companies.find((item) => item.id === companyId);
    const projectIds = scope.companyProjectIds.get(companyId) || [];
    if (!company || projectIds.length === 0) {
      throw new ForbiddenException('You do not have access to this company');
    }

    return this.buildSummary(
      scope,
      'company',
      projectIds,
      this.getDateWindow(dateFrom, dateTo),
      company,
      null,
    );
  }

  async getProjectSummary(
    user: any,
    projectId: number,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const scope = await this.getScopeHierarchy(user);
    const project = scope.projectMap.get(projectId);
    if (!project) {
      throw new ForbiddenException('You do not have access to this project');
    }

    const company =
      project.companyId && project.companyName
        ? { id: project.companyId, name: project.companyName }
        : null;

    return this.buildSummary(
      scope,
      'project',
      [projectId],
      this.getDateWindow(dateFrom, dateTo),
      company,
      project,
    );
  }

  private async getScopeHierarchy(user: any): Promise<ScopeHierarchy> {
    const allNodes = await this.epsRepo.find();
    const nodeMap = new Map(allNodes.map((node) => [node.id, node]));
    const isAdmin = this.isAdminUser(user);
    const candidateProjectIds = isAdmin
      ? allNodes
          .filter((node) => node.type === EpsNodeType.PROJECT)
          .map((node) => node.id)
      : (user?.project_ids || []).map((value: number | string) => Number(value));

    const projectIds: number[] = Array.from(
      new Set<number>(
        candidateProjectIds.filter(
          (projectId) =>
            Number.isFinite(projectId) &&
            nodeMap.get(projectId)?.type === EpsNodeType.PROJECT,
        ),
      ),
    );

    if (projectIds.length === 0) {
      return {
        companies: [],
        projects: [],
        companyProjectIds: new Map<number, number[]>(),
        projectIds: [],
        projectMap: new Map<number, ScopeProject>(),
      };
    }

    const projectNodes = await this.epsRepo.find({
      where: { id: In(projectIds) },
      relations: ['projectProfile'],
    });
    const projectNodeMap = new Map(projectNodes.map((node) => [node.id, node]));
    const companies = new Map<number, ScopeCompany>();
    const companyProjectIds = new Map<number, number[]>();
    const projects: ScopeProject[] = [];
    const projectMap = new Map<number, ScopeProject>();

    projectIds.forEach((projectId) => {
      const projectNode = projectNodeMap.get(projectId);
      if (!projectNode) return;

      let current = projectNode.parentId ? nodeMap.get(projectNode.parentId) : null;
      let company: ScopeCompany | null = null;

      while (current) {
        if (current.type === EpsNodeType.COMPANY) {
          company = { id: current.id, name: current.name };
          companies.set(current.id, company);
          break;
        }
        current = current.parentId ? nodeMap.get(current.parentId) : null;
      }

      const scopeProject: ScopeProject = {
        id: projectNode.id,
        name: projectNode.name,
        companyId: company?.id ?? null,
        companyName: company?.name ?? null,
        status: projectNode.projectProfile?.projectStatus || null,
        estimatedCost: this.toNumber(projectNode.projectProfile?.estimatedProjectCost),
        approvedBudget: this.toNumber(projectNode.projectProfile?.approvedBudget),
      };

      projects.push(scopeProject);
      projectMap.set(scopeProject.id, scopeProject);

      if (scopeProject.companyId) {
        const list = companyProjectIds.get(scopeProject.companyId) || [];
        list.push(scopeProject.id);
        companyProjectIds.set(scopeProject.companyId, list);
      }
    });

    projects.sort((left, right) =>
      left.name.localeCompare(right.name, undefined, {
        numeric: true,
        sensitivity: 'base',
      }),
    );

    const sortedCompanies = Array.from(companies.values()).sort((left, right) =>
      left.name.localeCompare(right.name, undefined, {
        numeric: true,
        sensitivity: 'base',
      }),
    );

    return {
      companies: sortedCompanies,
      projects,
      companyProjectIds,
      projectIds: projects.map((item) => item.id),
      projectMap,
    };
  }

  private getDateWindow(dateFrom?: string, dateTo?: string): DateWindow {
    const now = this.startOfDay(new Date());
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const start = this.parseDateOrFallback(dateFrom, defaultStart);
    const end = this.parseDateOrFallback(dateTo, now);
    if (end < start) {
      throw new BadRequestException('dateTo cannot be earlier than dateFrom');
    }

    const endExclusive = new Date(end);
    endExclusive.setDate(endExclusive.getDate() + 1);
    const dueSoon = new Date(end);
    dueSoon.setDate(dueSoon.getDate() + 30);

    return {
      dateFrom: this.toDateString(start),
      dateTo: this.toDateString(end),
      start,
      end,
      endExclusive,
      monthStart: `${this.toDateString(start).slice(0, 7)}-01`,
      monthEnd: `${this.toDateString(end).slice(0, 7)}-01`,
      dueSoon: this.toDateString(dueSoon),
    };
  }

  private parseDateOrFallback(value: string | undefined, fallback: Date) {
    if (!value) return this.startOfDay(fallback);
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid date value: ${value}`);
    }
    return this.startOfDay(parsed);
  }

  private startOfDay(date: Date) {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  private toDateString(date: Date) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
  }

  private toNumber(value: unknown) {
    if (typeof value === 'number') return value;
    const numeric = Number(value || 0);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private isAdminUser(user: any) {
    const roles = (user?.roles || []).map((role: any) =>
      typeof role === 'string' ? role.toLowerCase() : role?.name?.toLowerCase(),
    );
    return roles.includes('admin') || String(user?.role || '').toLowerCase() === 'admin';
  }

  private async buildSummary(
    scope: ScopeHierarchy,
    mode: ExecutiveMode,
    selectedProjectIds: number[],
    window: DateWindow,
    company: ScopeCompany | null,
    project: ScopeProject | null,
  ): Promise<ExecutiveSummaryResponse> {
    const rows = await this.buildProjectRows(selectedProjectIds, window, scope.projectMap);
    const totals = this.aggregateRows(rows);
    const companyRows = this.buildCompanyRows(rows, scope.companies, scope.companyProjectIds);
    const [progressTrend, qualityTrend, ehsTrend] = await Promise.all([
      this.getBurnTrend(selectedProjectIds, window),
      this.getQualityTrend(selectedProjectIds, window),
      this.getEhsTrend(selectedProjectIds, window),
    ]);

    return {
      scope: {
        mode,
        dateFrom: window.dateFrom,
        dateTo: window.dateTo,
        companyId: company?.id ?? null,
        companyName: company?.name ?? null,
        projectId: project?.id ?? null,
        projectName: project?.name ?? null,
        visibleCompanyCount: scope.companies.length,
        visibleProjectCount: scope.projectIds.length,
      },
      headline: this.buildHeadlineMetrics(
        mode,
        totals,
        companyRows,
        rows,
        scope.companies.length,
      ),
      progressExecution: this.buildProgressSection(totals, rows, progressTrend, mode),
      quality: this.buildQualitySection(totals, rows, qualityTrend, mode),
      ehs: this.buildEhsSection(totals, rows, ehsTrend, mode),
      rankings: this.buildRankingGroups(mode, companyRows, rows),
    };
  }

  private async buildProjectRows(
    selectedProjectIds: number[],
    window: DateWindow,
    projectMap: Map<number, ScopeProject>,
  ): Promise<ExecutiveProjectRow[]> {
    const projectIds = selectedProjectIds.filter((id) => Number.isFinite(id));
    const rows = projectIds
      .map((projectId) => projectMap.get(projectId))
      .filter((project): project is ScopeProject => Boolean(project))
      .map((project) => this.createProjectRow(project));

    if (rows.length === 0) {
      return [];
    }

    const rowMap = new Map(rows.map((row) => [row.id, row]));
    const latestLaborDatePromise = this.laborRepo
      .createQueryBuilder('l')
      .select('MAX(l.date)', 'latestDate')
      .where('l.projectId IN (:...projectIds)', { projectIds })
      .andWhere('l.date <= :dateTo', { dateTo: window.dateTo })
      .getRawOne();

    const [
      activityRows,
      burnRows,
      workOrderRows,
      milestoneRows,
      issueRows,
      drawingRows,
      qualityInspectionRows,
      qualityObservationRows,
      auditRows,
      snagRows,
      ratingRows,
      manhourRows,
      incidentRows,
      ehsInspectionRows,
      trainingRows,
      legalRows,
      machineryRows,
      vehicleRows,
      competencyRows,
      ehsObservationRows,
      latestLaborDate,
    ] = await Promise.all([
      this.activityRepo
        .createQueryBuilder('a')
        .select('a.projectId', 'projectId')
        .addSelect('COUNT(*)', 'totalActivities')
        .addSelect(
          `SUM(CASE WHEN a.finishDateActual IS NOT NULL OR a.percentComplete >= 100 OR a.status = :completed THEN 1 ELSE 0 END)`,
          'completedActivities',
        )
        .addSelect(
          `SUM(CASE WHEN a.finishDatePlanned < :today AND a.finishDateActual IS NULL AND a.percentComplete < 100 THEN 1 ELSE 0 END)`,
          'delayedActivities',
        )
        .addSelect('AVG(a.percentComplete)', 'progressPercent')
        .where('a.projectId IN (:...projectIds)', { projectIds })
        .setParameters({
          completed: ActivityStatus.COMPLETED,
          today: window.dateTo,
        })
        .groupBy('a.projectId')
        .getRawMany(),
      this.progressRepo
        .createQueryBuilder('p')
        .leftJoin('p.measurementElement', 'me')
        .leftJoin('me.boqSubItem', 'sub')
        .select('me.projectId', 'projectId')
        .addSelect('COALESCE(SUM(p.executedQty * COALESCE(sub.rate, 0)), 0)', 'burnValue')
        .where('me.projectId IN (:...projectIds)', { projectIds })
        .andWhere('p.date BETWEEN :dateFrom AND :dateTo', {
          dateFrom: window.dateFrom,
          dateTo: window.dateTo,
        })
        .groupBy('me.projectId')
        .getRawMany(),
      this.workOrderRepo
        .createQueryBuilder('wo')
        .select('wo.projectId', 'projectId')
        .addSelect(
          `SUM(CASE WHEN wo.status <> 'CANCELLED' THEN 1 ELSE 0 END)`,
          'activeWorkOrders',
        )
        .addSelect(
          `COALESCE(SUM(CASE WHEN wo.status <> 'CANCELLED' THEN wo.totalAmount ELSE 0 END), 0)`,
          'activeWorkOrderValue',
        )
        .where('wo.projectId IN (:...projectIds)', { projectIds })
        .groupBy('wo.projectId')
        .getRawMany(),
      this.milestoneAchievementRepo
        .createQueryBuilder('m')
        .select('m.projectId', 'projectId')
        .addSelect('COALESCE(SUM(m.collectionAmount), 0)', 'milestoneDue')
        .addSelect('COALESCE(SUM(m.amountReceived), 0)', 'milestoneCollected')
        .addSelect(
          `SUM(CASE WHEN m.status IN (:...pendingStatuses) THEN 1 ELSE 0 END)`,
          'pendingMilestoneCount',
        )
        .where('m.projectId IN (:...projectIds)', { projectIds })
        .setParameter('pendingStatuses', [
          'triggered',
          'invoice_raised',
          'partially_collected',
        ])
        .groupBy('m.projectId')
        .getRawMany(),
      this.issueTrackerRepo
        .createQueryBuilder('i')
        .select('i.projectId', 'projectId')
        .addSelect(
          `SUM(CASE WHEN i.status IN (:...openStatuses) THEN 1 ELSE 0 END)`,
          'openIssues',
        )
        .addSelect(
          `SUM(CASE WHEN i.status IN (:...openStatuses) AND i.requiredDate IS NOT NULL AND i.requiredDate < :today THEN 1 ELSE 0 END)`,
          'overdueIssues',
        )
        .addSelect(
          `SUM(CASE WHEN i.status IN (:...openStatuses) AND i.priority = :criticalPriority THEN 1 ELSE 0 END)`,
          'criticalIssues',
        )
        .where('i.projectId IN (:...projectIds)', { projectIds })
        .setParameters({
          openStatuses: [IssueTrackerStatus.OPEN, IssueTrackerStatus.IN_PROGRESS],
          today: window.dateTo,
          criticalPriority: IssuePriority.CRITICAL,
        })
        .groupBy('i.projectId')
        .getRawMany(),
      this.drawingRepo
        .createQueryBuilder('d')
        .select('d.projectId', 'projectId')
        .addSelect(
          `SUM(CASE WHEN d.status IN (:...blockingStatuses) THEN 1 ELSE 0 END)`,
          'drawingBlockers',
        )
        .where('d.projectId IN (:...projectIds)', { projectIds })
        .setParameter('blockingStatuses', [
          DrawingStatus.PLANNED,
          DrawingStatus.IN_PROGRESS,
          DrawingStatus.HOLD,
        ])
        .groupBy('d.projectId')
        .getRawMany(),
      this.qualityInspectionRepo
        .createQueryBuilder('q')
        .select('q.projectId', 'projectId')
        .addSelect('COUNT(*)', 'totalRfis')
        .addSelect(
          `SUM(CASE WHEN q.status = :approvedStatus THEN 1 ELSE 0 END)`,
          'approvedRfis',
        )
        .addSelect(
          `SUM(CASE WHEN q.status IN (:...pendingStatuses) THEN 1 ELSE 0 END)`,
          'pendingRfis',
        )
        .where('q.projectId IN (:...projectIds)', { projectIds })
        .setParameters({
          approvedStatus: InspectionStatus.APPROVED,
          pendingStatuses: [
            InspectionStatus.PENDING,
            InspectionStatus.PARTIALLY_APPROVED,
            InspectionStatus.PROVISIONALLY_APPROVED,
          ],
        })
        .groupBy('q.projectId')
        .getRawMany(),
      this.qualityObservationRepo
        .createQueryBuilder('o')
        .select('o.projectId', 'projectId')
        .addSelect(
          `SUM(CASE WHEN o.status = :openStatus THEN 1 ELSE 0 END)`,
          'openQualityObservations',
        )
        .addSelect(
          `SUM(CASE WHEN o.status = :openStatus AND o.severity = :criticalSeverity THEN 1 ELSE 0 END)`,
          'criticalQualityObservations',
        )
        .where('o.projectId IN (:...projectIds)', { projectIds })
        .setParameters({
          openStatus: SiteObservationStatus.OPEN,
          criticalSeverity: SiteObservationSeverity.CRITICAL,
        })
        .groupBy('o.projectId')
        .getRawMany(),
      this.qualityAuditRepo
        .createQueryBuilder('a')
        .select('a.projectId', 'projectId')
        .addSelect('COUNT(*)', 'auditCount')
        .addSelect(
          'COALESCE(SUM(a.nonConformancesCount + a.observationsCount), 0)',
          'auditFindings',
        )
        .where('a.projectId IN (:...projectIds)', { projectIds })
        .andWhere('a.auditDate BETWEEN :dateFrom AND :dateTo', {
          dateFrom: window.dateFrom,
          dateTo: window.dateTo,
        })
        .groupBy('a.projectId')
        .getRawMany(),
      this.snagListRepo
        .createQueryBuilder('s')
        .select('s.projectId', 'projectId')
        .addSelect(
          `SUM(CASE WHEN s.overallStatus = :handoverReady THEN 1 ELSE 0 END)`,
          'handoverReadyUnits',
        )
        .addSelect(
          `SUM(CASE WHEN s.overallStatus IN (:...activeStatuses) THEN 1 ELSE 0 END)`,
          'activeSnagUnits',
        )
        .where('s.projectId IN (:...projectIds)', { projectIds })
        .setParameters({
          handoverReady: SnagListStatus.HANDOVER_READY,
          activeStatuses: [SnagListStatus.SNAGGING, SnagListStatus.DESNAGGING],
        })
        .groupBy('s.projectId')
        .getRawMany(),
      this.projectRatingRepo
        .createQueryBuilder('r')
        .select('r.projectNodeId', 'projectId')
        .addSelect('r.period', 'period')
        .addSelect('r.overallScore', 'overallScore')
        .where('r.projectNodeId IN (:...projectIds)', { projectIds })
        .orderBy('r.projectNodeId', 'ASC')
        .addOrderBy('r.period', 'DESC')
        .getRawMany(),
      this.manhoursRepo
        .createQueryBuilder('m')
        .select('m.projectId', 'projectId')
        .addSelect('COALESCE(SUM(m.safeManhours), 0)', 'safeManhours')
        .where('m.projectId IN (:...projectIds)', { projectIds })
        .andWhere('m.month BETWEEN :monthStart AND :monthEnd', {
          monthStart: window.monthStart,
          monthEnd: window.monthEnd,
        })
        .groupBy('m.projectId')
        .getRawMany(),
      this.incidentRepo
        .createQueryBuilder('i')
        .select('i.projectId', 'projectId')
        .addSelect('COUNT(*)', 'totalIncidents')
        .addSelect(
          `SUM(CASE WHEN i.incidentType = :ltiType THEN 1 ELSE 0 END)`,
          'ltiCount',
        )
        .addSelect(
          `SUM(CASE WHEN i.incidentType = :nearMissType THEN 1 ELSE 0 END)`,
          'nearMissCount',
        )
        .addSelect(
          `SUM(CASE WHEN i.incidentType = :mtcType THEN 1 ELSE 0 END)`,
          'medicalCases',
        )
        .where('i.projectId IN (:...projectIds)', { projectIds })
        .andWhere('i.incidentDate BETWEEN :dateFrom AND :dateTo', {
          dateFrom: window.dateFrom,
          dateTo: window.dateTo,
        })
        .setParameters({
          ltiType: IncidentType.LTI,
          nearMissType: IncidentType.NEAR_MISS,
          mtcType: IncidentType.MTC,
        })
        .groupBy('i.projectId')
        .getRawMany(),
      this.ehsInspectionRepo
        .createQueryBuilder('e')
        .select('e.projectId', 'projectId')
        .addSelect(
          `SUM(CASE WHEN (LOWER(e.status) = 'pending' OR LOWER(e.status) = 'overdue') AND e.dueDate IS NOT NULL AND e.dueDate <= :today THEN 1 ELSE 0 END)`,
          'overdueEhsInspections',
        )
        .addSelect(
          `SUM(CASE WHEN LOWER(e.status) <> 'completed' THEN 1 ELSE 0 END)`,
          'pendingEhsInspections',
        )
        .where('e.projectId IN (:...projectIds)', { projectIds })
        .setParameter('today', window.dateTo)
        .groupBy('e.projectId')
        .getRawMany(),
      this.ehsTrainingRepo
        .createQueryBuilder('t')
        .select('t.projectId', 'projectId')
        .addSelect('COUNT(*)', 'totalTrainings')
        .addSelect(
          `SUM(CASE WHEN LOWER(t.status) = 'completed' THEN 1 ELSE 0 END)`,
          'completedTrainings',
        )
        .addSelect('COALESCE(SUM(t.attendeeCount), 0)', 'trainingAttendees')
        .where('t.projectId IN (:...projectIds)', { projectIds })
        .andWhere('t.date BETWEEN :dateFrom AND :dateTo', {
          dateFrom: window.dateFrom,
          dateTo: window.dateTo,
        })
        .groupBy('t.projectId')
        .getRawMany(),
      this.ehsLegalRepo
        .createQueryBuilder('l')
        .select('l.projectId', 'projectId')
        .addSelect(
          `SUM(CASE WHEN l.expiryDate IS NOT NULL AND l.expiryDate <= :dueSoon THEN 1 ELSE 0 END)`,
          'complianceAlerts',
        )
        .where('l.projectId IN (:...projectIds)', { projectIds })
        .setParameter('dueSoon', window.dueSoon)
        .groupBy('l.projectId')
        .getRawMany(),
      this.ehsMachineryRepo
        .createQueryBuilder('m')
        .select('m.projectId', 'projectId')
        .addSelect(
          `SUM(CASE WHEN m.expiryDate IS NOT NULL AND m.expiryDate <= :dueSoon THEN 1 ELSE 0 END)`,
          'complianceAlerts',
        )
        .where('m.projectId IN (:...projectIds)', { projectIds })
        .setParameter('dueSoon', window.dueSoon)
        .groupBy('m.projectId')
        .getRawMany(),
      this.ehsVehicleRepo
        .createQueryBuilder('v')
        .select('v.projectId', 'projectId')
        .addSelect(
          `SUM(CASE WHEN 
            (v.fitnessCertDate IS NOT NULL AND v.fitnessCertDate <= :dueSoon) OR
            (v.insuranceDate IS NOT NULL AND v.insuranceDate <= :dueSoon) OR
            (v.pollutionDate IS NOT NULL AND v.pollutionDate <= :dueSoon)
          THEN 1 ELSE 0 END)`,
          'complianceAlerts',
        )
        .where('v.projectId IN (:...projectIds)', { projectIds })
        .setParameter('dueSoon', window.dueSoon)
        .groupBy('v.projectId')
        .getRawMany(),
      this.ehsCompetencyRepo
        .createQueryBuilder('c')
        .select('c.projectId', 'projectId')
        .addSelect(
          `SUM(CASE WHEN 
            (c.licenseExpiry IS NOT NULL AND c.licenseExpiry <= :dueSoon) OR
            (c.fitnessExpiry IS NOT NULL AND c.fitnessExpiry <= :dueSoon)
          THEN 1 ELSE 0 END)`,
          'competencyAlerts',
        )
        .where('c.projectId IN (:...projectIds)', { projectIds })
        .setParameter('dueSoon', window.dueSoon)
        .groupBy('c.projectId')
        .getRawMany(),
      this.ehsObservationRepo
        .createQueryBuilder('o')
        .select('o.projectId', 'projectId')
        .addSelect(
          `SUM(CASE WHEN o.status = :openStatus THEN 1 ELSE 0 END)`,
          'openEhsObservations',
        )
        .addSelect(
          `SUM(CASE WHEN o.status = :openStatus AND o.severity = :criticalSeverity THEN 1 ELSE 0 END)`,
          'criticalEhsObservations',
        )
        .where('o.projectId IN (:...projectIds)', { projectIds })
        .setParameters({
          openStatus: EhsObservationStatus.OPEN,
          criticalSeverity: EhsObservationSeverity.CRITICAL,
        })
        .groupBy('o.projectId')
        .getRawMany(),
      latestLaborDatePromise,
    ]);

    const latestDate = latestLaborDate?.latestDate;
    const laborRows = latestDate
      ? await this.laborRepo
          .createQueryBuilder('l')
          .select('l.projectId', 'projectId')
          .addSelect('COALESCE(SUM(l.count), 0)', 'manpower')
          .where('l.projectId IN (:...projectIds)', { projectIds })
          .andWhere('l.date = :latestDate', { latestDate })
          .groupBy('l.projectId')
          .getRawMany()
      : [];

    this.applyNumericMap(
      rowMap,
      activityRows,
      ['totalActivities', 'completedActivities', 'delayedActivities', 'progressPercent'],
    );
    this.applyNumericMap(rowMap, burnRows, ['burnValue']);
    this.applyNumericMap(rowMap, laborRows, ['manpower']);
    this.applyNumericMap(rowMap, workOrderRows, ['activeWorkOrders', 'activeWorkOrderValue']);
    this.applyNumericMap(
      rowMap,
      milestoneRows,
      ['milestoneDue', 'milestoneCollected', 'pendingMilestoneCount'],
    );
    this.applyNumericMap(rowMap, issueRows, ['openIssues', 'overdueIssues', 'criticalIssues']);
    this.applyNumericMap(rowMap, drawingRows, ['drawingBlockers']);
    this.applyNumericMap(
      rowMap,
      qualityInspectionRows,
      ['totalRfis', 'approvedRfis', 'pendingRfis'],
    );
    this.applyNumericMap(
      rowMap,
      qualityObservationRows,
      ['openQualityObservations', 'criticalQualityObservations'],
    );
    this.applyNumericMap(rowMap, auditRows, ['auditCount', 'auditFindings']);
    this.applyNumericMap(rowMap, snagRows, ['handoverReadyUnits', 'activeSnagUnits']);
    this.applyLatestQualityScores(rowMap, ratingRows);
    this.applyNumericMap(rowMap, manhourRows, ['safeManhours']);
    this.applyNumericMap(
      rowMap,
      incidentRows,
      ['totalIncidents', 'ltiCount', 'nearMissCount', 'medicalCases'],
    );
    this.applyNumericMap(
      rowMap,
      ehsInspectionRows,
      ['overdueEhsInspections', 'pendingEhsInspections'],
    );
    this.applyNumericMap(
      rowMap,
      trainingRows,
      ['totalTrainings', 'completedTrainings', 'trainingAttendees'],
    );
    this.applyNumericMap(rowMap, legalRows, ['complianceAlerts']);
    this.applyNumericMap(rowMap, machineryRows, ['complianceAlerts'], true);
    this.applyNumericMap(rowMap, vehicleRows, ['complianceAlerts'], true);
    this.applyNumericMap(rowMap, competencyRows, ['competencyAlerts']);
    this.applyNumericMap(
      rowMap,
      ehsObservationRows,
      ['openEhsObservations', 'criticalEhsObservations'],
    );

    rows.forEach((row) => {
      row.pendingMilestoneAmount = Math.max(0, row.milestoneDue - row.milestoneCollected);
      row.scheduleHealth = row.totalActivities
        ? Math.max(
            0,
            Math.min(
              100,
              ((row.totalActivities - row.delayedActivities) / row.totalActivities) * 100,
            ),
          )
        : 0;
      row.inspectionApprovalRate = row.totalRfis
        ? (row.approvedRfis / row.totalRfis) * 100
        : 0;
      row.trainingCompliance = row.totalTrainings
        ? (row.completedTrainings / row.totalTrainings) * 100
        : 100;
      row.qualityRiskScore =
        row.openQualityObservations * 3 +
        row.criticalQualityObservations * 5 +
        row.pendingRfis * 2 +
        row.activeSnagUnits * 2 +
        row.auditFindings;
      row.ehsRiskScore =
        row.openEhsObservations * 3 +
        row.criticalEhsObservations * 5 +
        row.overdueEhsInspections * 3 +
        row.complianceAlerts * 2 +
        row.competencyAlerts * 2 +
        row.ltiCount * 10 +
        row.medicalCases * 5 +
        row.nearMissCount * 2;
      row.executionRiskScore =
        row.delayedActivities * 4 +
        row.overdueIssues * 3 +
        row.criticalIssues * 3 +
        row.drawingBlockers * 2;
    });

    return rows;
  }

  private createProjectRow(project: ScopeProject): ExecutiveProjectRow {
    return {
      ...project,
      totalActivities: 0,
      completedActivities: 0,
      delayedActivities: 0,
      progressPercent: 0,
      burnValue: 0,
      manpower: 0,
      activeWorkOrders: 0,
      activeWorkOrderValue: 0,
      milestoneDue: 0,
      milestoneCollected: 0,
      pendingMilestoneAmount: 0,
      pendingMilestoneCount: 0,
      openIssues: 0,
      overdueIssues: 0,
      criticalIssues: 0,
      drawingBlockers: 0,
      totalRfis: 0,
      approvedRfis: 0,
      pendingRfis: 0,
      openQualityObservations: 0,
      criticalQualityObservations: 0,
      auditCount: 0,
      auditFindings: 0,
      handoverReadyUnits: 0,
      activeSnagUnits: 0,
      qualityScore: 0,
      safeManhours: 0,
      totalIncidents: 0,
      ltiCount: 0,
      nearMissCount: 0,
      medicalCases: 0,
      overdueEhsInspections: 0,
      pendingEhsInspections: 0,
      completedTrainings: 0,
      totalTrainings: 0,
      trainingAttendees: 0,
      complianceAlerts: 0,
      competencyAlerts: 0,
      openEhsObservations: 0,
      criticalEhsObservations: 0,
      scheduleHealth: 0,
      inspectionApprovalRate: 0,
      trainingCompliance: 100,
      qualityRiskScore: 0,
      ehsRiskScore: 0,
      executionRiskScore: 0,
    };
  }

  private applyNumericMap(
    rowMap: Map<number, ExecutiveProjectRow>,
    rawRows: any[],
    fields: string[],
    accumulate = false,
  ) {
    rawRows.forEach((rawRow) => {
      const projectId = Number(rawRow.projectId);
      const row = rowMap.get(projectId);
      if (!row) return;

      fields.forEach((field) => {
        const value = this.toNumber(rawRow[field]);
        if (accumulate) {
          (row as unknown as Record<string, number>)[field] += value;
        } else {
          (row as unknown as Record<string, number>)[field] = value;
        }
      });
    });
  }

  private applyLatestQualityScores(
    rowMap: Map<number, ExecutiveProjectRow>,
    ratingRows: any[],
  ) {
    const seen = new Set<number>();
    ratingRows.forEach((ratingRow) => {
      const projectId = Number(ratingRow.projectId);
      if (seen.has(projectId)) return;
      const row = rowMap.get(projectId);
      if (!row) return;
      row.qualityScore = this.toNumber(ratingRow.overallScore);
      seen.add(projectId);
    });
  }

  private aggregateRows(rows: ExecutiveProjectRow[]): ExecutiveAggregateTotals {
    const totalActivities = rows.reduce((sum, row) => sum + row.totalActivities, 0);
    const totalRfis = rows.reduce((sum, row) => sum + row.totalRfis, 0);
    const totalTrainings = rows.reduce((sum, row) => sum + row.totalTrainings, 0);

    return {
      totalProjects: rows.length,
      activeProjects: rows.filter((row) => this.isActiveProject(row.status)).length,
      delayedProjects: rows.filter((row) => row.delayedActivities > 0).length,
      delayedActivities: rows.reduce((sum, row) => sum + row.delayedActivities, 0),
      portfolioValue: rows.reduce(
        (sum, row) => sum + (row.approvedBudget || row.estimatedCost),
        0,
      ),
      workOrderValue: rows.reduce((sum, row) => sum + row.activeWorkOrderValue, 0),
      burnValue: rows.reduce((sum, row) => sum + row.burnValue, 0),
      manpower: rows.reduce((sum, row) => sum + row.manpower, 0),
      activeWorkOrders: rows.reduce((sum, row) => sum + row.activeWorkOrders, 0),
      milestoneDue: rows.reduce((sum, row) => sum + row.milestoneDue, 0),
      milestoneCollected: rows.reduce((sum, row) => sum + row.milestoneCollected, 0),
      pendingMilestoneAmount: rows.reduce(
        (sum, row) => sum + row.pendingMilestoneAmount,
        0,
      ),
      openIssues: rows.reduce((sum, row) => sum + row.openIssues, 0),
      overdueIssues: rows.reduce((sum, row) => sum + row.overdueIssues, 0),
      criticalIssues: rows.reduce((sum, row) => sum + row.criticalIssues, 0),
      drawingBlockers: rows.reduce((sum, row) => sum + row.drawingBlockers, 0),
      totalRfis,
      approvedRfis: rows.reduce((sum, row) => sum + row.approvedRfis, 0),
      pendingRfis: rows.reduce((sum, row) => sum + row.pendingRfis, 0),
      openQualityObservations: rows.reduce(
        (sum, row) => sum + row.openQualityObservations,
        0,
      ),
      criticalQualityObservations: rows.reduce(
        (sum, row) => sum + row.criticalQualityObservations,
        0,
      ),
      auditFindings: rows.reduce((sum, row) => sum + row.auditFindings, 0),
      handoverReadyUnits: rows.reduce((sum, row) => sum + row.handoverReadyUnits, 0),
      activeSnagUnits: rows.reduce((sum, row) => sum + row.activeSnagUnits, 0),
      qualityScore: rows.length
        ? rows.reduce((sum, row) => sum + row.qualityScore, 0) / rows.length
        : 0,
      safeManhours: rows.reduce((sum, row) => sum + row.safeManhours, 0),
      totalIncidents: rows.reduce((sum, row) => sum + row.totalIncidents, 0),
      ltiCount: rows.reduce((sum, row) => sum + row.ltiCount, 0),
      nearMissCount: rows.reduce((sum, row) => sum + row.nearMissCount, 0),
      medicalCases: rows.reduce((sum, row) => sum + row.medicalCases, 0),
      overdueEhsInspections: rows.reduce(
        (sum, row) => sum + row.overdueEhsInspections,
        0,
      ),
      trainingCompliance: totalTrainings
        ? (rows.reduce((sum, row) => sum + row.completedTrainings, 0) / totalTrainings) *
          100
        : 100,
      complianceAlerts: rows.reduce((sum, row) => sum + row.complianceAlerts, 0),
      competencyAlerts: rows.reduce((sum, row) => sum + row.competencyAlerts, 0),
      openEhsObservations: rows.reduce((sum, row) => sum + row.openEhsObservations, 0),
      criticalEhsObservations: rows.reduce(
        (sum, row) => sum + row.criticalEhsObservations,
        0,
      ),
      scheduleHealth: totalActivities
        ? rows.reduce((sum, row) => sum + row.scheduleHealth * row.totalActivities, 0) /
          totalActivities
        : 0,
      inspectionApprovalRate: totalRfis
        ? (rows.reduce((sum, row) => sum + row.approvedRfis, 0) / totalRfis) * 100
        : 0,
    };
  }

  private buildCompanyRows(
    projectRows: ExecutiveProjectRow[],
    companies: ScopeCompany[],
    companyProjectIds: Map<number, number[]>,
  ): ExecutiveCompanyRow[] {
    const companyMap = new Map(companies.map((company) => [company.id, company]));
    const rows: ExecutiveCompanyRow[] = [];

    companyProjectIds.forEach((projectIds, companyId) => {
      const company = companyMap.get(companyId);
      if (!company) return;
      const scopedRows = projectRows.filter((row) => row.companyId === companyId);
      if (scopedRows.length === 0) return;

      rows.push({
        companyId,
        companyName: company.name,
        projectCount: scopedRows.length,
        activeProjects: scopedRows.filter((row) => this.isActiveProject(row.status)).length,
        portfolioValue: scopedRows.reduce(
          (sum, row) => sum + (row.approvedBudget || row.estimatedCost),
          0,
        ),
        workOrderValue: scopedRows.reduce((sum, row) => sum + row.activeWorkOrderValue, 0),
        burnValue: scopedRows.reduce((sum, row) => sum + row.burnValue, 0),
        collectionsDue: scopedRows.reduce((sum, row) => sum + row.milestoneDue, 0),
        collectionsCollected: scopedRows.reduce(
          (sum, row) => sum + row.milestoneCollected,
          0,
        ),
        delayedActivities: scopedRows.reduce((sum, row) => sum + row.delayedActivities, 0),
        progressPercent: scopedRows.length
          ? scopedRows.reduce((sum, row) => sum + row.progressPercent, 0) /
            scopedRows.length
          : 0,
        qualityRiskScore: scopedRows.reduce((sum, row) => sum + row.qualityRiskScore, 0),
        ehsRiskScore: scopedRows.reduce((sum, row) => sum + row.ehsRiskScore, 0),
        openQualityObservations: scopedRows.reduce(
          (sum, row) => sum + row.openQualityObservations,
          0,
        ),
        openEhsObservations: scopedRows.reduce(
          (sum, row) => sum + row.openEhsObservations,
          0,
        ),
      });
    });

    return rows.sort((left, right) => right.portfolioValue - left.portfolioValue);
  }

  private buildHeadlineMetrics(
    mode: ExecutiveMode,
    totals: ExecutiveAggregateTotals,
    companyRows: ExecutiveCompanyRow[],
    projectRows: ExecutiveProjectRow[],
    visibleCompanyCount: number,
  ): DashboardMetric[] {
    const budgetBase = Math.max(totals.portfolioValue, 1);
    const workOrderCommitmentPct = (totals.workOrderValue / budgetBase) * 100;
    const burnCoveragePct = (totals.burnValue / budgetBase) * 100;

    if (mode === 'enterprise') {
      return [
        { key: 'companies', label: 'Companies', value: visibleCompanyCount, format: 'number' },
        { key: 'projects', label: 'Projects', value: totals.totalProjects, format: 'number' },
        {
          key: 'activeProjects',
          label: 'Active Projects',
          value: totals.activeProjects,
          format: 'number',
          tone: 'positive',
          visualPercent: totals.totalProjects ? (totals.activeProjects / totals.totalProjects) * 100 : 0,
          visualLabel: `${totals.activeProjects}/${totals.totalProjects} projects active`,
        },
        {
          key: 'delayedProjects',
          label: 'Delayed Projects',
          value: totals.delayedProjects,
          format: 'number',
          tone: totals.delayedProjects > 0 ? 'warning' : 'positive',
          visualPercent:
            totals.totalProjects > 0 ? (totals.delayedProjects / totals.totalProjects) * 100 : 0,
          visualLabel: `${totals.delayedProjects}/${totals.totalProjects} projects delayed`,
        },
        {
          key: 'budgetValue',
          label: 'Total Budgeted Value',
          value: totals.portfolioValue,
          format: 'currency',
          helper: 'Approved and estimated value across visible projects',
          visualPercent: 100,
          visualLabel: 'Budget baseline',
        },
        {
          key: 'woIssuedValue',
          label: 'WO Issued Value',
          value: totals.workOrderValue,
          format: 'currency',
          tone: totals.workOrderValue > 0 ? 'positive' : 'warning',
          helper: `${totals.activeWorkOrders} active work orders in the selected scope`,
          visualPercent: workOrderCommitmentPct,
          visualLabel: `${workOrderCommitmentPct.toFixed(0)}% of budget committed`,
        },
        {
          key: 'burnValue',
          label: 'Burn Value',
          value: totals.burnValue,
          format: 'currency',
          tone:
            burnCoveragePct >= 75 ? 'positive' : burnCoveragePct >= 40 ? 'warning' : 'default',
          helper: 'Measured execution burn during the selected range',
          visualPercent: burnCoveragePct,
          visualLabel: `${burnCoveragePct.toFixed(0)}% of budget burned`,
        },
      ];
    }

    if (mode === 'company') {
      return [
        { key: 'projects', label: 'Projects', value: totals.totalProjects, format: 'number' },
        {
          key: 'activeProjects',
          label: 'Active Projects',
          value: totals.activeProjects,
          format: 'number',
          tone: 'positive',
          visualPercent: totals.totalProjects ? (totals.activeProjects / totals.totalProjects) * 100 : 0,
          visualLabel: `${totals.activeProjects}/${totals.totalProjects} projects active`,
        },
        {
          key: 'delayedProjects',
          label: 'Delayed Projects',
          value: totals.delayedProjects,
          format: 'number',
          tone: totals.delayedProjects > 0 ? 'warning' : 'positive',
          visualPercent:
            totals.totalProjects > 0 ? (totals.delayedProjects / totals.totalProjects) * 100 : 0,
          visualLabel: `${totals.delayedProjects}/${totals.totalProjects} projects delayed`,
        },
        {
          key: 'delayedActivities',
          label: 'Delayed Activities',
          value: totals.delayedActivities,
          format: 'number',
          tone: totals.delayedActivities > 0 ? 'warning' : 'positive',
          helper: 'Activities past planned finish date and still incomplete',
        },
        {
          key: 'budgetValue',
          label: 'Total Budgeted Value',
          value: totals.portfolioValue,
          format: 'currency',
          helper: 'Approved and estimated value across company projects',
          visualPercent: 100,
          visualLabel: 'Budget baseline',
        },
        {
          key: 'woIssuedValue',
          label: 'WO Issued Value',
          value: totals.workOrderValue,
          format: 'currency',
          tone: totals.workOrderValue > 0 ? 'positive' : 'warning',
          helper: `${totals.activeWorkOrders} active work orders across company projects`,
          visualPercent: workOrderCommitmentPct,
          visualLabel: `${workOrderCommitmentPct.toFixed(0)}% of budget committed`,
        },
        {
          key: 'burnValue',
          label: 'Burn Value',
          value: totals.burnValue,
          format: 'currency',
          tone:
            burnCoveragePct >= 75 ? 'positive' : burnCoveragePct >= 40 ? 'warning' : 'default',
          helper: 'Measured execution burn during the selected range',
          visualPercent: burnCoveragePct,
          visualLabel: `${burnCoveragePct.toFixed(0)}% of budget burned`,
        },
      ];
    }

    const currentProject = projectRows[0];
    const projectBudget = Math.max(
      currentProject?.approvedBudget || currentProject?.estimatedCost || 0,
      1,
    );
    const projectWorkOrderPct =
      ((currentProject?.activeWorkOrderValue || 0) / projectBudget) * 100;
    const projectBurnPct = ((currentProject?.burnValue || 0) / projectBudget) * 100;

    return [
      {
        key: 'actualProgress',
        label: 'Actual Progress',
        value: currentProject?.progressPercent || 0,
        format: 'percent',
      },
      {
        key: 'delayedActivities',
        label: 'Delayed Activities',
        value: currentProject?.delayedActivities || 0,
        format: 'number',
        tone: (currentProject?.delayedActivities || 0) > 0 ? 'warning' : 'positive',
        helper: 'Activities past planned finish date and still incomplete',
        visualPercent:
          (currentProject?.totalActivities || 0) > 0
            ? ((currentProject?.delayedActivities || 0) /
                (currentProject?.totalActivities || 1)) *
              100
            : 0,
        visualLabel: `${currentProject?.delayedActivities || 0}/${currentProject?.totalActivities || 0} activities delayed`,
      },
      {
        key: 'pendingQa',
        label: 'Pending QA',
        value: currentProject?.pendingRfis || 0,
        format: 'number',
        tone: (currentProject?.pendingRfis || 0) > 0 ? 'warning' : 'positive',
        visualPercent:
          (currentProject?.totalRfis || 0) > 0
            ? ((currentProject?.pendingRfis || 0) / (currentProject?.totalRfis || 1)) * 100
            : 0,
        visualLabel: `${currentProject?.pendingRfis || 0}/${currentProject?.totalRfis || 0} RFIs pending`,
      },
      {
        key: 'openIssues',
        label: 'Open Issues',
        value: currentProject?.openIssues || 0,
        format: 'number',
        tone: (currentProject?.overdueIssues || 0) > 0 ? 'warning' : 'default',
        helper: `${currentProject?.overdueIssues || 0} overdue issue tracker items`,
      },
      {
        key: 'budgetValue',
        label: 'Budgeted Value',
        value: currentProject?.approvedBudget || currentProject?.estimatedCost || 0,
        format: 'currency',
        helper: 'Approved or estimated project budget baseline',
        visualPercent: 100,
        visualLabel: 'Budget baseline',
      },
      {
        key: 'woIssuedValue',
        label: 'WO Issued Value',
        value: currentProject?.activeWorkOrderValue || 0,
        format: 'currency',
        tone: (currentProject?.activeWorkOrderValue || 0) > 0 ? 'positive' : 'warning',
        helper: `${currentProject?.activeWorkOrders || 0} active work orders`,
        visualPercent: projectWorkOrderPct,
        visualLabel: `${projectWorkOrderPct.toFixed(0)}% of budget committed`,
      },
      {
        key: 'burnValue',
        label: 'Burn Value',
        value: currentProject?.burnValue || 0,
        format: 'currency',
        tone:
          projectBurnPct >= 75 ? 'positive' : projectBurnPct >= 40 ? 'warning' : 'default',
        helper: 'Measured execution burn during the selected range',
        visualPercent: projectBurnPct,
        visualLabel: `${projectBurnPct.toFixed(0)}% of budget burned`,
      },
    ];
  }

  private buildProgressSection(
    totals: ExecutiveAggregateTotals,
    projectRows: ExecutiveProjectRow[],
    trend: DashboardTrend,
    mode: ExecutiveMode,
  ): DashboardSection {
    const budgetBase = Math.max(totals.portfolioValue, 1);
    const workOrderCommitmentPct = (totals.workOrderValue / budgetBase) * 100;
    const burnCoveragePct = (totals.burnValue / budgetBase) * 100;

    return {
      kpis: [
        {
          key: 'delayedActivities',
          label: 'Delayed Activities',
          value: totals.delayedActivities,
          format: 'number',
          tone: totals.delayedActivities > 0 ? 'warning' : 'positive',
          helper: `${totals.delayedProjects} project(s) currently carrying delay`,
        },
        {
          key: 'actualProgress',
          label: 'Actual Progress',
          value: projectRows.length
            ? projectRows.reduce((sum, row) => sum + row.progressPercent, 0) /
              projectRows.length
            : 0,
          format: 'percent',
        },
        {
          key: 'budgetValue',
          label: 'Budgeted Value',
          value: totals.portfolioValue,
          format: 'currency',
          helper: 'Approved and estimated value in the selected scope',
          visualPercent: 100,
          visualLabel: 'Budget baseline',
        },
        {
          key: 'woIssuedValue',
          label: 'WO Issued Value',
          value: totals.workOrderValue,
          format: 'currency',
          tone: totals.workOrderValue > 0 ? 'positive' : 'warning',
          helper: `${totals.activeWorkOrders} active work orders`,
          visualPercent: workOrderCommitmentPct,
          visualLabel: `${workOrderCommitmentPct.toFixed(0)}% of budget committed`,
        },
        {
          key: 'burnValue',
          label: 'Burn Value',
          value: totals.burnValue,
          format: 'currency',
          tone:
            burnCoveragePct >= 75 ? 'positive' : burnCoveragePct >= 40 ? 'warning' : 'default',
          helper: 'Measured execution burn during the selected range',
          visualPercent: burnCoveragePct,
          visualLabel: `${burnCoveragePct.toFixed(0)}% of budget burned`,
        },
        { key: 'manpower', label: 'Latest Manpower', value: totals.manpower, format: 'number' },
        {
          key: 'workOrders',
          label: 'Active WOs',
          value: totals.activeWorkOrders,
          format: 'number',
        },
        {
          key: 'drawings',
          label: 'Drawing Blockers',
          value: totals.drawingBlockers,
          format: 'number',
          tone: totals.drawingBlockers > 0 ? 'warning' : 'positive',
        },
      ],
      trend,
      alerts: this.buildProgressAlerts(projectRows),
      actions: this.buildProgressActions(projectRows, mode),
    };
  }

  private buildQualitySection(
    totals: ExecutiveAggregateTotals,
    projectRows: ExecutiveProjectRow[],
    trend: DashboardTrend,
    mode: ExecutiveMode,
  ): DashboardSection {
    return {
      kpis: [
        {
          key: 'pendingRfis',
          label: 'Pending RFIs',
          value: totals.pendingRfis,
          format: 'number',
          tone: totals.pendingRfis > 0 ? 'warning' : 'positive',
        },
        {
          key: 'approvedRfis',
          label: 'Approved RFIs',
          value: totals.approvedRfis,
          format: 'number',
          tone: 'positive',
        },
        {
          key: 'inspectionApprovalRate',
          label: 'Approval Rate',
          value: totals.inspectionApprovalRate,
          format: 'percent',
        },
        {
          key: 'openObservations',
          label: 'Open Observations',
          value: totals.openQualityObservations,
          format: 'number',
          tone: totals.criticalQualityObservations > 0 ? 'warning' : 'default',
        },
        {
          key: 'criticalObservations',
          label: 'Critical Observations',
          value: totals.criticalQualityObservations,
          format: 'number',
          tone: totals.criticalQualityObservations > 0 ? 'danger' : 'positive',
        },
        {
          key: 'auditFindings',
          label: 'Audit Findings',
          value: totals.auditFindings,
          format: 'number',
        },
        {
          key: 'snagReady',
          label: 'Handover Ready Units',
          value: totals.handoverReadyUnits,
          format: 'number',
          tone: 'positive',
        },
        {
          key: 'qualityScore',
          label: 'Quality Score',
          value: totals.qualityScore,
          format: 'percent',
          tone: totals.qualityScore >= 80 ? 'positive' : 'warning',
        },
      ],
      trend,
      alerts: this.buildQualityAlerts(projectRows),
      actions: this.buildQualityActions(projectRows, mode),
    };
  }

  private buildEhsSection(
    totals: ExecutiveAggregateTotals,
    projectRows: ExecutiveProjectRow[],
    trend: DashboardTrend,
    mode: ExecutiveMode,
  ): DashboardSection {
    return {
      kpis: [
        { key: 'safeManhours', label: 'Safe Manhours', value: totals.safeManhours, format: 'number', tone: 'positive' },
        {
          key: 'incidents',
          label: 'Incidents',
          value: totals.totalIncidents,
          format: 'number',
          tone: totals.totalIncidents > 0 ? 'warning' : 'positive',
        },
        {
          key: 'lti',
          label: 'LTI Cases',
          value: totals.ltiCount,
          format: 'number',
          tone: totals.ltiCount > 0 ? 'danger' : 'positive',
        },
        {
          key: 'overdueInspections',
          label: 'Overdue Inspections',
          value: totals.overdueEhsInspections,
          format: 'number',
          tone: totals.overdueEhsInspections > 0 ? 'warning' : 'positive',
        },
        {
          key: 'trainingCompliance',
          label: 'Training Compliance',
          value: totals.trainingCompliance,
          format: 'percent',
        },
        {
          key: 'complianceAlerts',
          label: 'Expiry Alerts',
          value: totals.complianceAlerts + totals.competencyAlerts,
          format: 'number',
          tone:
            totals.complianceAlerts + totals.competencyAlerts > 0
              ? 'warning'
              : 'positive',
        },
        {
          key: 'openEhsObs',
          label: 'Open EHS Observations',
          value: totals.openEhsObservations,
          format: 'number',
        },
        {
          key: 'criticalEhsObs',
          label: 'Critical EHS Obs',
          value: totals.criticalEhsObservations,
          format: 'number',
          tone: totals.criticalEhsObservations > 0 ? 'danger' : 'positive',
        },
      ],
      trend,
      alerts: this.buildEhsAlerts(projectRows),
      actions: this.buildEhsActions(projectRows, mode),
    };
  }

  private buildRankingGroups(
    mode: ExecutiveMode,
    companyRows: ExecutiveCompanyRow[],
    projectRows: ExecutiveProjectRow[],
  ): RankingGroup[] {
    if (mode === 'enterprise') {
      return [
        {
          key: 'company-rankings',
          label: 'Company Rankings',
          rows: companyRows.slice(0, 6).map((company) => ({
            key: `company-${company.companyId}`,
            label: company.companyName,
            secondaryLabel: `${company.projectCount} projects`,
            metrics: [
              { label: 'Budgeted', value: company.portfolioValue, format: 'currency' },
              { label: 'WO Issued', value: company.workOrderValue, format: 'currency' },
              { label: 'Burn', value: company.burnValue, format: 'currency' },
              { label: 'Progress', value: company.progressPercent, format: 'percent' },
              {
                label: 'Quality Risk',
                value: company.qualityRiskScore,
                format: 'number',
                tone: company.qualityRiskScore > 0 ? 'warning' : 'positive',
              },
            ],
          })),
        },
        {
          key: 'delayed-projects',
          label: 'Top Delayed Projects',
          rows: projectRows
            .filter((row) => row.delayedActivities > 0)
            .sort((left, right) => right.delayedActivities - left.delayedActivities)
            .slice(0, 6)
            .map((row) => this.toProjectRankingRow(row, 'schedule')),
        },
        {
          key: 'quality-risk-projects',
          label: 'Top Quality Risk Projects',
          rows: projectRows
            .filter((row) => row.qualityRiskScore > 0)
            .sort((left, right) => right.qualityRiskScore - left.qualityRiskScore)
            .slice(0, 6)
            .map((row) => this.toProjectRankingRow(row, 'quality')),
        },
        {
          key: 'ehs-risk-projects',
          label: 'Top EHS Risk Projects',
          rows: projectRows
            .filter((row) => row.ehsRiskScore > 0)
            .sort((left, right) => right.ehsRiskScore - left.ehsRiskScore)
            .slice(0, 6)
            .map((row) => this.toProjectRankingRow(row, 'ehs')),
        },
      ];
    }

    if (mode === 'company') {
      return [
        {
          key: 'project-comparison',
          label: 'Project Comparison',
          rows: projectRows
            .slice()
            .sort((left, right) => right.progressPercent - left.progressPercent)
            .slice(0, 8)
            .map((row) => ({
              key: `project-${row.id}`,
              label: row.name,
              secondaryLabel: row.status || 'Active',
              route: this.getPlanningRoute(row.id, 'schedule'),
              metrics: [
                { label: 'Progress', value: row.progressPercent, format: 'percent' },
                { label: 'Delayed', value: row.delayedActivities, format: 'number' },
                { label: 'Pending QA', value: row.pendingRfis, format: 'number' },
              ],
            })),
        },
        {
          key: 'quality-risk-projects',
          label: 'Quality Risk Projects',
          rows: projectRows
            .slice()
            .sort((left, right) => right.qualityRiskScore - left.qualityRiskScore)
            .slice(0, 6)
            .map((row) => this.toProjectRankingRow(row, 'quality')),
        },
        {
          key: 'ehs-risk-projects',
          label: 'EHS Risk Projects',
          rows: projectRows
            .slice()
            .sort((left, right) => right.ehsRiskScore - left.ehsRiskScore)
            .slice(0, 6)
            .map((row) => this.toProjectRankingRow(row, 'ehs')),
        },
      ];
    }

    return [
      {
        key: 'action-queue',
        label: 'Direct Action Queue',
        rows: projectRows.slice(0, 1).flatMap((row) => [
          {
            key: `project-planning-${row.id}`,
            label: 'Open Planning & Schedule',
            secondaryLabel: 'Schedule, issues, work orders',
            route: this.getPlanningRoute(row.id, 'schedule'),
            metrics: [
              { label: 'Delayed', value: row.delayedActivities, format: 'number' },
              { label: 'Issues', value: row.openIssues, format: 'number' },
            ],
          },
          {
            key: `project-quality-${row.id}`,
            label: 'Open Quality Workspace',
            secondaryLabel: 'RFIs, observations, snag, audits',
            route: `/dashboard/projects/${row.id}/quality`,
            metrics: [
              { label: 'Pending QA', value: row.pendingRfis, format: 'number' },
              { label: 'Snag Units', value: row.activeSnagUnits, format: 'number' },
            ],
          },
          {
            key: `project-ehs-${row.id}`,
            label: 'Open EHS Workspace',
            secondaryLabel: 'Incidents, inspections, compliance',
            route: `/dashboard/projects/${row.id}/ehs`,
            metrics: [
              { label: 'Overdue', value: row.overdueEhsInspections, format: 'number' },
              {
                label: 'Alerts',
                value: row.complianceAlerts + row.competencyAlerts,
                format: 'number',
              },
            ],
          },
        ]),
      },
    ];
  }

  private buildProgressAlerts(projectRows: ExecutiveProjectRow[]): DashboardListItem[] {
    return [
      ...projectRows
        .filter((row) => row.delayedActivities > 0)
        .sort((left, right) => right.delayedActivities - left.delayedActivities)
        .slice(0, 3)
        .map((row) => ({
          key: `delay-${row.id}`,
          title: `${row.name} has delayed activities`,
          description: `${row.delayedActivities} delayed activities need planning recovery.`,
          severity: 'danger' as const,
          value: row.delayedActivities,
          projectId: row.id,
          projectName: row.name,
          route: this.getPlanningRoute(row.id, 'schedule'),
        })),
      ...projectRows
        .filter((row) => row.overdueIssues > 0)
        .sort((left, right) => right.overdueIssues - left.overdueIssues)
        .slice(0, 2)
        .map((row) => ({
          key: `issues-${row.id}`,
          title: `${row.name} has overdue issues`,
          description: `${row.overdueIssues} issue tracker items are past required date.`,
          severity: 'warning' as const,
          value: row.overdueIssues,
          projectId: row.id,
          projectName: row.name,
          route: this.getPlanningRoute(row.id, 'issue_tracker'),
        })),
    ].slice(0, 4);
  }

  private buildProgressActions(
    projectRows: ExecutiveProjectRow[],
    mode: ExecutiveMode,
  ): DashboardListItem[] {
    return [
      ...projectRows
        .filter((row) => row.activeWorkOrders === 0 && row.delayedActivities > 0)
        .sort((left, right) => right.delayedActivities - left.delayedActivities)
        .slice(0, 2)
        .map((row) => ({
          key: `wo-gap-${row.id}`,
          title: `Issue work orders in ${row.name}`,
          description: `${row.delayedActivities} delayed activities are still not backed by active work orders.`,
          severity: 'warning' as const,
          value: row.delayedActivities,
          projectId: row.id,
          projectName: row.name,
          route: this.getPlanningRoute(row.id, 'contracts'),
        })),
      ...projectRows
        .filter((row) => row.openIssues > 0)
        .sort((left, right) => right.openIssues - left.openIssues)
        .slice(0, 2)
        .map((row) => ({
          key: `issue-clearance-${row.id}`,
          title: `Close execution blockers in ${row.name}`,
          description: `${row.openIssues} issue tracker items still need coordination closure.`,
          severity: 'warning' as const,
          value: row.openIssues,
          projectId: row.id,
          projectName: row.name,
          route: this.getPlanningRoute(row.id, 'issue_tracker'),
        })),
      ...projectRows
        .filter((row) => row.drawingBlockers > 0)
        .sort((left, right) => right.drawingBlockers - left.drawingBlockers)
        .slice(0, 2)
        .map((row) => ({
          key: `drawings-${row.id}`,
          title: `Resolve drawing blockers in ${row.name}`,
          description: `${row.drawingBlockers} drawings are not yet ready for construction.`,
          severity: 'warning' as const,
          value: row.drawingBlockers,
          projectId: row.id,
          projectName: row.name,
          route: `/dashboard/projects/${row.id}/design`,
        })),
    ].slice(0, mode === 'project' ? 4 : 3);
  }

  private buildQualityAlerts(projectRows: ExecutiveProjectRow[]): DashboardListItem[] {
    return [
      ...projectRows
        .filter((row) => row.criticalQualityObservations > 0)
        .sort(
          (left, right) =>
            right.criticalQualityObservations - left.criticalQualityObservations,
        )
        .slice(0, 2)
        .map((row) => ({
          key: `quality-obs-${row.id}`,
          title: `Critical observations in ${row.name}`,
          description: `${row.criticalQualityObservations} critical quality observations are still open.`,
          severity: 'danger' as const,
          value: row.criticalQualityObservations,
          projectId: row.id,
          projectName: row.name,
          route: `/dashboard/projects/${row.id}/quality`,
        })),
      ...projectRows
        .filter((row) => row.pendingRfis > 0)
        .sort((left, right) => right.pendingRfis - left.pendingRfis)
        .slice(0, 2)
        .map((row) => ({
          key: `quality-rfi-${row.id}`,
          title: `Pending QA approvals in ${row.name}`,
          description: `${row.pendingRfis} RFIs are waiting for QA/QC approval.`,
          severity: 'warning' as const,
          value: row.pendingRfis,
          projectId: row.id,
          projectName: row.name,
          route: `/dashboard/projects/${row.id}/quality/approvals`,
        })),
    ].slice(0, 4);
  }

  private buildQualityActions(
    projectRows: ExecutiveProjectRow[],
    mode: ExecutiveMode,
  ): DashboardListItem[] {
    return [
      ...projectRows
        .filter((row) => row.activeSnagUnits > 0)
        .sort((left, right) => right.activeSnagUnits - left.activeSnagUnits)
        .slice(0, 2)
        .map((row) => ({
          key: `quality-snag-${row.id}`,
          title: `Push snag closure in ${row.name}`,
          description: `${row.activeSnagUnits} units are still in snag / de-snag flow.`,
          severity: 'info' as const,
          value: row.activeSnagUnits,
          projectId: row.id,
          projectName: row.name,
          route: `/dashboard/projects/${row.id}/quality`,
        })),
      ...projectRows
        .filter((row) => row.auditFindings > 0)
        .sort((left, right) => right.auditFindings - left.auditFindings)
        .slice(0, 2)
        .map((row) => ({
          key: `quality-audit-${row.id}`,
          title: `Close audit findings in ${row.name}`,
          description: `${row.auditFindings} audit findings were recorded in the selected period.`,
          severity: 'warning' as const,
          value: row.auditFindings,
          projectId: row.id,
          projectName: row.name,
          route: `/dashboard/projects/${row.id}/quality`,
        })),
    ].slice(0, mode === 'project' ? 4 : 3);
  }

  private buildEhsAlerts(projectRows: ExecutiveProjectRow[]): DashboardListItem[] {
    return [
      ...projectRows
        .filter((row) => row.ltiCount > 0)
        .sort((left, right) => right.ltiCount - left.ltiCount)
        .slice(0, 2)
        .map((row) => ({
          key: `ehs-lti-${row.id}`,
          title: `LTI reported in ${row.name}`,
          description: `${row.ltiCount} lost-time incidents were logged in the selected period.`,
          severity: 'danger' as const,
          value: row.ltiCount,
          projectId: row.id,
          projectName: row.name,
          route: `/dashboard/projects/${row.id}/ehs`,
        })),
      ...projectRows
        .filter((row) => row.overdueEhsInspections > 0)
        .sort((left, right) => right.overdueEhsInspections - left.overdueEhsInspections)
        .slice(0, 2)
        .map((row) => ({
          key: `ehs-overdue-${row.id}`,
          title: `Overdue EHS inspections in ${row.name}`,
          description: `${row.overdueEhsInspections} inspections need immediate closure.`,
          severity: 'warning' as const,
          value: row.overdueEhsInspections,
          projectId: row.id,
          projectName: row.name,
          route: `/dashboard/projects/${row.id}/ehs`,
        })),
    ].slice(0, 4);
  }

  private buildEhsActions(
    projectRows: ExecutiveProjectRow[],
    mode: ExecutiveMode,
  ): DashboardListItem[] {
    return [
      ...projectRows
        .filter((row) => row.complianceAlerts + row.competencyAlerts > 0)
        .sort(
          (left, right) =>
            right.complianceAlerts +
            right.competencyAlerts -
            (left.complianceAlerts + left.competencyAlerts),
        )
        .slice(0, 2)
        .map((row) => ({
          key: `ehs-compliance-${row.id}`,
          title: `Renew EHS compliances in ${row.name}`,
          description: `${row.complianceAlerts + row.competencyAlerts} legal, machinery, vehicle, or competency items are expiring soon.`,
          severity: 'info' as const,
          value: row.complianceAlerts + row.competencyAlerts,
          projectId: row.id,
          projectName: row.name,
          route: `/dashboard/projects/${row.id}/ehs`,
        })),
      ...projectRows
        .filter((row) => row.trainingCompliance < 100)
        .sort((left, right) => left.trainingCompliance - right.trainingCompliance)
        .slice(0, 2)
        .map((row) => ({
          key: `ehs-training-${row.id}`,
          title: `Lift training compliance in ${row.name}`,
          description: `Training completion is at ${row.trainingCompliance.toFixed(0)}% for the selected period.`,
          severity: 'warning' as const,
          value: Number(row.trainingCompliance.toFixed(0)),
          projectId: row.id,
          projectName: row.name,
          route: `/dashboard/projects/${row.id}/ehs`,
        })),
    ].slice(0, mode === 'project' ? 4 : 3);
  }

  private toProjectRankingRow(
    row: ExecutiveProjectRow,
    domain: 'schedule' | 'quality' | 'ehs',
  ): RankingRow {
    if (domain === 'quality') {
      return {
        key: `quality-${row.id}`,
        label: row.name,
        secondaryLabel: row.companyName || row.status || 'Project',
        route: `/dashboard/projects/${row.id}/quality`,
        metrics: [
          { label: 'Risk', value: row.qualityRiskScore, format: 'number', tone: row.qualityRiskScore > 0 ? 'warning' : 'positive' },
          { label: 'Open Obs', value: row.openQualityObservations, format: 'number' },
          { label: 'Pending QA', value: row.pendingRfis, format: 'number' },
        ],
      };
    }

    if (domain === 'ehs') {
      return {
        key: `ehs-${row.id}`,
        label: row.name,
        secondaryLabel: row.companyName || row.status || 'Project',
        route: `/dashboard/projects/${row.id}/ehs`,
        metrics: [
          { label: 'Risk', value: row.ehsRiskScore, format: 'number', tone: row.ehsRiskScore > 0 ? 'warning' : 'positive' },
          { label: 'Overdue', value: row.overdueEhsInspections, format: 'number' },
          { label: 'Alerts', value: row.complianceAlerts + row.competencyAlerts, format: 'number' },
        ],
      };
    }

    return {
      key: `schedule-${row.id}`,
      label: row.name,
      secondaryLabel: row.companyName || row.status || 'Project',
      route: this.getPlanningRoute(row.id, 'schedule'),
      metrics: [
        { label: 'Delayed', value: row.delayedActivities, format: 'number', tone: row.delayedActivities > 0 ? 'warning' : 'positive' },
        { label: 'Progress', value: row.progressPercent, format: 'percent' },
        { label: 'Issues', value: row.openIssues, format: 'number' },
      ],
    };
  }

  private async getBurnTrend(projectIds: number[], window: DateWindow): Promise<DashboardTrend> {
    if (projectIds.length === 0) return EMPTY_TREND;
    const rawPoints = await this.progressRepo
      .createQueryBuilder('p')
      .leftJoin('p.measurementElement', 'me')
      .leftJoin('me.boqSubItem', 'sub')
      .select('p.date', 'label')
      .addSelect('COALESCE(SUM(p.executedQty * COALESCE(sub.rate, 0)), 0)', 'value')
      .where('me.projectId IN (:...projectIds)', { projectIds })
      .andWhere('p.date BETWEEN :dateFrom AND :dateTo', {
        dateFrom: window.dateFrom,
        dateTo: window.dateTo,
      })
      .groupBy('p.date')
      .orderBy('p.date', 'ASC')
      .getRawMany();

    return {
      key: 'burn-trend',
      label: 'Execution Burn',
      format: 'currency',
      points: rawPoints.map((point) => ({
        label: point.label,
        value: this.toNumber(point.value),
      })),
    };
  }

  private async getQualityTrend(projectIds: number[], window: DateWindow): Promise<DashboardTrend> {
    if (projectIds.length === 0) return EMPTY_TREND;
    const ratingPoints = await this.projectRatingRepo
      .createQueryBuilder('r')
      .select('r.period', 'label')
      .addSelect('AVG(r.overallScore)', 'value')
      .where('r.projectNodeId IN (:...projectIds)', { projectIds })
      .groupBy('r.period')
      .orderBy('r.period', 'ASC')
      .getRawMany();

    if (ratingPoints.length > 0) {
      return {
        key: 'quality-score-trend',
        label: 'Quality Score Trend',
        format: 'percent',
        points: ratingPoints.map((point) => ({
          label: point.label,
          value: this.toNumber(point.value),
        })),
      };
    }

    const observationPoints = await this.qualityObservationRepo
      .createQueryBuilder('o')
      .select('DATE(o.createdAt)', 'label')
      .addSelect('COUNT(*)', 'value')
      .where('o.projectId IN (:...projectIds)', { projectIds })
      .andWhere('o.createdAt >= :start AND o.createdAt < :endExclusive', {
        start: window.start,
        endExclusive: window.endExclusive,
      })
      .groupBy('DATE(o.createdAt)')
      .orderBy('DATE(o.createdAt)', 'ASC')
      .getRawMany();

    return {
      key: 'quality-observation-trend',
      label: 'Observation Trend',
      format: 'number',
      points: observationPoints.map((point) => ({
        label: point.label,
        value: this.toNumber(point.value),
      })),
    };
  }

  private async getEhsTrend(projectIds: number[], window: DateWindow): Promise<DashboardTrend> {
    if (projectIds.length === 0) return EMPTY_TREND;
    const manhourPoints = await this.manhoursRepo
      .createQueryBuilder('m')
      .select('m.month', 'label')
      .addSelect('COALESCE(SUM(m.safeManhours), 0)', 'value')
      .where('m.projectId IN (:...projectIds)', { projectIds })
      .andWhere('m.month BETWEEN :monthStart AND :monthEnd', {
        monthStart: window.monthStart,
        monthEnd: window.monthEnd,
      })
      .groupBy('m.month')
      .orderBy('m.month', 'ASC')
      .getRawMany();

    return {
      key: 'safe-manhours-trend',
      label: 'Safe Manhours Trend',
      format: 'number',
      points: manhourPoints.map((point) => ({
        label: point.label,
        value: this.toNumber(point.value),
      })),
    };
  }

  private getPlanningRoute(
    projectId: number,
    view: 'schedule' | 'issue_tracker' | 'customer_milestones' | 'contracts',
  ) {
    return `/dashboard/projects/${projectId}/planning?view=${view}`;
  }

  private isActiveProject(status: string | null) {
    const normalized = String(status || 'ACTIVE').toLowerCase();
    return !['completed', 'closed', 'archived'].includes(normalized);
  }
}
