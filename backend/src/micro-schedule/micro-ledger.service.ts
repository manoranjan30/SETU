import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MicroQuantityLedger } from './entities/micro-quantity-ledger.entity';
import { Activity } from '../wbs/entities/activity.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';
import { WorkOrderItem } from '../workdoc/entities/work-order-item.entity';
import { WoActivityPlan } from '../planning/entities/wo-activity-plan.entity';

@Injectable()
export class MicroLedgerService {
  constructor(
    @InjectRepository(MicroQuantityLedger)
    private readonly ledgerRepo: Repository<MicroQuantityLedger>,
    @InjectRepository(Activity)
    private readonly activityRepo: Repository<Activity>,
    @InjectRepository(BoqItem)
    private readonly boqRepo: Repository<BoqItem>,
    @InjectRepository(WorkOrderItem)
    private readonly woItemRepo: Repository<WorkOrderItem>,
    @InjectRepository(WoActivityPlan)
    private readonly planRepo: Repository<WoActivityPlan>,
  ) {}

  /**
   * Get or create ledger for a parent activity + WO Item combination
   * (Previously was Activity + BOQ Item)
   */
  async getOrCreateLedger(
    parentActivityId: number,
    workOrderItemId: number,
  ): Promise<MicroQuantityLedger> {
    // 1. Resolve Planned Qty from WoActivityPlan (Source of Truth)
    const plans = await this.planRepo.find({
      where: { activityId: parentActivityId, workOrderItemId },
    });
    const totalPlannedQty = plans.reduce(
      (sum, p) => sum + Number(p.plannedQuantity),
      0,
    );

    console.log(
      `[MicroLedger] Resolved Planned Qty for Activity ${parentActivityId} / WO Item ${workOrderItemId}: ${totalPlannedQty}`,
    );

    let ledger = await this.ledgerRepo.findOne({
      where: { parentActivityId, workOrderItemId },
    });

    if (ledger) {
      // Check for sync drift
      if (Number(ledger.totalParentQty) !== totalPlannedQty) {
        console.log(
          `[MicroLedger] Syncing Ledger total from ${ledger.totalParentQty} to ${totalPlannedQty}`,
        );
        ledger.totalParentQty = totalPlannedQty;
        ledger.balanceQty =
          Number(ledger.totalParentQty) - Number(ledger.allocatedQty);
        await this.ledgerRepo.save(ledger);
      }
    } else {
      const activity = await this.activityRepo.findOne({
        where: { id: parentActivityId },
      });
      if (!activity)
        throw new NotFoundException(`Activity ${parentActivityId} not found`);

      // Fetch WO Item to get vendor and BOQ context
      const woItem = await this.woItemRepo.findOne({
        where: { id: workOrderItemId },
        relations: ['workOrder', 'workOrder.vendor'],
      });
      if (!woItem)
        throw new NotFoundException(
          `Work Order Item ${workOrderItemId} not found`,
        );

      ledger = this.ledgerRepo.create({
        parentActivityId,
        workOrderItemId,
        workOrderId: woItem.workOrder?.id,
        vendorId: woItem.workOrder?.vendor?.id,
        boqItemId: woItem.boqItemId,
        totalParentQty: totalPlannedQty,
        allocatedQty: 0,
        consumedQty: 0,
        balanceQty: totalPlannedQty,
        uom: woItem.uom || 'NOS',
      });

      await this.ledgerRepo.save(ledger);
    }

    return ledger;
  }

  /**
   * Validate if a new allocation is allowed
   */
  async validateAllocation(
    parentActivityId: number,
    workOrderItemId: number,
    newAllocationQty: number,
  ): Promise<{ allowed: boolean; message?: string; balance?: number }> {
    const ledger = await this.getOrCreateLedger(
      parentActivityId,
      workOrderItemId,
    );

    const newTotal = Number(ledger.allocatedQty) + Number(newAllocationQty);
    const parentQty = Number(ledger.totalParentQty);

    if (newTotal > parentQty) {
      return {
        allowed: false,
        message: `Allocation exceeds parent quantity. Available: ${ledger.balanceQty} ${ledger.uom}, Requested: ${newAllocationQty} ${ledger.uom}`,
        balance: Number(ledger.balanceQty),
      };
    }

    return {
      allowed: true,
      balance: parentQty - newTotal,
    };
  }

