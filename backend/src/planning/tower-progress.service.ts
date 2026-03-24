import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { EpsNode, EpsNodeType } from '../eps/eps.entity';
import { Activity } from '../wbs/entities/activity.entity';
import { WbsNode } from '../wbs/entities/wbs.entity';

@Injectable()
export class TowerProgressService {
  constructor(
    @InjectRepository(EpsNode)
    private readonly epsRepo: Repository<any>,
    @InjectRepository(Activity)
    private readonly activityRepo: Repository<any>,
    @InjectRepository(WbsNode)
    private readonly wbsRepo: Repository<WbsNode>,
  ) {}

  /**
   * Returns per-floor aggregated progress for all towers in a project.
   * Single query replaces N×3 parallel mobile API calls.
   *
   * Response shape:
   * {
   *   towers: [{
   *     epsNodeId, towerName,
   *     floors: [{
   *       epsNodeId, floorName, floorIndex, progressPct,
   *       totalActivities, completedActivities, pendingActivities, inProgressActivities,
   *       openQualityObs, openEhsObs, pendingRfis, rejectedRfis, hasActiveWork
   *     }]
   *   }]
   * }
   */
  async getTowerProgress(projectId: number): Promise<any> {
    // 1. Get the EPS subtree rooted at the current project node.
    const allNodes = await this.epsRepo.find({
      order: { order: 'ASC', name: 'ASC' },
    });

    const nodeById = new Map<number, any>(allNodes.map((node) => [node.id, node]));
    const projectRoot = nodeById.get(projectId);

    if (!projectRoot || projectRoot.type !== EpsNodeType.PROJECT) {
      return { towers: [] };
    }

    const childMap = new Map<number, any[]>();
    for (const node of allNodes) {
      if (node.parentId != null) {
        if (!childMap.has(node.parentId)) childMap.set(node.parentId, []);
        childMap.get(node.parentId)!.push(node);
      }
    }

    const subtreeIds = new Set<number>();
    const stack = [projectRoot.id];
    while (stack.length > 0) {
      const currentId = stack.pop()!;
      if (subtreeIds.has(currentId)) continue;
      subtreeIds.add(currentId);
      for (const child of childMap.get(currentId) || []) {
        stack.push(child.id);
      }
    }

    const projectNodes = allNodes.filter((node) => subtreeIds.has(node.id));
    const allWbsNodes = await this.wbsRepo.find({
      where: { projectId },
      select: ['id', 'parentId', 'wbsCode', 'wbsName'],
    });
    const wbsNodeById = new Map<number, WbsNode>(
      allWbsNodes.map((node) => [node.id, node]),
    );

    // 2. Find tower-type nodes
    let towerNodes = projectNodes.filter(
      (n) => n.type?.toUpperCase() === 'TOWER',
    );
    if (towerNodes.length === 0) {
      towerNodes = projectNodes.filter(
        (n) => n.type?.toUpperCase() === 'BLOCK',
      );
    }

    if (towerNodes.length === 0) {
      return { towers: [] };
    }
    // 3. Get today's date string for hasActiveWork check
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // 4. Build tower data
    const towers = await Promise.all(
      towerNodes.map(async (tower) => {
        // Get floor children
        let floorNodes = (childMap.get(tower.id) || []).filter(
          (n) =>
            n.type?.toUpperCase() === 'FLOOR' ||
            n.type?.toUpperCase() === 'LEVEL',
        );
        if (floorNodes.length === 0) {
          floorNodes = childMap.get(tower.id) || [];
        }

        // Sort floors: GF first, then by number
        floorNodes.sort((a, b) => {
          const aKey = this._floorSortKey(a.name || '');
          const bKey = this._floorSortKey(b.name || '');
          return aKey - bKey;
        });

        const floors = await Promise.all(
          floorNodes.map(async (floorNode, idx) => {
            return this._buildFloorProgress(
              projectId,
              floorNode,
              idx,
              childMap,
              wbsNodeById,
              todayStr,
            );
          }),
        );

        return {
          epsNodeId: tower.id,
          towerName: tower.name,
          floors,
        };
      }),
    );

    return { towers };
  }

