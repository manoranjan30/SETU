import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { MicroScheduleActivity } from '../micro-schedule/entities/micro-schedule-activity.entity';
import { MicroDailyLog } from '../micro-schedule/entities/micro-daily-log.entity';
import { MicroQuantityLedger } from '../micro-schedule/entities/micro-quantity-ledger.entity';
import { MeasurementElement } from '../boq/entities/measurement-element.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';
import { Activity } from '../wbs/entities/activity.entity';
import { WbsNode } from '../wbs/entities/wbs.entity';
import { EpsNode } from '../eps/eps.entity';
import { MicroLedgerService } from '../micro-schedule/micro-ledger.service';
import { WorkOrderItem } from '../workdoc/entities/work-order-item.entity';
import { WoActivityPlan } from '../planning/entities/wo-activity-plan.entity';
import {
  ExecutionProgressEntry,
  ExecutionProgressEntryStatus,
} from './entities/execution-progress-entry.entity';

export interface ExecutionBreakdownItem {
  type: 'MICRO' | 'BALANCE';
  id: number | null;
  name: string;
  boqSubItemId?: number | null;
  microActivityId?: number | null;
  microActivityName?: string | null;
  microActivityDescription?: string | null;
  workOrderItemDescription?: string | null;
  workOrderNumber?: string | null;
  wbsPath?: string | null;
  wbsParentName?: string | null;
  wbsGrandparentName?: string | null;
  displayLabel?: string | null;
  subtitle?: string | null;
  allocatedQty: number;
  executedQty: number;
  balanceQty: number;
}

export interface ExecutionBreakdown {
  activityId: number;
  activity: Activity;
  epsNodeId: number;
  vendorBreakdown: {
    vendorId: number | null;
    vendorName: string;
    vendorCode: string | null;
    workOrderNumber: string | null;
    boqBreakdown: {
    boqItem: BoqItem;
    boqSubItemId?: number | null;
    workOrderItemId: number | null;
    planId: number | null;
    workOrderItemDescription?: string | null;
    scope: {
      total: number;
      allocated: number;
      balance: number;
      };
      items: ExecutionBreakdownItem[];
    }[];
  }[];
}

@Injectable()
export class ExecutionBreakdownService {
  private readonly logger = new Logger(ExecutionBreakdownService.name);

  constructor(
    @InjectRepository(MicroScheduleActivity)
    private readonly microActivityRepo: Repository<MicroScheduleActivity>,
    @InjectRepository(MicroDailyLog)
    private readonly dailyLogRepo: Repository<MicroDailyLog>,
    @InjectRepository(MicroQuantityLedger)
    private readonly ledgerRepo: Repository<MicroQuantityLedger>,
    @InjectRepository(MeasurementElement)
    private readonly measurementRepo: Repository<MeasurementElement>,
    @InjectRepository(ExecutionProgressEntry)
    private readonly executionEntryRepo: Repository<ExecutionProgressEntry>,
    @InjectRepository(Activity)
    private readonly activityRepo: Repository<Activity>,
    @InjectRepository(WbsNode)
    private readonly wbsNodeRepo: Repository<WbsNode>,
    @InjectRepository(BoqItem)
    private readonly boqRepo: Repository<BoqItem>,
    @InjectRepository(EpsNode)
    private readonly epsNodeRepo: Repository<EpsNode>,
    @InjectRepository(WorkOrderItem)
    private readonly workOrderItemRepo: Repository<WorkOrderItem>,
    @InjectRepository(WoActivityPlan)
    private readonly planRepo: Repository<WoActivityPlan>,
    private readonly ledgerService: MicroLedgerService,
  ) {}

