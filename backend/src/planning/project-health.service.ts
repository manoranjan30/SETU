import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import { EpsNode } from '../eps/eps.entity';
import { ProjectProfile } from '../eps/project-profile.entity';
import {
  ProjectHealthBurnRow,
  ProjectHealthCatchupPlan,
  ProjectHealthCycleMetric,
  ProjectHealthEscalationRule,
  ProjectHealthMilestone,
  ProjectHealthReport,
  ProjectHealthResourceRow,
  ProjectHealthRisk,
  ProjectHealthScoreConfig,
} from './entities/project-health.entity';

type Severity = 'NO_IMPACT' | 'LOW' | 'MEDIUM' | 'HIGH';
type Probability = 'LOW' | 'MEDIUM' | 'HIGH';

const DEFAULT_LEAD_INDICATORS = [
  'Budget',
  'Procurement',
  'Contractor Appointment',
  'Contractor Performance',
  'Payment',
  'Drawings',
  'Shop Drawings',
  'Key Material Availability',
  'Finishing Palette',
  'Internal Decisions / Approvals',
  'Labour Availability',
  'Site Supervisor Availability',
  'External Ecosystem Issues',
  'Tender Package',
  'Others',
];

const DEFAULT_LAG_INDICATORS = [
  'Burn',
  'Collection',
  'Milestones',
  'Slab Cycle',
  'Floor Gaps',
  'Finishing Progress',
];

const DEFAULT_MILESTONES = [
  'Launch',
  'Sanction Plan',
  'Building Licence',
  'Start Construction',
  'Piling',
  'Raft',
  'Plinth',
  'Slabs',
  'Finishing',
  'Lifts',
  'MEP',
  'OC Application',
  'OC Receipt',
];

@Injectable()
export class ProjectHealthService {
  constructor(
    @InjectRepository(ProjectHealthReport)
    private readonly reportRepo: Repository<ProjectHealthReport>,
    @InjectRepository(ProjectHealthBurnRow)
    private readonly burnRepo: Repository<ProjectHealthBurnRow>,
    @InjectRepository(ProjectHealthResourceRow)
    private readonly resourceRepo: Repository<ProjectHealthResourceRow>,
    @InjectRepository(ProjectHealthCycleMetric)
    private readonly cycleRepo: Repository<ProjectHealthCycleMetric>,
    @InjectRepository(ProjectHealthRisk)
    private readonly riskRepo: Repository<ProjectHealthRisk>,
    @InjectRepository(ProjectHealthCatchupPlan)
    private readonly catchupRepo: Repository<ProjectHealthCatchupPlan>,
    @InjectRepository(ProjectHealthMilestone)
    private readonly milestoneRepo: Repository<ProjectHealthMilestone>,
    @InjectRepository(ProjectHealthEscalationRule)
    private readonly escalationRepo: Repository<ProjectHealthEscalationRule>,
    @InjectRepository(ProjectHealthScoreConfig)
    private readonly scoreConfigRepo: Repository<ProjectHealthScoreConfig>,
    @InjectRepository(EpsNode)
    private readonly epsRepo: Repository<EpsNode>,
    @InjectRepository(ProjectProfile)
    private readonly projectProfileRepo: Repository<ProjectProfile>,
  ) {}

  async listReports(projectId: number) {
    return this.reportRepo.find({
      where: { projectId },
      order: { reportingMonth: 'DESC', id: 'DESC' },
    });
  }

  async createReport(projectId: number, body: any, userId?: number) {
    const reportingMonth = this.toMonthDate(body.reportingMonth);
    const existing = await this.reportRepo.findOne({
      where: { projectId, reportingMonth },
    });
    if (existing) {
      throw new BadRequestException(
        'Health report already exists for this reporting month',
      );
    }

    const snapshot = await this.resolveProjectSnapshot(projectId);
    const report = this.reportRepo.create({
      projectId,
      reportingMonth,
      cbeSubmissionMonth: body.cbeSubmissionMonth
        ? this.toMonthDate(body.cbeSubmissionMonth)
        : reportingMonth,
      fiscalYear: body.fiscalYear || this.resolveFiscalYear(reportingMonth),
      status: 'DRAFT',
      preparedBy: userId || null,
      ...snapshot,
    });
    const saved = await this.reportRepo.save(report);
    await this.ensureDefaultConfig(projectId);
    await this.seedDefaultMilestones(saved.id);
    return this.getReport(projectId, saved.id);
  }

