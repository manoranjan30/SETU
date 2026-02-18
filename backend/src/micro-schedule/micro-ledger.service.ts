import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MicroQuantityLedger } from './entities/micro-quantity-ledger.entity';
import { Activity } from '../wbs/entities/activity.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';

@Injectable()
export class MicroLedgerService {
    constructor(
        @InjectRepository(MicroQuantityLedger)
        private readonly ledgerRepo: Repository<MicroQuantityLedger>,
        @InjectRepository(Activity)
        private readonly activityRepo: Repository<Activity>,
        @InjectRepository(BoqItem)
        private readonly boqRepo: Repository<BoqItem>,
    ) { }

    /**
     * Get or create ledger for a parent activity + BOQ combination
     */
    async getOrCreateLedger(
        parentActivityId: number,
        boqItemId: number,
        workOrderId?: number,
    ): Promise<MicroQuantityLedger> {
        let ledger = await this.ledgerRepo.findOne({
            where: { parentActivityId, boqItemId },
        });

        if (!ledger) {
            // Fetch parent activity to get total quantity
            const activity = await this.activityRepo.findOne({
                where: { id: parentActivityId },
                relations: ['boqItem'],
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
                totalParentQty: boqItem.qty,
                allocatedQty: 0,
                consumedQty: 0,
                balanceQty: boqItem.qty,
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
        ledger.balanceQty = Number(ledger.totalParentQty) - Number(ledger.allocatedQty);

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
     */
    async getLedgerStatus(parentActivityId: number): Promise<MicroQuantityLedger[]> {
        return await this.ledgerRepo.find({
            where: { parentActivityId },
            relations: ['boqItem', 'parentActivity', 'workOrder'],
        });
    }

    /**
     * Reconcile ledger (recalculate from micro activities and daily logs)
     */
    async reconcileLedger(parentActivityId: number, boqItemId: number): Promise<void> {
        // This will be implemented when we have micro activities and daily logs
        // For now, just update the timestamp
        const ledger = await this.getOrCreateLedger(parentActivityId, boqItemId);
        ledger.lastReconciled = new Date();
        await this.ledgerRepo.save(ledger);
    }
}