  /**
   * Update allocated quantity after creating/updating micro activity
   */
  async updateAllocatedQty(
    parentActivityId: number,
    workOrderItemId: number,
    deltaQty: number,
  ): Promise<void> {
    const ledger = await this.getOrCreateLedger(
      parentActivityId,
      workOrderItemId,
    );

    ledger.allocatedQty = Number(ledger.allocatedQty) + Number(deltaQty);
    ledger.balanceQty =
      Number(ledger.totalParentQty) - Number(ledger.allocatedQty);

    await this.ledgerRepo.save(ledger);
  }

  /**
   * Update consumed quantity after daily log entry
   */
  async updateConsumedQty(
    parentActivityId: number,
    workOrderItemId: number,
    deltaQty: number,
  ): Promise<void> {
    const ledger = await this.getOrCreateLedger(
      parentActivityId,
      workOrderItemId,
    );

    ledger.consumedQty = Number(ledger.consumedQty) + Number(deltaQty);
    ledger.lastReconciled = new Date();

    await this.ledgerRepo.save(ledger);
  }

  /**
   * Get ledger status for a parent activity
   * Auto-syncs with WoActivityPlan to ensure all planned WO items are available
   */
  async getLedgerStatus(
    parentActivityId: number,
  ): Promise<MicroQuantityLedger[]> {
    // 1. Fetch all planned WO Items for this activity
    const plans = await this.planRepo.find({
      where: { activityId: parentActivityId },
      select: ['workOrderItemId', 'plannedQuantity'],
    });

    const planMap = new Map<number, number>();
    plans.forEach((p) => {
      const current = planMap.get(p.workOrderItemId) || 0;
      planMap.set(p.workOrderItemId, current + Number(p.plannedQuantity));
    });

    // 2. Fetch existing ledgers
    const existingLedgers = await this.ledgerRepo.find({
      where: { parentActivityId },
    });

    // 3. Sync all items
    const uniqueWoItemIds = [
      ...new Set([
        ...plans.map((p) => p.workOrderItemId),
        ...existingLedgers
          .map((l) => l.workOrderItemId)
          .filter((id) => id != null),
      ]),
    ];

    for (const woItemId of uniqueWoItemIds) {
      const plannedQty = planMap.get(woItemId) || 0;

      if (plannedQty === 0) {
        const ledger = existingLedgers.find(
          (l) => l.workOrderItemId === woItemId,
        );
        if (ledger) {
          if (
            Number(ledger.allocatedQty) === 0 &&
            Number(ledger.consumedQty) === 0
          ) {
            console.log(
              `[MicroLedger] Deleting Ghost Ledger for Activity ${parentActivityId} / WO Item ${woItemId}`,
            );
            await this.ledgerRepo.remove(ledger);
          } else {
            if (Number(ledger.totalParentQty) !== 0) {
              ledger.totalParentQty = 0;
              ledger.balanceQty = -Number(ledger.allocatedQty);
              await this.ledgerRepo.save(ledger);
            }
          }
        }
      } else {
        await this.getOrCreateLedger(parentActivityId, woItemId);
      }
    }

    // 4. Return all remaining ledgers with relations
    return await this.ledgerRepo.find({
      where: { parentActivityId },
      relations: [
        'boqItem',
        'parentActivity',
        'workOrder',
        'workOrderItem',
        'vendor',
      ],
    });
  }

  /**
   * Reconcile ledger
   */
  async reconcileLedger(
    parentActivityId: number,
    workOrderItemId: number,
  ): Promise<void> {
    const ledger = await this.getOrCreateLedger(
      parentActivityId,
      workOrderItemId,
    );
    ledger.lastReconciled = new Date();
    await this.ledgerRepo.save(ledger);
  }
}