  async getReport(projectId: number, reportId: number) {
    const report = await this.reportRepo.findOne({
      where: { id: reportId, projectId },
      relations: [
        'burnRows',
        'resourceRows',
        'cycleMetrics',
        'risks',
        'catchupPlans',
        'milestones',
      ],
    });
    if (!report) throw new NotFoundException('Project health report not found');
    return this.sortReport(report);
  }

  async updateReport(
    projectId: number,
    reportId: number,
    body: any,
    userId?: number,
  ) {
    const report = await this.getMutableReport(projectId, reportId);
    Object.assign(report, {
      cbeSubmissionMonth:
        body.cbeSubmissionMonth !== undefined
          ? body.cbeSubmissionMonth
            ? this.toMonthDate(body.cbeSubmissionMonth)
            : null
          : report.cbeSubmissionMonth,
      fiscalYear: body.fiscalYear ?? report.fiscalYear,
      projectNameSnapshot:
        body.projectNameSnapshot ?? report.projectNameSnapshot,
      zoneSnapshot: body.zoneSnapshot ?? report.zoneSnapshot,
      regionSnapshot: body.regionSnapshot ?? report.regionSnapshot,
      plannerSnapshot: body.plannerSnapshot ?? report.plannerSnapshot,
      picSnapshot: body.picSnapshot ?? report.picSnapshot,
      preparedBy: report.preparedBy || userId || null,
    });
    await this.reportRepo.save(report);
    return this.getReport(projectId, reportId);
  }

  async replaceBurnRows(projectId: number, reportId: number, body: any) {
    await this.getMutableReport(projectId, reportId);
    await this.burnRepo.delete({ reportId });
    const rows = (body.rows || []).map((row) =>
      this.burnRepo.create({
        reportId,
        month: this.toMonthDate(row.month),
        metricType: this.normalizeMetricType(row.metricType),
        valueCrores: Number(row.valueCrores || 0),
        sourceType: row.sourceType || 'MANUAL',
        overrideReason: row.overrideReason || null,
        auditSnapshot: row.auditSnapshot || null,
      }),
    );
    if (rows.length) await this.burnRepo.save(rows);
    return this.recalculate(projectId, reportId);
  }

  async replaceResourceRows(projectId: number, reportId: number, body: any) {
    await this.getMutableReport(projectId, reportId);
    await this.resourceRepo.delete({ reportId });
    const rows = (body.rows || []).map((row) =>
      this.resourceRepo.create({
        reportId,
        resourceType:
          String(row.resourceType || 'LABOUR').toUpperCase() === 'STAFF'
            ? 'STAFF'
            : 'LABOUR',
        month: this.toMonthDate(row.month),
        aop: Number(row.aop || 0),
        planned: Number(row.planned || 0),
        actual: Number(row.actual || 0),
        sourceType: row.sourceType || 'MANUAL',
        overrideReason: row.overrideReason || null,
        auditSnapshot: row.auditSnapshot || null,
      }),
    );
    if (rows.length) await this.resourceRepo.save(rows);
    return this.recalculate(projectId, reportId);
  }

  async replaceCycleMetrics(projectId: number, reportId: number, body: any) {
    await this.getMutableReport(projectId, reportId);
    await this.cycleRepo.delete({ reportId });
    const rows = (body.rows || []).map((row) =>
      this.cycleRepo.create({
        reportId,
        month: this.toMonthDate(row.month),
        rccSlabCycle: this.optionalNumber(row.rccSlabCycle),
        postPourGap: this.optionalNumber(row.postPourGap),
        internalPlasterGap: this.optionalNumber(row.internalPlasterGap),
        tileFlooringGap: this.optionalNumber(row.tileFlooringGap),
        windowGap: this.optionalNumber(row.windowGap),
        projected: this.optionalNumber(row.projected),
        actual: this.optionalNumber(row.actual),
        aop: this.optionalNumber(row.aop),
        sourceType: row.sourceType || 'MANUAL',
        overrideReason: row.overrideReason || null,
        auditSnapshot: row.auditSnapshot || null,
      }),
    );
    if (rows.length) await this.cycleRepo.save(rows);
    return this.recalculate(projectId, reportId);
  }