  private async _buildFloorProgress(
    projectId: number,
    floorNode: any,
    floorIndex: number,
    childMap: Map<number, any[]>,
    wbsNodeById: Map<number, WbsNode>,
    todayStr: string,
  ): Promise<any> {
    try {
      const scopeIds = this._collectSubtreeIds(floorNode.id, childMap);

      // Floor activity must be resolved through the mapped BOQ / measurement EPS scope.
      // The previous projectId-in-scope check compared project ids to EPS ids,
      // which made valid floor activity progress collapse to 0% in the 3D viewer.
      const rawActivities = await this.activityRepo
        .createQueryBuilder('act')
        .innerJoin('wo_activity_plan', 'plan', 'plan.activity_id = act.id')
        .leftJoin('boq_item', 'boqItem', 'boqItem.id = plan.boq_item_id')
        .leftJoin('measurement_element', 'meas', 'meas.id = plan.measurement_id')
        .leftJoin('act.wbsNode', 'wbs')
        .where('act.projectId = :projectId', { projectId })
        .andWhere(
          new Brackets((qb) => {
            qb.where('boqItem.epsNodeId IN (:...scopeIds)', { scopeIds }).orWhere(
              'meas.epsNodeId IN (:...scopeIds)',
              { scopeIds },
            );
          }),
        )
        .select([
          'act.id AS act_id',
          'act.activityCode AS act_activityCode',
          'act.activityName AS act_activityName',
          'act.status AS act_status',
          'act.percentComplete AS act_percentComplete',
          'act.budgetedValue AS act_budgetedValue',
          'act.actualValue AS act_actualValue',
          'act.startDateActual AS act_startDateActual',
          'act.finishDateActual AS act_finishDateActual',
          'act.startDatePlanned AS act_startDatePlanned',
          'act.finishDatePlanned AS act_finishDatePlanned',
          'wbs.id AS wbs_id',
          'wbs.wbsCode AS wbs_wbsCode',
          'wbs.wbsName AS wbs_wbsName',
        ])
        .getRawMany();

      const activities = new Map<
        number,
        {
          id: number;
          activityCode: string;
          activityName: string;
          status: string;
          progressPct: number;
          budgetedValue: number;
          actualValue: number;
          startDatePlanned: string | null;
          finishDatePlanned: string | null;
          schedulePath: string[];
        }
      >();

      for (const row of rawActivities) {
        const activityId = Number(row.act_id);
        if (!Number.isFinite(activityId) || activities.has(activityId)) continue;

        const wbsCode = row.wbs_wbsCode ? String(row.wbs_wbsCode).trim() : '';
        const wbsName = row.wbs_wbsName ? String(row.wbs_wbsName).trim() : '';
        const wbsLabel =
          wbsCode && wbsName
            ? `${wbsCode} - ${wbsName}`
            : wbsName || wbsCode || '';
        const schedulePath = this._buildWbsPath(
          Number(row.wbs_id),
          wbsNodeById,
          wbsLabel,
          String(row.act_activityName || ''),
        );
        const budgetedValue = Number(row.act_budgetedValue ?? 0);
        const actualValue = Number(row.act_actualValue ?? 0);
        const progressPct = this._deriveActivityProgressPct({
          status: String(row.act_status || 'NOT_STARTED'),
          percentComplete: Number(row.act_percentComplete ?? 0),
          budgetedValue,
          actualValue,
          startDateActual: row.act_startDateActual
            ? String(row.act_startDateActual).substring(0, 10)
            : null,
          finishDateActual: row.act_finishDateActual
            ? String(row.act_finishDateActual).substring(0, 10)
            : null,
        });

        activities.set(activityId, {
          id: activityId,
          activityCode: String(row.act_activityCode || ''),
          activityName: String(row.act_activityName || ''),
          status: String(row.act_status || 'NOT_STARTED'),
          progressPct,
          budgetedValue,
          actualValue,
          startDatePlanned: row.act_startDatePlanned
            ? String(row.act_startDatePlanned).substring(0, 10)
            : null,
          finishDatePlanned: row.act_finishDatePlanned
            ? String(row.act_finishDatePlanned).substring(0, 10)
            : null,
          schedulePath,
        });
      }

      let totalPct = 0;
      let completed = 0;
      let inProgress = 0;
      let pending = 0;
      let pendingRfis = 0;
      let rejectedRfis = 0;
      let hasActiveWork = false;
      const floorActivities: Array<{
        id: number;
        activityCode: string;
        activityName: string;
        status: string;
        progressPct: number;
        budgetedValue: number;
        actualValue: number;
        startDatePlanned: string | null;
        finishDatePlanned: string | null;
        schedulePath: string[];
      }> = [];

      for (const act of activities.values()) {
        const pct = Number(act.progressPct ?? 0);
        totalPct += pct;

        const status = act.status?.toLowerCase() ?? '';
        if (status === 'approved' || status === 'completed' || pct >= 100) completed++;
        else if (status === 'pending' || status === 'in_progress' || status === 'in progress')
          inProgress++;
        else pending++;

        if (status === 'rejected') rejectedRfis++;
        if (status === 'pending') pendingRfis++;
        if (status === 'in_progress' || pct > 0) hasActiveWork = true;

        floorActivities.push({
          id: act.id,
          activityCode: act.activityCode,
          activityName: act.activityName,
          status: act.status || 'NOT_STARTED',
          progressPct: Math.min(100, Math.max(0, pct)),
          budgetedValue: act.budgetedValue,
          actualValue: act.actualValue,
          startDatePlanned: act.startDatePlanned,
          finishDatePlanned: act.finishDatePlanned,
          schedulePath: act.schedulePath,
        });
      }

      const total = activities.size;
      const progressPct =
        total > 0
          ? Math.min(100, Math.max(0, totalPct / total))
          : (floorNode.progress ?? 0);

      // Count open observations (quality and EHS) for this floor
      // These would come from site observation tables — simplified here
      const openQualityObs = 0; // TODO: join quality_site_observations
      const openEhsObs = 0; // TODO: join ehs_site_observations

      return {
        epsNodeId: floorNode.id,
        floorName: floorNode.name,
        floorIndex,
        progressPct: Math.round(progressPct * 10) / 10,
        totalActivities: total,
        completedActivities: completed,
        pendingActivities: pending,
        inProgressActivities: inProgress,
        openQualityObs,
        openEhsObs,
        pendingRfis,
        rejectedRfis,
        hasActiveWork,
        activities: floorActivities,
      };
    } catch {
      return {
        epsNodeId: floorNode.id,
        floorName: floorNode.name,
        floorIndex,
        progressPct: floorNode.progress ?? 0,
        totalActivities: 0,
        completedActivities: 0,
        pendingActivities: 0,
        inProgressActivities: 0,
        openQualityObs: 0,
        openEhsObs: 0,
        pendingRfis: 0,
        rejectedRfis: 0,
        hasActiveWork: false,
        activities: [],
      };
    }
  }

