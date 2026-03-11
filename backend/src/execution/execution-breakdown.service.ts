import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { MicroScheduleActivity } from '../micro-schedule/entities/micro-schedule-activity.entity';
import { MicroDailyLog } from '../micro-schedule/entities/micro-daily-log.entity';
import { MicroQuantityLedger } from '../micro-schedule/entities/micro-quantity-ledger.entity';
import { MeasurementElement } from '../boq/entities/measurement-element.entity';
import { MeasurementProgress } from '../boq/entities/measurement-progress.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';
import { Activity } from '../wbs/entities/activity.entity';
import { EpsNode } from '../eps/eps.entity';
import { MicroLedgerService } from '../micro-schedule/micro-ledger.service';

export interface ExecutionBreakdownItem {
  type: 'MICRO' | 'BALANCE';
  id: number | null;
  name: string;
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
      workOrderItemId: number | null;
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
    @InjectRepository(MeasurementProgress)
    private readonly progressRepo: Repository<MeasurementProgress>,
    @InjectRepository(Activity)
    private readonly activityRepo: Repository<Activity>,
    @InjectRepository(BoqItem)
    private readonly boqRepo: Repository<BoqItem>,
    @InjectRepository(EpsNode)
    private readonly epsNodeRepo: Repository<EpsNode>,
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

    // 2. Fetch Ledger Status (Planned Quantities per BOQ Item / WO Item)
    // Using service ensures ledgers are synced/created from WoActivityPlan if missing
    const ledgers = await this.ledgerService.getLedgerStatus(activityId);

    if (ledgers.length === 0) {
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

    for (const ledger of ledgers) {
      const vId = ledger.vendorId || 'DIRECT';
      const vName = ledger.vendor?.name || 'Direct Execution (No Vendor)';
      const vCode = ledger.vendor?.vendorCode || null;

      if (!vendorMap.has(vId)) {
        vendorMap.set(vId, {
          vendorId: ledger.vendorId || null,
          vendorName: vName,
          vendorCode: vCode,
          workOrderNumber: ledger.workOrder?.woNumber || null,
          boqBreakdown: [],
        });
      }
      const vendorNode = vendorMap.get(vId);

      // 4a. Fetch Micro Activities for this Ledger (linked via workOrderItemId if exists, else boqItem)
      const microActivities = await this.microActivityRepo.find({
        where: {
          microSchedule: {
            parentActivityId: activityId,
          },
          epsNodeId: In(nodeIds),
          // Link by WO Item if ledger has one, else fall back to BOQ linking
          workOrderItemId: ledger.workOrderItemId || undefined,
          boqItemId: !ledger.workOrderItemId ? ledger.boqItemId : undefined,
        },
      });

      const items: ExecutionBreakdownItem[] = [];

      for (const ma of microActivities) {
        const measurements = await this.measurementRepo.find({
          where: { microActivityId: ma.id, epsNodeId: epsNodeId },
        });

        let executedQty = measurements.reduce(
          (sum, m) => sum + Number(m.executedQty || 0),
          0,
        );

        const elementIds = measurements.map((m) => m.id);
        if (elementIds.length > 0) {
          const pendingLogs = await this.progressRepo
            .createQueryBuilder('progress')
            .where('progress.measurementElementId IN (:...ids)', {
              ids: elementIds,
            })
            .andWhere('progress.status = :status', { status: 'PENDING' })
            .getMany();
          executedQty += pendingLogs.reduce(
            (sum, log) => sum + Number(log.executedQty || 0),
            0,
          );
        }

        items.push({
          type: 'MICRO',
          id: ma.id,
          name: ma.name,
          allocatedQty: Number(ma.allocatedQty),
          executedQty: Number(executedQty),
          balanceQty: Number(ma.allocatedQty) - Number(executedQty),
        });
      }

      // 4b. Direct Balance (if applicable)
      const directExecutedQty = await this.getDirectExecutionQty(
        activityId,
        ledger.boqItemId,
        epsNodeId,
        ledger.workOrderItemId,
      );

      const balanceQty = Number(ledger.balanceQty);
      if (balanceQty > 0 || directExecutedQty > 0) {
        items.push({
          type: 'BALANCE',
          id: null,
          name: 'Unallocated Quantity',
          allocatedQty: balanceQty,
          executedQty: Number(directExecutedQty),
          balanceQty: balanceQty - Number(directExecutedQty),
        });
      }

      vendorNode.boqBreakdown.push({
        boqItem: ledger.boqItem,
        workOrderItemId: ledger.workOrderItemId,
        scope: {
          total: Number(ledger.totalParentQty),
          allocated: Number(ledger.allocatedQty),
          balance: Number(ledger.balanceQty),
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
    const ledgers = await this.ledgerService.getLedgerStatus(activityId);

    const vendorMap = new Map<number | string, any>();
    for (const ledger of ledgers) {
      const vId = ledger.vendorId || 'DIRECT';
      if (!vendorMap.has(vId)) {
        vendorMap.set(vId, {
          vendorId: ledger.vendorId || null,
          vendorName: ledger.vendor?.name || 'Direct Execution (No Vendor)',
          vendorCode: ledger.vendor?.vendorCode || null,
          workOrderNumber: ledger.workOrder?.woNumber || null,
          boqItemCount: 0,
          totalAllocatedQty: 0,
        });
      }
      const v = vendorMap.get(vId);
      v.boqItemCount++;
      v.totalAllocatedQty += Number(ledger.totalParentQty);
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
    activityId: number,
    boqItemId: number,
    epsNodeId: number,
    workOrderItemId?: number,
  ): Promise<number> {
    // Find MeasurementElements that are NOT linked to Micro Activities
    const measurements = await this.measurementRepo.find({
      where: {
        boqItemId,
        activityId,
        epsNodeId,
        workOrderItemId: workOrderItemId || IsNull(),
        microActivityId: IsNull(),
      },
    });

    // Sum up progress (Approved + Pending)
    let total = 0;
    const elementIds: number[] = [];

    for (const me of measurements) {
      total += Number(me.executedQty || 0); // Approved Qty
      elementIds.push(me.id);
    }

    // Add PENDING quantities (Temporary / Before Approval)
    if (elementIds.length > 0) {
      const pendingLogs = await this.progressRepo
        .createQueryBuilder('progress')
        .where('progress.measurementElementId IN (:...ids)', {
          ids: elementIds,
        })
        .andWhere('progress.status = :status', { status: 'PENDING' })
        .getMany();

      const pendingTotal = pendingLogs.reduce(
        (sum, log) => sum + Number(log.executedQty || 0),
        0,
      );

      total += pendingTotal;
    }

    return Math.max(0, total);
  }

  /**
   * Check if an activity has any micro schedule
   */
  async hasMicroSchedule(activityId: number): Promise<boolean> {
    const count = await this.microActivityRepo.count({
      where: {
        microSchedule: {
          parentActivityId: activityId,
        },
      },
    });
    return count > 0;
  }
}