  async replaceRisks(projectId: number, reportId: number, body: any) {
    await this.getMutableReport(projectId, reportId);
    await this.riskRepo.delete({ reportId });
    const rows = (body.rows || [])
      .filter((row) => String(row.taskDescription || '').trim())
      .map((row) => {
        const plannedDate = this.optionalDate(row.plannedDate);
        const cbeDate = this.optionalDate(row.cbeDate);
        const delayDays =
          row.delayDays !== undefined
            ? Number(row.delayDays || 0)
            : this.daysBetween(plannedDate, cbeDate);
        const severity = this.normalizeSeverity(row.severity);
        const riskProbability = this.probabilityFromDelay(delayDays);
        return this.riskRepo.create({
          reportId,
          tower: row.tower || null,
          package: row.package || null,
          taskGroup: row.taskGroup || null,
          taskDescription: String(row.taskDescription).trim(),
          raisedDate: this.optionalDate(row.raisedDate),
          plannedDate,
          cbeDate,
          delayDays,
          accountabilityFunction: row.accountabilityFunction || null,
          accountabilityPerson: row.accountabilityPerson || null,
          remarks: row.remarks || null,
          status: String(row.status || 'OPEN').toUpperCase(),
          riskProbability,
          severity,
          riskScore: this.riskScore(riskProbability, severity),
          linkedDesignItemId: this.optionalInt(row.linkedDesignItemId),
          linkedWoId: this.optionalInt(row.linkedWoId),
          linkedScheduleActivityId: this.optionalInt(
            row.linkedScheduleActivityId,
          ),
          sourceType: row.sourceType || 'MANUAL',
          overrideReason: row.overrideReason || null,
          auditSnapshot: row.auditSnapshot || null,
        });
      });
    if (rows.length) await this.riskRepo.save(rows);
    return this.recalculate(projectId, reportId);
  }

  async replaceCatchupPlans(projectId: number, reportId: number, body: any) {
    await this.getMutableReport(projectId, reportId);
    await this.catchupRepo.delete({ reportId });
    const rows = (body.rows || []).map((row) =>
      this.catchupRepo.create({
        reportId,
        package: row.package || null,
        contractor: row.contractor || null,
        plannedCatchupCocCrores: Number(row.plannedCatchupCocCrores || 0),
        strategy: row.strategy || null,
        details: row.details || null,
        ownerUserId: this.optionalInt(row.ownerUserId),
        targetDate: this.optionalDate(row.targetDate),
        status: String(row.status || 'OPEN').toUpperCase(),
        sourceType: row.sourceType || 'MANUAL',
        overrideReason: row.overrideReason || null,
        auditSnapshot: row.auditSnapshot || null,
      }),
    );
    if (rows.length) await this.catchupRepo.save(rows);
    return this.getReport(projectId, reportId);
  }

  async replaceMilestones(projectId: number, reportId: number, body: any) {
    await this.getMutableReport(projectId, reportId);
    await this.milestoneRepo.delete({ reportId });
    const rows = (body.rows || [])
      .filter((row) => String(row.milestoneName || '').trim())
      .map((row) => {
        const aopDate = this.optionalDate(row.aopDate);
        const cbeDate = this.optionalDate(row.cbeDate);
        return this.milestoneRepo.create({
          reportId,
          towerName: row.towerName || null,
          milestoneName: String(row.milestoneName).trim(),
          aopDate,
          cbeDate,
          actualDate: this.optionalDate(row.actualDate),
          delayDays:
            row.delayDays !== undefined
              ? Number(row.delayDays || 0)
              : this.daysBetween(aopDate, cbeDate),
          milestoneGroup: row.milestoneGroup || null,
          sourceActivityId: this.optionalInt(row.sourceActivityId),
          sourceType: row.sourceType || 'MANUAL',
          overrideReason: row.overrideReason || null,
          auditSnapshot: row.auditSnapshot || null,
        });
      });
    if (rows.length) await this.milestoneRepo.save(rows);
    return this.recalculate(projectId, reportId);
  }

