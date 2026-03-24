import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Pulls structured SETU data for use in AI insight prompts.
 *
 * Each data-source key maps to a named fetcher method.  The InsightTemplate
 * `dataSources` array specifies which keys are needed; the aggregator runs
 * them in parallel and returns a flat map of key → data.
 */
@Injectable()
export class InsightDataAggregatorService {
  private readonly logger = new Logger(InsightDataAggregatorService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  async aggregate(
    dataSources: { key: string; filters?: Record<string, unknown> }[],
    projectId: number | null,
    parameters?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {};

    await Promise.all(
      dataSources.map(async (ds) => {
        try {
          const filters = { ...(ds.filters ?? {}), ...(parameters ?? {}) };
          results[ds.key] = await this.fetch(ds.key, projectId, filters);
        } catch (err) {
          this.logger.error(`Failed to fetch data source "${ds.key}": ${err}`);
          results[ds.key] = { error: `Data unavailable: ${err}` };
        }
      }),
    );

    return results;
  }

  private async fetch(
    key: string,
    projectId: number | null,
    filters: Record<string, unknown>,
  ): Promise<unknown> {
    switch (key) {
      case 'progress':            return this.fetchProgress(projectId, filters);
      case 'activities':          return this.fetchActivities(projectId);
      case 'quality_ncr':         return this.fetchQualityNcr(projectId, filters);
      case 'quality_inspections': return this.fetchQualityInspections(projectId, filters);
      case 'ehs_observations':    return this.fetchEhsObservations(projectId, filters);
      case 'ehs_incidents':       return this.fetchEhsIncidents(projectId, filters);
      case 'boq_items':           return this.fetchBoqItems(projectId);
      default:
        this.logger.warn(`Unknown data source key: "${key}"`);
        return null;
    }
  }

  // ── Progress (quantity_progress_record) ────────────────────────────────────

  private async fetchProgress(
    projectId: number | null,
    filters: Record<string, unknown>,
  ): Promise<unknown> {
    const days = Number(filters['days'] ?? 30);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const rows = await this.db.query(
      `SELECT
         qpr."measureDate"  AS "entryDate",
         bi."boqCode"       AS "activityCode",
         bi.description     AS "activityName",
         qpr."measuredQty"  AS quantity,
         qpr.status         AS "approvalStatus",
         bi.qty             AS "totalPlannedQty",
         qpr."totalToDate"  AS "totalApprovedQty"
       FROM quantity_progress_record qpr
       JOIN boq_item bi ON bi.id = qpr."boqItemId"
       WHERE ($1::int IS NULL OR qpr."projectId" = $1)
         AND qpr."measureDate" >= $2
       ORDER BY qpr."measureDate" DESC
       LIMIT 300`,
      [projectId, cutoff.toISOString().split('T')[0]],
    );

    return {
      periodDays: days,
      recordCount: rows.length,
      entries: rows,
    };
  }

  // ── Activities ────────────────────────────────────────────────────────────

  private async fetchActivities(projectId: number | null): Promise<unknown> {
    const rows = await this.db.query(
      `SELECT
         a.id,
         a."activityCode",
         a."activityName"       AS name,
         a.status,
         a."percentComplete",
         a."startDatePlanned"   AS "plannedStart",
         a."finishDatePlanned"  AS "plannedFinish",
         a."startDateActual"    AS "actualStart",
         a."finishDateActual"   AS "actualFinish",
         w.wbs_code             AS "wbsCode",
         w.wbs_name             AS "wbsName"
       FROM activity a
       LEFT JOIN wbs_node w ON w.id = a.wbs_node_id
       WHERE ($1::int IS NULL OR a."projectId" = $1)
       ORDER BY a."startDatePlanned"
       LIMIT 500`,
      [projectId],
    );

    const total = rows.length;
    const completed = rows.filter((r: { status: string }) => r.status === 'COMPLETED').length;
    const inProgress = rows.filter((r: { status: string }) => r.status === 'IN_PROGRESS').length;

    return { total, completed, inProgress, notStarted: total - completed - inProgress, activities: rows };
  }

  // ── Quality NCR (site_observations of type QUALITY) ───────────────────────

  private async fetchQualityNcr(
    projectId: number | null,
    filters: Record<string, unknown>,
  ): Promise<unknown> {
    const days = Number(filters['days'] ?? 90);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const rows = await this.db.query(
      `SELECT
         so.id, so.description, so.severity, so.status,
         so."createdAt", so."closedAt",
         so."raisedById"
       FROM site_observations so
       WHERE so.type = 'QUALITY'
         AND ($1::int IS NULL OR so."projectId" = $1)
         AND so."createdAt" >= $2
       ORDER BY so."createdAt" DESC
       LIMIT 200`,
      [projectId, cutoff.toISOString()],
    ).catch(async () => {
      // table may not have 'type' column — return all site observations
      return this.db.query(
        `SELECT id, description, severity, status, "createdAt", "closedAt"
         FROM site_observations
         WHERE ($1::int IS NULL OR "projectId" = $1)
           AND "createdAt" >= $2
         ORDER BY "createdAt" DESC LIMIT 200`,
        [projectId, cutoff.toISOString()],
      );
    });

    const open   = rows.filter((r: { status: string }) => r.status === 'OPEN').length;
    const closed = rows.filter((r: { status: string }) => r.status === 'CLOSED').length;
    return { periodDays: days, total: rows.length, open, closed, ncrs: rows };
  }

  // ── Quality Inspections ───────────────────────────────────────────────────

  private async fetchQualityInspections(
    projectId: number | null,
    filters: Record<string, unknown>,
  ): Promise<unknown> {
    const days = Number(filters['days'] ?? 90);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const rows = await this.db.query(
      `SELECT
         qi.id, qi.status,
         qi."createdAt", qi."inspectionDate",
         a."activityCode", a."activityName" AS "activityName"
       FROM quality_inspections qi
       LEFT JOIN activity a ON a.id = qi."activityId"
       WHERE ($1::int IS NULL OR qi."projectId" = $1)
         AND qi."createdAt" >= $2
       ORDER BY qi."createdAt" DESC
       LIMIT 300`,
      [projectId, cutoff.toISOString()],
    );

    const approved = rows.filter((r: { status: string }) => r.status === 'APPROVED').length;
    const pending  = rows.filter((r: { status: string }) => ['PENDING', 'STAGE_APPROVED'].includes(r.status)).length;

    return { periodDays: days, total: rows.length, approved, pending, inspections: rows };
  }

  // ── EHS Observations ──────────────────────────────────────────────────────

  private async fetchEhsObservations(
    projectId: number | null,
    filters: Record<string, unknown>,
  ): Promise<unknown> {
    const days = Number(filters['days'] ?? 90);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const rows = await this.db.query(
      `SELECT
         eo.id, eo.description, eo.severity,
         eo.status, eo."createdAt", eo.category
       FROM ehs_observations eo
       WHERE ($1::int IS NULL OR eo."projectId" = $1)
         AND eo."createdAt" >= $2
       ORDER BY eo."createdAt" DESC
       LIMIT 300`,
      [projectId, cutoff.toISOString()],
    ).catch(async () => {
      return this.db.query(
        `SELECT id, description, severity, status, "createdAt"
         FROM ehs_observations
         WHERE ($1::int IS NULL OR "projectId" = $1)
           AND "createdAt" >= $2
         ORDER BY "createdAt" DESC LIMIT 300`,
        [projectId, cutoff.toISOString()],
      );
    });

    const bySeverity = rows.reduce(
      (acc: Record<string, number>, r: { severity: string }) => {
        acc[r.severity] = (acc[r.severity] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return { periodDays: days, total: rows.length, bySeverity, observations: rows };
  }

  // ── EHS Incidents ─────────────────────────────────────────────────────────

  private async fetchEhsIncidents(
    projectId: number | null,
    filters: Record<string, unknown>,
  ): Promise<unknown> {
    const days = Number(filters['days'] ?? 180);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const rows = await this.db.query(
      `SELECT id, title, "incidentType", severity, status, "incidentDate", "createdAt"
       FROM ehs_incidents
       WHERE ($1::int IS NULL OR "projectId" = $1)
         AND "incidentDate" >= $2
       ORDER BY "incidentDate" DESC
       LIMIT 100`,
      [projectId, cutoff.toISOString().split('T')[0]],
    ).catch(async () => {
      return this.db.query(
        `SELECT id, severity, status, "createdAt"
         FROM ehs_incidents
         WHERE ($1::int IS NULL OR "projectId" = $1)
           AND "createdAt" >= $2
         ORDER BY "createdAt" DESC LIMIT 100`,
        [projectId, cutoff.toISOString()],
      );
    });

    return { periodDays: days, total: rows.length, incidents: rows };
  }

  // ── BOQ Items ─────────────────────────────────────────────────────────────

  private async fetchBoqItems(projectId: number | null): Promise<unknown> {
    const rows = await this.db.query(
      `SELECT
         bi.id, bi."boqCode", bi.description,
         bi.uom, bi.qty, bi.rate, bi.amount,
         bi."consumedQty"
       FROM boq_item bi
       WHERE ($1::int IS NULL OR bi."projectId" = $1)
       ORDER BY bi."boqCode"
       LIMIT 500`,
      [projectId],
    );

    const totalBudget = rows.reduce(
      (s: number, r: { amount: string | number }) => s + Number(r.amount ?? 0), 0,
    );

    return { totalBudget, itemCount: rows.length, items: rows };
  }
}