  /**
   * Returns the given EPS node ID plus all descendant node IDs.
   * Allows the breakdown to find micro activities created at any sub-node
   * (e.g., unit level) when the caller is navigating at a parent level
   * (e.g., floor level).
   */
  private async getNodeAndDescendantIds(epsNodeId: number): Promise<number[]> {
    const all = await this.epsNodeRepo.find({ select: ['id', 'parentId'] });
    const ids: number[] = [epsNodeId];
    const queue = [epsNodeId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const node of all) {
        if (node.parentId === current) {
          ids.push(node.id);
          queue.push(node.id);
        }
      }
    }
    return ids;
  }

  private async resolveActivityScopeIds(activityId: number): Promise<number[]> {
    const ids: number[] = [];
    let currentId: number | null = Number(activityId);

    while (currentId) {
      const activity = await this.activityRepo.findOne({
        where: { id: currentId },
        select: ['id', 'masterActivityId'],
      });
      if (!activity) break;
      ids.push(Number(activity.id));
      currentId = activity.masterActivityId ? Number(activity.masterActivityId) : null;
    }

    return [...new Set(ids)];
  }

  private async buildWbsContext(activity: Activity): Promise<{
    parentName: string | null;
    grandparentName: string | null;
    path: string | null;
  }> {
    const wbsNodeId = activity?.wbsNode?.id;
    if (!wbsNodeId) {
      return {
        parentName: null,
        grandparentName: null,
        path: null,
      };
    }

    const pathNames: string[] = [];
    let parentName: string | null = null;
    let grandparentName: string | null = null;
    let currentId: number | null = Number(wbsNodeId);
    let depth = 0;

    while (currentId) {
      const node = await this.wbsNodeRepo.findOne({
        where: { id: currentId },
        select: ['id', 'parentId', 'wbsName'],
      });
      if (!node) break;
      pathNames.unshift(node.wbsName);
      if (depth === 1) parentName = node.wbsName;
      if (depth === 2) grandparentName = node.wbsName;
      currentId = node.parentId ? Number(node.parentId) : null;
      depth += 1;
    }

    return {
      parentName,
      grandparentName,
      path: pathNames.length > 0 ? pathNames.join(' > ') : null,
    };
  }

  private async resolveEpsScopeIds(epsNodeId: number): Promise<number[]> {
    const ids: number[] = [];
    let currentId: number | null = Number(epsNodeId);

    while (currentId) {
      const node = await this.epsNodeRepo.findOne({
        where: { id: currentId },
        select: ['id', 'parentId'],
      });
      if (!node) break;
      ids.push(Number(node.id));
      currentId = node.parentId ? Number(node.parentId) : null;
    }

    return [...new Set(ids)];
  }

  /**
   * Get unified execution breakdown for an activity at a specific location
   * Combines Micro Activities + Balance (Direct Execution) into single view
   * Grouped by Vendor -> BOQ Item
   */
  async getBreakdown(
    activityId: number,
    epsNodeId: number,
  ): Promise<ExecutionBreakdown> {
    this.logger.log(
      `[ExecutionBreakdown] Fetching for Activity ${activityId} @ EPS ${epsNodeId}`,
    );

    // 1. Fetch Activity Details
    const activity = await this.activityRepo.findOne({
      where: { id: activityId },
      relations: ['wbsNode'],
    });

    if (!activity) {
      throw new Error(`Activity ${activityId} not found`);
    }

    const activityScopeIds = await this.resolveActivityScopeIds(activityId);
    const epsScopeIds = await this.resolveEpsScopeIds(epsNodeId);
    const wbsContext = await this.buildWbsContext(activity);

    const candidatePlans = await this.planRepo
      .createQueryBuilder('plan')
      .leftJoinAndSelect('plan.activity', 'activity')
      .leftJoinAndSelect('plan.workOrderItem', 'workOrderItem')
      .leftJoinAndSelect('workOrderItem.workOrder', 'workOrder')
      .leftJoinAndSelect('workOrder.vendor', 'vendor')
      .leftJoinAndSelect('plan.boqItem', 'boqItem')
      .where('plan.activityId IN (:...activityScopeIds)', { activityScopeIds })
      .andWhere(
        '(plan.executionEpsNodeId IN (:...epsScopeIds) OR plan.executionEpsNodeId IS NULL)',
        { epsScopeIds, epsNodeId },
      )
      .orderBy(
        'CASE WHEN plan.executionEpsNodeId = :epsNodeId THEN 0 WHEN plan.executionEpsNodeId IS NULL THEN 2 ELSE 1 END',
        'ASC',
      )
      .addOrderBy('plan.id', 'ASC')
      .getMany();

    const plans = this.preferFloorSpecificPlans(
      this.preferClosestActivityPlans(candidatePlans, activityScopeIds),
      epsNodeId,
    );

    if (plans.length === 0) {
      return {
        activityId,
        activity,
        epsNodeId,
        vendorBreakdown: [],
      };
    }

    // 3. Resolve EPS node subtree
    const nodeIds = await this.getNodeAndDescendantIds(epsNodeId);

    // 4. Build Vendor-grouped structure
    const vendorMap = new Map<number | string, any>();

    for (const plan of plans) {
      const workOrderItem =
        plan.workOrderItem ||
        (plan.workOrderItemId
          ? await this.workOrderItemRepo.findOne({
              where: { id: plan.workOrderItemId },
            })
          : null);
      if (!workOrderItem) {
        continue;
      }

      const boqItem =
        plan.boqItem ||
        (plan.boqItemId
          ? await this.boqRepo.findOne({ where: { id: plan.boqItemId } })
          : null);
      if (!boqItem) {
        continue;
      }

      const boqSubItemId = plan.boqSubItemId || workOrderItem.boqSubItemId || null;
      const workOrder = workOrderItem.workOrder || null;
      const vendor = workOrder?.vendor || null;
      const vId = plan.vendorId || vendor?.id || 'DIRECT';
      const vName = vendor?.name || 'Direct Execution (No Vendor)';
      const vCode = vendor?.vendorCode || null;

      if (!vendorMap.has(vId)) {
        vendorMap.set(vId, {
          vendorId: typeof vId === 'number' ? vId : null,
          vendorName: vName,
          vendorCode: vCode,
          workOrderNumber: workOrder?.woNumber || null,
          boqBreakdown: [],
        });
      }
      const vendorNode = vendorMap.get(vId);

      // 4a. Fetch Micro Activities for this Ledger (linked via workOrderItemId if exists, else boqItem)
      const candidateMicroActivities = await this.microActivityRepo.find({
        where: {
          microSchedule: {
            parentActivityId: In(activityScopeIds),
          },
          deletedAt: IsNull(),
          workOrderItemId: plan.workOrderItemId || undefined,
          boqItemId: !plan.workOrderItemId ? plan.boqItemId : undefined,
        },
        order: {
          plannedStart: 'ASC',
          name: 'ASC',
        },
      });
      const scopedMicroActivities = this.preferFloorScopedMicroActivities(
        this.preferClosestMicroActivities(candidateMicroActivities, activityScopeIds),
        nodeIds,
        epsNodeId,
      );
      const microActivities = scopedMicroActivities;

      const items: ExecutionBreakdownItem[] = [];
      let totalMicroAllocatedQty = 0;

      for (const ma of microActivities) {
        const executedResult = await this.executionEntryRepo
          .createQueryBuilder('entry')
          .select('COALESCE(SUM(entry.enteredQty), 0)', 'total')
          .where('entry.microActivityId = :microActivityId', {
            microActivityId: ma.id,
          })
          .andWhere('entry.status != :rejected', {
            rejected: ExecutionProgressEntryStatus.REJECTED,
          })
          .getRawOne<{ total: string }>();

        const executedQty = Number(executedResult?.total || 0);
        totalMicroAllocatedQty += Number(ma.allocatedQty || 0);

        items.push({
          type: 'MICRO',
          id: ma.id,
          name: ma.name,
          boqSubItemId,
          microActivityId: ma.id,
          microActivityName: ma.name,
          microActivityDescription: ma.description || null,
          workOrderItemDescription: workOrderItem.description || null,
          workOrderNumber: workOrder?.woNumber || null,
          wbsPath: wbsContext.path,
          wbsParentName: wbsContext.parentName,
          wbsGrandparentName: wbsContext.grandparentName,
          displayLabel: [
            ma.name,
            workOrderItem.description || null,
            [wbsContext.grandparentName, wbsContext.parentName]
              .filter(Boolean)
              .join(' > ') || null,
          ]
            .filter(Boolean)
            .join(' | '),
          subtitle: [
            workOrderItem.description || null,
            [wbsContext.grandparentName, wbsContext.parentName]
              .filter(Boolean)
              .join(' > ') || null,
          ]
            .filter(Boolean)
            .join(' | '),
          allocatedQty: Number(ma.allocatedQty),
          executedQty: Number(executedQty),
          balanceQty: Math.max(
            0,
            Number(ma.allocatedQty) - Number(executedQty),
          ),
        });
      }

      // 4b. Direct Balance (if applicable)
      const directExecutedQty = await this.getDirectExecutionQty(
        plan.id,
        epsNodeId,
      );

      const totalPlanQty = Number(plan.plannedQuantity || 0);
      const balanceQty = Math.max(0, totalPlanQty - totalMicroAllocatedQty);
      if (balanceQty > 0 || directExecutedQty > 0) {
        items.push({
          type: 'BALANCE',
          id: null,
          name: 'Unallocated Qty Balance',
          boqSubItemId,
          microActivityId: null,
          microActivityName: null,
          microActivityDescription: null,
          workOrderItemDescription: workOrderItem.description || null,
          workOrderNumber: workOrder?.woNumber || null,
          wbsPath: wbsContext.path,
          wbsParentName: wbsContext.parentName,
          wbsGrandparentName: wbsContext.grandparentName,
          displayLabel: 'Unallocated Qty Balance',
          subtitle: workOrderItem.description || null,
          allocatedQty: balanceQty,
          executedQty: Number(directExecutedQty),
          balanceQty: Math.max(0, balanceQty - Number(directExecutedQty)),
        });
      }

      vendorNode.boqBreakdown.push({
        boqItem,
        boqSubItemId,
        workOrderItemId: plan.workOrderItemId,
        planId: plan?.id ?? null,
        workOrderItemDescription: workOrderItem.description || null,
        scope: {
          total: totalPlanQty,
          allocated: totalMicroAllocatedQty,
          balance: balanceQty,
        },
        items,
      });
    }

    return {
      activityId,
      activity,
      epsNodeId,
      vendorBreakdown: Array.from(vendorMap.values()),
    };
  }

  /**
   * Get vendor summary list for a given activity
   */
  async getVendorSummary(activityId: number) {
    return this.getVendorSummaryForFloor(activityId, null);
  }

  async getVendorSummaryForFloor(activityId: number, epsNodeId: number | null) {
    const activityScopeIds = await this.resolveActivityScopeIds(activityId);
    const epsScopeIds = epsNodeId
      ? await this.resolveEpsScopeIds(epsNodeId)
      : [];

    const candidatePlans = await this.planRepo
      .createQueryBuilder('plan')
      .leftJoinAndSelect('plan.workOrderItem', 'workOrderItem')
      .leftJoinAndSelect('workOrderItem.workOrder', 'workOrder')
      .leftJoinAndSelect('workOrder.vendor', 'vendor')
      .where('plan.activityId IN (:...activityScopeIds)', { activityScopeIds })
      .andWhere(
        epsNodeId
          ? '(plan.executionEpsNodeId IN (:...epsScopeIds) OR plan.executionEpsNodeId IS NULL)'
          : '1=1',
        epsNodeId ? { epsScopeIds, epsNodeId } : {},
      )
      .orderBy(
        epsNodeId
          ? 'CASE WHEN plan.executionEpsNodeId = :epsNodeId THEN 0 WHEN plan.executionEpsNodeId IS NULL THEN 2 ELSE 1 END'
          : 'plan.id',
        'ASC',
      )
      .addOrderBy('plan.id', 'ASC')
      .getMany();

    const scopedPlans = this.preferClosestActivityPlans(
      candidatePlans,
      activityScopeIds,
    );
    const plans = epsNodeId
      ? this.preferFloorSpecificPlans(scopedPlans, epsNodeId)
      : scopedPlans;

    const vendorMap = new Map<number | string, any>();
    for (const plan of plans) {
      const workOrderItem = plan.workOrderItem;
      const workOrder = workOrderItem?.workOrder;
      const vendor = workOrder?.vendor;
      const vId = plan.vendorId || vendor?.id || 'DIRECT';
      if (!vendorMap.has(vId)) {
        vendorMap.set(vId, {
          vendorId: typeof vId === 'number' ? vId : null,
          vendorName: vendor?.name || 'Direct Execution (No Vendor)',
          vendorCode: vendor?.vendorCode || null,
          workOrderNumber: workOrder?.woNumber || null,
          boqItemCount: 0,
          totalAllocatedQty: 0,
        });
      }
      const v = vendorMap.get(vId);
      v.boqItemCount++;
      v.totalAllocatedQty += Number(plan.plannedQuantity || 0);
    }

    return {
      activityId,
      vendors: Array.from(vendorMap.values()),
      hasVendors: vendorMap.size > 0,
    };
  }

  /**
   * Get executed quantity for "Direct Execution" (progress not linked to Micro Activity)
   */
  private async getDirectExecutionQty(
    woActivityPlanId: number,
    epsNodeId: number,
  ): Promise<number> {
    const qb = this.executionEntryRepo
      .createQueryBuilder('entry')
      .select('COALESCE(SUM(entry.enteredQty), 0)', 'total')
      .where('entry.woActivityPlanId = :woActivityPlanId', { woActivityPlanId })
      .andWhere('entry.microActivityId IS NULL')
      .andWhere('entry.status != :rejected', {
        rejected: ExecutionProgressEntryStatus.REJECTED,
      });

    const result = await qb.getRawOne<{ total: string }>();
    return Math.max(0, Number(result?.total || 0));
  }

  /**
   * Check if an activity has any micro schedule
   */
  async hasMicroSchedule(activityId: number): Promise<boolean> {
    const activityScopeIds = await this.resolveActivityScopeIds(activityId);
    const count = await this.microActivityRepo.count({
      where: {
        microSchedule: {
          parentActivityId: In(activityScopeIds),
        },
      },
    });
    return count > 0;
  }

  private preferFloorSpecificPlans(
    candidatePlans: WoActivityPlan[],
    epsNodeId: number,
  ): WoActivityPlan[] {
    const preferred = new Map<number, WoActivityPlan>();

    for (const plan of candidatePlans) {
      const key = Number(plan.workOrderItemId || 0);
      const existing = preferred.get(key);
      if (!existing) {
        preferred.set(key, plan);
        continue;
      }

      const existingExact = Number(existing.executionEpsNodeId || 0) === Number(epsNodeId);
      const currentExact = Number(plan.executionEpsNodeId || 0) === Number(epsNodeId);
      if (!existingExact && currentExact) {
        preferred.set(key, plan);
      }
    }

    return Array.from(preferred.values());
  }

  private preferClosestActivityPlans(
    candidatePlans: WoActivityPlan[],
    activityScopeIds: number[],
  ): WoActivityPlan[] {
    for (const activityScopeId of activityScopeIds) {
      const matched = candidatePlans.filter(
        (plan) => Number(plan.activityId) === Number(activityScopeId),
      );
      if (matched.length > 0) {
        return matched;
      }
    }

    return candidatePlans;
  }

  private preferClosestMicroActivities(
    microActivities: MicroScheduleActivity[],
    activityScopeIds: number[],
  ): MicroScheduleActivity[] {
    for (const activityScopeId of activityScopeIds) {
      const matched = microActivities.filter(
        (activity) => Number(activity.parentActivityId) === Number(activityScopeId),
      );
      if (matched.length > 0) {
        return matched;
      }
    }

    return microActivities;
  }

  private preferFloorScopedMicroActivities(
    microActivities: MicroScheduleActivity[],
    nodeIds: number[],
    epsNodeId: number,
  ): MicroScheduleActivity[] {
    const exactMatches = microActivities.filter(
      (activity) => Number(activity.epsNodeId) === Number(epsNodeId),
    );
    if (exactMatches.length > 0) {
      return exactMatches;
    }

    const subtreeMatches = microActivities.filter((activity) =>
      nodeIds.includes(Number(activity.epsNodeId)),
    );
    if (subtreeMatches.length > 0) {
      return subtreeMatches;
    }

    return microActivities;
  }
}
