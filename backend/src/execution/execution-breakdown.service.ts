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
  boqBreakdown: {
    boqItem: BoqItem;
    scope: {
      total: number;
      allocated: number;
      balance: number;
    };
    items: ExecutionBreakdownItem[];
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

    // 2. Fetch Ledger Status (Planned Quantities per BOQ Item)
    const ledgers = await this.ledgerRepo.find({
      where: { parentActivityId: activityId },
      relations: ['boqItem'],
    });

    if (ledgers.length === 0) {
      // No micro planning exists, return empty structure
      return {
        activityId,
        activity,
        epsNodeId,
        boqBreakdown: [],
      };
    }

    // 3. Resolve EPS node IDs: include the given node AND all its descendants.
    // This handles the case where micro activities are defined at a child node
    // (e.g., unit level) while the caller is browsing at a parent level (floor).
    const nodeIds = await this.getNodeAndDescendantIds(epsNodeId);

    // 4. Build Breakdown for each BOQ Item
    const boqBreakdown = await Promise.all(
      ledgers.map(async (ledger) => {
        // 4a. Fetch Micro Activities for this BOQ Item across the node subtree
        const microActivities = await this.microActivityRepo.find({
          where: {
            microSchedule: {
              parentActivityId: activityId,
            },
            epsNodeId: In(nodeIds),
            boqItemId: ledger.boqItemId,
          },
          relations: ['microSchedule'],
        });

        // 4b. Calculate executed quantities
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
          executedQty = Math.max(0, executedQty);

          items.push({
            type: 'MICRO',
            id: ma.id,
            name: ma.name,
            allocatedQty: Number(ma.allocatedQty),
            executedQty: Number(executedQty),
            balanceQty: Number(ma.allocatedQty) - Number(executedQty),
          });
        }

        // 4c. Calculate Direct Execution (Balance)
        const directExecutedQty = await this.getDirectExecutionQty(
          activityId,
          ledger.boqItemId,
          epsNodeId,
        );

        const balanceQty = Number(ledger.balanceQty);

        items.push({
          type: 'BALANCE',
          id: null,
          name: 'Unassigned Quantity (Direct)',
          allocatedQty: balanceQty,
          executedQty: Number(directExecutedQty),
          balanceQty: balanceQty - Number(directExecutedQty),
        });

        return {
          boqItem: ledger.boqItem,
          scope: {
            total: Number(ledger.totalParentQty),
            allocated: Number(ledger.allocatedQty),
            balance: Number(ledger.balanceQty),
          },
          items,
        };
      }),
    );

    return {
      activityId,
      activity,
      epsNodeId,
      boqBreakdown,
    };
  }

  /**
   * Get executed quantity for "Direct Execution" (progress not linked to Micro Activity)
   */
  private async getDirectExecutionQty(
    activityId: number,
    boqItemId: number,
    epsNodeId: number,
  ): Promise<number> {
    // Find MeasurementElements that are NOT linked to Micro Activities
    const measurements = await this.measurementRepo.find({
      where: {
        boqItemId,
        activityId,
        epsNodeId,
        // elementId pattern for direct execution (not linked to micro)
        // We'll use a convention: Direct execution elements don't have MICRO- prefix
      },
    });

    // Sum up progress (Approved + Pending)
    let total = 0;
    const elementIds: number[] = [];

    for (const me of measurements) {
      // Check if this is a direct execution element (not linked to micro)
      if (me.elementId && !me.elementId.includes('MICRO-')) {
        total += Number(me.executedQty || 0); // Approved Qty
        elementIds.push(me.id);
      }
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
