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
import { BoqActivityPlan } from '../planning/entities/boq-activity-plan.entity';

@Injectable()
export class MicroLedgerService {
  constructor(
    @InjectRepository(MicroQuantityLedger)
    private readonly ledgerRepo: Repository<MicroQuantityLedger>,
    @InjectRepository(Activity)
    private readonly activityRepo: Repository<Activity>,
    @InjectRepository(BoqItem)
    private readonly boqRepo: Repository<BoqItem>,
    @InjectRepository(BoqActivityPlan)
    private readonly planRepo: Repository<BoqActivityPlan>,
  ) {}

  /**
   * Get or create ledger for a parent activity + BOQ combination
   */
  async getOrCreateLedger(
    parentActivityId: number,
    boqItemId: number,
    workOrderId?: number,
  ): Promise<MicroQuantityLedger> {
    // 1. Resolve Planned Quantity for this Activity (Source of Truth)
    const plans = await this.planRepo.find({
      where: { activityId: parentActivityId, boqItemId },
    });
    const totalPlannedQty = plans.reduce(
      (sum, p) => sum + Number(p.plannedQuantity),
      0,
    );

    // Debug
    console.log(
      `[MicroLedger] Resolved Planned Qty for Activity ${parentActivityId} / BOQ ${boqItemId}: ${totalPlannedQty}`,
    );

    let ledger = await this.ledgerRepo.findOne({
      where: { parentActivityId, boqItemId },
    });

    if (ledger) {
      // Check for sync drift
      if (Number(ledger.totalParentQty) !== totalPlannedQty) {
        console.log(
          `[MicroLedger] Syncing Ledger total from ${ledger.totalParentQty} to ${totalPlannedQty}`,
        );
        ledger.totalParentQty = totalPlannedQty;
        // Recalculate balance
        ledger.balanceQty =
          Number(ledger.totalParentQty) - Number(ledger.allocatedQty);
        await this.ledgerRepo.save(ledger);
      }
    } else {
      // Fetch parent activity to get total quantity
      const activity = await this.activityRepo.findOne({
        where: { id: parentActivityId },
      });

      if (!activity) {
        throw new NotFoundException(`Activity ${parentActivityId} not found`);
      }

      const boqItem = await this.boqRepo.findOne({
        where: { id: boqItemId },
      });

      if (!boqItem) {
        throw new NotFoundException(`BOQ Item ${boqItemId} not found`);
      }

      // Create new ledger
      ledger = this.ledgerRepo.create({
        parentActivityId,
        boqItemId,
        workOrderId,
        totalParentQty: totalPlannedQty, // Use resolved planned qty
        allocatedQty: 0,
        consumedQty: 0,
        balanceQty: totalPlannedQty,
        uom: boqItem.uom,
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
    boqItemId: number,
    newAllocationQty: number,
  ): Promise<{ allowed: boolean; message?: string; balance?: number }> {
    const ledger = await this.getOrCreateLedger(parentActivityId, boqItemId);

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
    boqItemId: number,
    deltaQty: number,
  ): Promise<void> {
    const ledger = await this.getOrCreateLedger(parentActivityId, boqItemId);

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
    boqItemId: number,
    deltaQty: number,
  ): Promise<void> {
    const ledger = await this.getOrCreateLedger(parentActivityId, boqItemId);

    ledger.consumedQty = Number(ledger.consumedQty) + Number(deltaQty);
    ledger.lastReconciled = new Date();

    await this.ledgerRepo.save(ledger);
  }

  /**
   * Get ledger status for a parent activity
   * Auto-syncs with Planning module to ensure all planned items are available
   * Removes Ghost Ledgers (0 planned qty and unused)
   */
  async getLedgerStatus(
    parentActivityId: number,
  ): Promise<MicroQuantityLedger[]> {
    // 1. Fetch all planned items for this activity (with Qty)
    const plans = await this.planRepo.find({
      where: { activityId: parentActivityId },
      select: ['boqItemId', 'plannedQuantity'],
    });

    // Map for quick lookup
    const planMap = new Map<number, number>();
    plans.forEach((p) => {
      const current = planMap.get(p.boqItemId) || 0;
      planMap.set(p.boqItemId, current + Number(p.plannedQuantity));
    });

    // 2. Fetch existing ledgers (Detailed, to check usage)
    const existingLedgers = await this.ledgerRepo.find({
      where: { parentActivityId },
    });

    // 3. Sync all items (Unique Set of BOQ IDs)
    const uniqueBoqIds = [
      ...new Set([
        ...plans.map((p) => p.boqItemId),
        ...existingLedgers.map((l) => l.boqItemId),
      ]),
    ];

    for (const boqItemId of uniqueBoqIds) {
      // Check if planned
      const plannedQty = planMap.get(boqItemId) || 0;

      if (plannedQty === 0) {
        // Try to delete ghost ledger
        const ledger = existingLedgers.find((l) => l.boqItemId === boqItemId);
        if (ledger) {
          if (
            Number(ledger.allocatedQty) === 0 &&
            Number(ledger.consumedQty) === 0
          ) {
            // Unused ghost -> DELETE
            console.log(
              `[MicroLedger] Deleting Ghost Ledger for Activity ${parentActivityId} / BOQ ${boqItemId}`,
            );
            await this.ledgerRepo.remove(ledger);
          } else {
            // Used ghost -> Update to 0
            if (Number(ledger.totalParentQty) !== 0) {
              ledger.totalParentQty = 0;
              ledger.balanceQty = -Number(ledger.allocatedQty);
              await this.ledgerRepo.save(ledger);
            }
          }
        }
      } else {
        // Valid plan -> Update/Create
        await this.getOrCreateLedger(parentActivityId, boqItemId);
      }
    }

    // 4. Return all remaining ledgers
    return await this.ledgerRepo.find({
      where: { parentActivityId },
      relations: ['boqItem', 'parentActivity', 'workOrder'],
    });
  }

  /**
   * Reconcile ledger (recalculate from micro activities and daily logs)
   */
  async reconcileLedger(
    parentActivityId: number,
    boqItemId: number,
  ): Promise<void> {
    // This will be implemented when we have micro activities and daily logs
    // For now, just update the timestamp
    const ledger = await this.getOrCreateLedger(parentActivityId, boqItemId);
    ledger.lastReconciled = new Date();
    await this.ledgerRepo.save(ledger);
  }
}