  async recalculate(projectId: number, reportId: number) {
    const report = await this.getReport(projectId, reportId);
    const risks = report.risks || [];
    const openRisks = risks.filter((r) => r.status !== 'CLOSED');
    const highRiskCount = openRisks.filter((r) => r.riskScore >= 4).length;
    const avgRisk =
      openRisks.length > 0
        ? openRisks.reduce((sum, r) => sum + Number(r.riskScore || 0), 0) /
          openRisks.length
        : 0;

    const burnByMetric = this.sumBurnByMetric(report.burnRows || []);
    const burnTarget = burnByMetric.AOP || burnByMetric.CBE || 0;
    const burnActual = burnByMetric.ACTUAL || 0;
    const burnShortfall =
      burnTarget > 0 ? Math.max(0, (burnTarget - burnActual) / burnTarget) : 0;

    const milestoneRows = report.milestones || [];
    const delayedMilestones = milestoneRows.filter(
      (m) => Number(m.delayDays || 0) > 0 && !m.actualDate,
    );
    const avgMilestoneDelay =
      delayedMilestones.length > 0
        ? delayedMilestones.reduce(
            (sum, m) => sum + Number(m.delayDays || 0),
            0,
          ) / delayedMilestones.length
        : 0;

    const leadHealthScore = this.clampScore(100 - avgRisk * 18);
    const lagHealthScore = this.clampScore(
      100 - burnShortfall * 60 - Math.min(40, avgMilestoneDelay),
    );
    const overallHealthScore = this.clampScore(
      leadHealthScore * 0.45 + lagHealthScore * 0.55,
    );

    Object.assign(report, {
      leadHealthScore,
      lagHealthScore,
      overallHealthScore,
      calculationBreakdown: {
        openRiskCount: openRisks.length,
        highRiskCount,
        averageRiskScore: Number(avgRisk.toFixed(2)),
        burnTargetCrores: burnTarget,
        burnActualCrores: burnActual,
        burnShortfallPercent: Number((burnShortfall * 100).toFixed(2)),
        delayedMilestoneCount: delayedMilestones.length,
        averageMilestoneDelayDays: Number(avgMilestoneDelay.toFixed(2)),
      },
    });
    await this.reportRepo.save(report);
    return this.getReport(projectId, reportId);
  }

  async submit(projectId: number, reportId: number, userId?: number) {
    const report = await this.getMutableReport(projectId, reportId);
    report.status = 'SUBMITTED';
    report.submittedBy = userId || null;
    report.submittedAt = new Date();
    await this.reportRepo.save(report);
    return this.recalculate(projectId, reportId);
  }

  async lock(projectId: number, reportId: number, userId?: number) {
    const report = await this.reportRepo.findOne({
      where: { id: reportId, projectId },
    });
    if (!report) throw new NotFoundException('Project health report not found');
    report.status = 'LOCKED';
    report.lockedBy = userId || null;
    report.lockedAt = new Date();
    await this.reportRepo.save(report);
    return this.getReport(projectId, reportId);
  }

  async reopen(projectId: number, reportId: number) {
    const report = await this.reportRepo.findOne({
      where: { id: reportId, projectId },
    });
    if (!report) throw new NotFoundException('Project health report not found');
    report.status = 'REOPENED';
    await this.reportRepo.save(report);
    return this.getReport(projectId, reportId);
  }

  async getConfig(projectId: number) {
    await this.ensureDefaultConfig(projectId);
    const [scoreConfig, escalationRules] = await Promise.all([
      this.scoreConfigRepo.find({
        where: [{ projectId }, { projectId: null } as any],
        order: { indicatorGroup: 'ASC', indicatorName: 'ASC' },
      }),
      this.escalationRepo.find({
        where: [{ projectId }, { projectId: null } as any],
        order: { scopeType: 'ASC', functionName: 'ASC' },
      }),
    ]);
    return { scoreConfig, escalationRules };
  }

