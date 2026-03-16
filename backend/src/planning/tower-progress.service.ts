import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EpsNode } from '../eps/eps.entity';
import { Activity } from '../wbs/entities/activity.entity';

@Injectable()
export class TowerProgressService {
  constructor(
    @InjectRepository(EpsNode)
    private readonly epsRepo: Repository<any>,
    @InjectRepository(Activity)
    private readonly activityRepo: Repository<any>,
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
    // 1. Get all EPS nodes for this project
    const allNodes = await this.epsRepo.find({
      where: { projectId } as any,
      order: { name: 'ASC' },
    });

    // 2. Find tower-type nodes
    let towerNodes = allNodes.filter(
      (n) => n.type?.toUpperCase() === 'TOWER',
    );
    if (towerNodes.length === 0) {
      towerNodes = allNodes.filter(
        (n) => n.type?.toUpperCase() === 'BLOCK',
      );
    }

    if (towerNodes.length === 0) {
      return { towers: [] };
    }

    // 3. Build child map for quick lookup
    const childMap = new Map<number, any[]>();
    for (const node of allNodes) {
      if (node.parentId != null) {
        if (!childMap.has(node.parentId)) childMap.set(node.parentId, []);
        childMap.get(node.parentId)!.push(node);
      }
    }

    // 4. Get today's date string for hasActiveWork check
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // 5. Build tower data
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
              floorNode,
              idx,
              projectId,
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
    floorNode: any,
    floorIndex: number,
    projectId: number,
    todayStr: string,
  ): Promise<any> {
    try {
      // Query activities linked to this EPS node
      const activities = await this.activityRepo
        .createQueryBuilder('act')
        .leftJoin('act.inspections', 'insp')
        .leftJoin('act.observations', 'obs')
        .where('act.epsNodeId = :epsNodeId', { epsNodeId: floorNode.id })
        .andWhere('act.projectId = :projectId', { projectId })
        .select([
          'act.id',
          'act.status',
          'act.actualProgress',
          'act.lastProgressDate',
          'insp.id',
          'insp.status',
          'obs.id',
          'obs.status',
        ])
        .getMany();

      let totalPct = 0;
      let completed = 0;
      let inProgress = 0;
      let pending = 0;
      let pendingRfis = 0;
      let rejectedRfis = 0;
      let hasActiveWork = false;

      for (const act of activities) {
        const pct = act.actualProgress ?? 0;
        totalPct += pct;

        const status = act.status?.toLowerCase() ?? '';
        if (status === 'approved' || pct >= 100) completed++;
        else if (status === 'pending' || status === 'in_progress') inProgress++;
        else pending++;

        if (status === 'rejected') rejectedRfis++;
        if (status === 'pending') pendingRfis++;

        const progressDate = act.lastProgressDate
          ? String(act.lastProgressDate).substring(0, 10)
          : '';
        if (progressDate === todayStr) hasActiveWork = true;
      }

      const total = activities.length;
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
      };
    }
  }

  private _floorSortKey(name: string): number {
    const lower = name.toLowerCase();
    if (lower === 'gf' || lower.startsWith('ground')) return 0;
    if (lower.includes('terrace') || lower.includes('roof')) return 9999;
    const match = name.match(/(\d+)/);
    return match ? parseInt(match[1]) : 5000;
  }
}