  private _collectSubtreeIds(
    rootId: number,
    childMap: Map<number, any[]>,
  ): number[] {
    const ids: number[] = [];
    const stack = [rootId];

    while (stack.length > 0) {
      const currentId = stack.pop()!;
      ids.push(currentId);
      for (const child of childMap.get(currentId) || []) {
        stack.push(child.id);
      }
    }

    return ids;
  }

  private _buildWbsPath(
    wbsNodeId: number,
    wbsNodeById: Map<number, WbsNode>,
    currentLabel: string,
    activityName: string,
  ): string[] {
    const parts: string[] = [];
    let current = Number.isFinite(wbsNodeId) ? wbsNodeById.get(wbsNodeId) || null : null;

    while (current) {
      const label =
        current.wbsCode && current.wbsName
          ? `${current.wbsCode} - ${current.wbsName}`
          : current.wbsName || current.wbsCode || '';
      if (label) parts.push(label);
      current =
        current.parentId != null ? wbsNodeById.get(current.parentId) || null : null;
    }

    const normalized = parts.reverse();
    if (normalized.length === 0 && currentLabel) normalized.push(currentLabel);
    if (activityName) normalized.push(activityName);
    return normalized;
  }

  private _deriveActivityProgressPct(input: {
    status: string;
    percentComplete: number;
    budgetedValue: number;
    actualValue: number;
    startDateActual: string | null;
    finishDateActual: string | null;
  }): number {
    const status = (input.status || '').trim().toLowerCase();
    const valuePct =
      input.budgetedValue > 0
        ? (input.actualValue / input.budgetedValue) * 100
        : Number.NaN;

    if (Number.isFinite(valuePct) && valuePct > 0) {
      return Math.min(100, Math.max(0, valuePct));
    }

    if (Number.isFinite(input.percentComplete) && input.percentComplete > 0) {
      return Math.min(100, Math.max(0, input.percentComplete));
    }

    if (
      status === 'completed' ||
      status === 'approved' ||
      status === 'closed' ||
      Boolean(input.finishDateActual)
    ) {
      return 100;
    }

    if (status === 'in_progress' || status === 'in progress' || Boolean(input.startDateActual)) {
      return 5;
    }

    return 0;
  }

  private _floorSortKey(name: string): number {
    const lower = name.toLowerCase();
    if (lower === 'gf' || lower.startsWith('ground')) return 0;
    if (lower.includes('terrace') || lower.includes('roof')) return 9999;
    const match = name.match(/(\d+)/);
    return match ? parseInt(match[1]) : 5000;
  }
}