  async updateConfig(projectId: number, body: any) {
    if (Array.isArray(body.scoreConfig)) {
      await this.scoreConfigRepo.delete({ projectId });
      await this.scoreConfigRepo.save(
        body.scoreConfig.map((row) =>
          this.scoreConfigRepo.create({
            projectId,
            indicatorGroup:
              String(row.indicatorGroup || 'LEAD').toUpperCase() === 'LAG'
                ? 'LAG'
                : 'LEAD',
            indicatorName: row.indicatorName || 'Indicator',
            weightage: Number(row.weightage || 1),
            sourceRule: row.sourceRule || null,
            isActive: row.isActive !== false,
          }),
        ),
      );
    }
    if (Array.isArray(body.escalationRules)) {
      await this.escalationRepo.delete({ projectId });
      await this.escalationRepo.save(
        body.escalationRules.map((row) =>
          this.escalationRepo.create({
            projectId,
            scopeType:
              String(row.scopeType || 'OVERALL').toUpperCase() === 'FUNCTIONAL'
                ? 'FUNCTIONAL'
                : 'OVERALL',
            functionName: row.functionName || null,
            greenRole: row.greenRole || null,
            amberRole: row.amberRole || null,
            redRole: row.redRole || null,
            greenThreshold: Number(row.greenThreshold || 80),
            amberThreshold: Number(row.amberThreshold || 60),
            redThreshold: Number(row.redThreshold || 0),
          }),
        ),
      );
    }
    return this.getConfig(projectId);
  }

  async exportXlsx(projectId: number, reportId: number) {
    const report = await this.getReport(projectId, reportId);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['SETU Project Health Report'],
        ['Reporting Month', report.reportingMonth],
        ['Project', report.projectNameSnapshot || `Project ${projectId}`],
        ['Status', report.status],
        ['Overall Health Score', report.overallHealthScore],
        ['Lead Health Score', report.leadHealthScore],
        ['Lag Health Score', report.lagHealthScore],
      ]),
      'Project Overview',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(report.burnRows || []),
      'Burn Projection',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(report.risks || []),
      'Progress Risk',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(report.catchupPlans || []),
      'Catchup Planning',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(report.milestones || []),
      'Critical Milestones',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet((await this.getConfig(projectId)).escalationRules),
      'Escalation Matrix',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['Risk Probability', 'Low < 15 days, Medium 15-29 days, High >= 30 days'],
        ['Risk Score', 'Probability x Severity matrix, 0-5'],
        ['Lead Indicators', DEFAULT_LEAD_INDICATORS.join(', ')],
        ['Lag Indicators', DEFAULT_LAG_INDICATORS.join(', ')],
      ]),
      'Info',
    );
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  exportTemplateXlsx(projectId: number) {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['SETU Project Health Report Template'],
        ['Project ID', projectId],
        ['Instructions'],
        ['1. Fill one reporting month health pack per workbook.'],
        ['2. Use yyyy-mm-dd date format where possible.'],
        ['3. Risk probability is recalculated by SETU from delay days.'],
        ['4. Severity allowed values: No Impact, Low, Medium, High.'],
        ['5. Closed/locked reports can be changed only after authorized reopen.'],
      ]),
      'Info',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        [
          'Month',
          'Metric Type',
          'Value Crores',
          'Source Type',
          'Override Reason',
        ],
        ['2026-07-01', 'AOP', 0, 'MANUAL', ''],
        ['2026-07-01', 'CBE', 0, 'MANUAL', ''],
        ['2026-07-01', 'ACTUAL', 0, 'MANUAL', ''],
      ]),
      'Burn Projection',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        [
          'Resource Type',
          'Month',
          'AOP',
          'Planned',
          'Actual',
          'Override Reason',
        ],
        ['LABOUR', '2026-07-01', 0, 0, 0, ''],
        ['STAFF', '2026-07-01', 0, 0, 0, ''],
      ]),
      'Resources',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        [
          'Sl. No.',
          'Zone',
          'Region',
          'Project',
          'Tower',
          'Task raised date',
          'Package',
          'Task Group',
          'Task Description',
          'Task Planned date',
          'Task CBE date',
          'Task Delay',
          'Task Accountability_(Name of Function)',
          'Task Accountability_(Name of Individual)',
          'Remarks',
          'Task Status_(Select from Dropdown)',
          'Risk Probability',
          'Severity of Impact',
          'Risk Score',
        ],
        [
          1,
          '',
          '',
          '',
          '',
          '2026-07-01',
          '',
          'Drawings',
          'Example delayed drawing approval',
          '2026-07-10',
          '2026-07-25',
          15,
          'Design',
          '',
          '',
          'Open',
          '',
          'Medium',
          '',
        ],
      ]),
      'Progress Risk',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        [
          'Package',
          'Contractor',
          'Planned Catch-up COC Value',
          'Catch-up Strategy',
          'Catch-up Details',
          'Owner User ID',
          'Target Date',
          'Status',
        ],
        ['', '', 0, '', '', '', '2026-07-31', 'OPEN'],
      ]),
      'Catchup Planning',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        [
          'Tower Name',
          'Milestone Name',
          'AOP Date',
          'CBE Date',
          'Actual Date',
          'Delay Days',
          'Milestone Group',
          'Source Activity ID',
        ],
        ['Overall Project', 'Launch', '', '', '', 0, 'PCP', ''],
        ['Overall Project', 'OC Receipt', '', '', '', 0, 'PCP', ''],
      ]),
      'Critical Milestones',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        [
          'Scope Type',
          'Function Name',
          'Green Role',
          'Amber Role',
          'Red Role',
          'Green Threshold',
          'Amber Threshold',
          'Red Threshold',
        ],
        ['OVERALL', '', 'Project PIC', 'Planning Head', 'ZCEO / Technical President', 80, 60, 0],
        ['FUNCTIONAL', 'Commercial / Budget', 'Project Manager', 'Commercial Head', 'CFO', 80, 60, 0],
      ]),
      'Escalation Matrix',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['Probability', 'No Impact', 'Low', 'Medium', 'High'],
        ['Low', 0, 1, 2, 3],
        ['Medium', 0, 2, 3, 4],
        ['High', 0, 3, 4, 5],
        [],
        ['Task Groups'],
        ...[
          'Contractor Appointment',
          'Contractor Performance',
          'Payment',
          'Drawings',
          'Shop Drawing',
          'Key Material Availability',
          'Finishing Palette',
          'Internal Decisions / Approvals',
          'Labour Availability',
          'Site Supervisor Availability',
          'External Ecosystem Issues',
          'Budget',
          'Procurement',
          'Tender Package',
          'Others',
        ].map((name) => [name]),
      ]),
      'Lookup',
    );
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  async exportPdf(projectId: number, reportId: number) {
    const report = await this.getReport(projectId, reportId);
    return new Promise<Buffer>((resolve) => {
      const doc = new PDFDocument({ margin: 36, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(16).text('SETU Project Health Report', { underline: true });
      doc.moveDown();
      doc.fontSize(10);
      doc.text(`Project: ${report.projectNameSnapshot || projectId}`);
      doc.text(`Reporting Month: ${report.reportingMonth}`);
      doc.text(`Status: ${report.status}`);
      doc.moveDown();
      doc.fontSize(13).text(`Overall Health: ${report.overallHealthScore}`);
      doc.fontSize(11).text(`Lead Health: ${report.leadHealthScore}`);
      doc.text(`Lag Health: ${report.lagHealthScore}`);
      doc.moveDown();
      const breakdown = report.calculationBreakdown || {};
      doc.fontSize(12).text('Key Signals');
      doc.fontSize(9);
      Object.entries(breakdown).forEach(([key, value]) =>
        doc.text(`${key}: ${value}`),
      );
      doc.moveDown();
      doc.fontSize(12).text('Top Open Risks');
      (report.risks || [])
        .filter((r) => r.status !== 'CLOSED')
        .slice(0, 10)
        .forEach((risk) => {
          doc
            .fontSize(9)
            .text(
              `${risk.riskScore}/5 - ${risk.taskGroup || 'Risk'} - ${
                risk.taskDescription
              }`,
            );
        });
      doc.end();
    });
  }

  async importXlsx(projectId: number, fileBuffer: Buffer, userId?: number) {
    const wb = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
    const reportingMonth = this.toMonthDate(new Date());
    const report = await this.createReport(
      projectId,
      { reportingMonth, cbeSubmissionMonth: reportingMonth },
      userId,
    );
    const reportId = report.id;

    const riskRows = this.sheetRows(wb, 'Progress Risk')
      .map((row) => ({
        tower: row['Tower'],
        package: row['Package'],
        taskGroup: row['Task Group'],
        taskDescription: row['Task Description'],
        raisedDate: row['Task raised date'],
        plannedDate: row['Task Planned date'],
        cbeDate: row['Task CBE date'],
        delayDays: row['Task Delay'],
        accountabilityFunction: row['Task Accountability_(Name of Function)'],
        accountabilityPerson: row['Task Accountability_(Name of Individual)'],
        remarks: row['Remarks'],
        status: row['Task Status_(Select from Dropdown)'],
        severity: row['Severity of Impact'],
        sourceType: 'IMPORTED',
      }))
      .filter((row) => row.taskDescription);
    if (riskRows.length) {
      await this.replaceRisks(projectId, reportId, { rows: riskRows });
    }

    const catchupRows = this.sheetRows(wb, 'Catchup Planning')
      .map((row) => ({
        package: row['Package'],
        contractor: row['Contractor'],
        plannedCatchupCocCrores: row['Planned Catch-up COC Value'],
        strategy: row['Catch-up Strategy'],
        details: row['Catch-up Details'],
        sourceType: 'IMPORTED',
      }))
      .filter((row) => row.package || row.contractor || row.details);
    if (catchupRows.length) {
      await this.replaceCatchupPlans(projectId, reportId, {
        rows: catchupRows,
      });
    }

    return this.recalculate(projectId, reportId);
  }

  private async getMutableReport(projectId: number, reportId: number) {
    const report = await this.reportRepo.findOne({
      where: { id: reportId, projectId },
    });
    if (!report) throw new NotFoundException('Project health report not found');
    if (report.status === 'LOCKED') {
      throw new BadRequestException('Locked health reports must be reopened first');
    }
    return report;
  }

  private async resolveProjectSnapshot(projectId: number) {
    const [eps, profile] = await Promise.all([
      this.epsRepo.findOne({ where: { id: projectId } }),
      this.projectProfileRepo.findOne({
        where: { epsNode: { id: projectId } as any },
      }),
    ]);
    return {
      projectNameSnapshot: profile?.projectName || eps?.name || null,
      zoneSnapshot: profile?.businessUnit || null,
      regionSnapshot: profile?.city || profile?.state || null,
      plannerSnapshot: profile?.planningManagerId || null,
      picSnapshot: profile?.projectManagerId || null,
    };
  }

  private async ensureDefaultConfig(projectId: number) {
    const existing = await this.scoreConfigRepo.count({
      where: { projectId },
    });
    if (!existing) {
      await this.scoreConfigRepo.save([
        ...DEFAULT_LEAD_INDICATORS.map((indicatorName) =>
          this.scoreConfigRepo.create({
            projectId,
            indicatorGroup: 'LEAD',
            indicatorName,
            weightage: 1,
            sourceRule: 'Manual or linked source risk signal',
          }),
        ),
        ...DEFAULT_LAG_INDICATORS.map((indicatorName) =>
          this.scoreConfigRepo.create({
            projectId,
            indicatorGroup: 'LAG',
            indicatorName,
            weightage: 1,
            sourceRule: 'Calculated from burn, milestone and cycle data',
          }),
        ),
      ]);
    }

    const existingEscalation = await this.escalationRepo.count({
      where: { projectId },
    });
    if (!existingEscalation) {
      await this.escalationRepo.save([
        this.escalationRepo.create({
          projectId,
          scopeType: 'OVERALL',
          greenRole: 'Project PIC',
          amberRole: 'Planning Head',
          redRole: 'ZCEO / Technical President',
        }),
        this.escalationRepo.create({
          projectId,
          scopeType: 'FUNCTIONAL',
          functionName: 'Commercial / Budget',
          greenRole: 'Project Manager',
          amberRole: 'Commercial Head',
          redRole: 'CFO',
        }),
      ]);
    }
  }

  private async seedDefaultMilestones(reportId: number) {
    const rows = DEFAULT_MILESTONES.map((milestoneName) =>
      this.milestoneRepo.create({
        reportId,
        towerName: 'Overall Project',
        milestoneName,
        milestoneGroup: 'PCP',
        sourceType: 'SYSTEM',
      }),
    );
    await this.milestoneRepo.save(rows);
  }

  private sheetRows(wb: XLSX.WorkBook, name: string) {
    const sheet = wb.Sheets[name];
    if (!sheet) return [];
    return XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
      defval: null,
      raw: false,
    });
  }

  private sortReport(report: ProjectHealthReport) {
    report.burnRows = (report.burnRows || []).sort((a, b) =>
      `${a.month}${a.metricType}`.localeCompare(`${b.month}${b.metricType}`),
    );
    report.resourceRows = (report.resourceRows || []).sort((a, b) =>
      `${a.month}${a.resourceType}`.localeCompare(`${b.month}${b.resourceType}`),
    );
    report.risks = (report.risks || []).sort(
      (a, b) => Number(b.riskScore || 0) - Number(a.riskScore || 0),
    );
    report.milestones = (report.milestones || []).sort((a, b) =>
      `${a.towerName || ''}${a.milestoneName}`.localeCompare(
        `${b.towerName || ''}${b.milestoneName}`,
      ),
    );
    return report;
  }

  private toMonthDate(value: any) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid month/date value');
    }
    date.setUTCDate(1);
    return date.toISOString().slice(0, 10);
  }

  private optionalDate(value: any) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }

  private optionalNumber(value: any) {
    return value === undefined || value === null || value === ''
      ? null
      : Number(value);
  }

  private optionalInt(value: any) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.trunc(number) : null;
  }

  private normalizeMetricType(value: any) {
    const metric = String(value || 'AOP').toUpperCase();
    return metric === 'CBE' || metric === 'ACTUAL' ? metric : 'AOP';
  }

  private normalizeSeverity(value: any): Severity {
    const severity = String(value || 'LOW')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');
    if (severity === 'NO_IMPACT' || severity === 'NO IMPACT') {
      return 'NO_IMPACT';
    }
    if (severity === 'MEDIUM') return 'MEDIUM';
    if (severity === 'HIGH') return 'HIGH';
    return 'LOW';
  }

  private probabilityFromDelay(delayDays: number): Probability {
    if (delayDays >= 30) return 'HIGH';
    if (delayDays >= 15) return 'MEDIUM';
    return 'LOW';
  }

  private riskScore(probability: Probability, severity: Severity) {
    if (severity === 'NO_IMPACT') return 0;
    const table: Record<Probability, Record<Exclude<Severity, 'NO_IMPACT'>, number>> =
      {
        LOW: { LOW: 1, MEDIUM: 2, HIGH: 3 },
        MEDIUM: { LOW: 2, MEDIUM: 3, HIGH: 4 },
        HIGH: { LOW: 3, MEDIUM: 4, HIGH: 5 },
      };
    return table[probability][severity];
  }

  private daysBetween(start: string | null, end: string | null) {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diff = endDate.getTime() - startDate.getTime();
    return Math.max(0, Math.round(diff / 86_400_000));
  }

  private sumBurnByMetric(rows: ProjectHealthBurnRow[]) {
    return rows.reduce(
      (acc, row) => {
        acc[row.metricType] += Number(row.valueCrores || 0);
        return acc;
      },
      { AOP: 0, CBE: 0, ACTUAL: 0 },
    );
  }

  private clampScore(value: number) {
    return Math.round(Math.max(0, Math.min(100, value)));
  }

  private resolveFiscalYear(month: string) {
    const date = new Date(month);
    const year = date.getUTCFullYear();
    const start = date.getUTCMonth() >= 3 ? year : year - 1;
    return `${start}-${String(start + 1).slice(-2)}`;
  }
}
