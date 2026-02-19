import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { BoqElement } from './entities/boq-element.entity';
import { CreateBoqElementDto } from './dto/create-boq-element.dto';
import { BoqItem, BoqQtyMode } from './entities/boq-item.entity';
import { BoqSubItem } from './entities/boq-sub-item.entity';
import { MeasurementElement } from './entities/measurement-element.entity';
import { MeasurementProgress } from './entities/measurement-progress.entity';
import { DataSource } from 'typeorm';
import { EpsNode } from '../eps/eps.entity'; // Added Import

import { AuditService } from '../audit/audit.service';
import { PlanningService } from '../planning/planning.service';
import { WorkDocService } from '../workdoc/workdoc.service';
import { forwardRef, Inject } from '@nestjs/common';

@Injectable()
export class BoqService {
  constructor(
    @InjectRepository(BoqElement)
    private readonly boqRepo: Repository<BoqElement>,
    @InjectRepository(BoqItem)
    private readonly boqItemRepo: Repository<BoqItem>,
    @InjectRepository(BoqSubItem)
    private readonly boqSubItemRepo: Repository<BoqSubItem>,
    @InjectRepository(MeasurementElement)
    private readonly measurementRepo: Repository<MeasurementElement>,
    @InjectRepository(MeasurementProgress)
    private readonly progressRepo: Repository<MeasurementProgress>,
    @InjectRepository(EpsNode)
    private readonly epsRepo: Repository<EpsNode>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    @Inject(forwardRef(() => PlanningService))
    private readonly planningService: PlanningService,
    @Inject(forwardRef(() => WorkDocService))
    private readonly workDocService: WorkDocService,
  ) {}

  // --- Legacy / Compatibility ---
  async create(dto: CreateBoqElementDto): Promise<BoqElement> {
    const boq = this.boqRepo.create(dto);
    boq.epsNode = { id: dto.epsNodeId } as any;
    return await this.boqRepo.save(boq);
  }

  // === Layer 1: Commercial Item ===
  async createBoqItem(
    data: Partial<BoqItem>,
    userId: number = 0,
  ): Promise<BoqItem> {
    if (data.epsNodeId) {
      data.epsNode = { id: data.epsNodeId } as any;
    }

    const item = this.boqItemRepo.create(data);
    const saved = await this.boqItemRepo.save(item);

    await this.auditService.log(userId, 'CREATE', 'BOQ_ITEM', saved.id, {
      code: saved.boqCode,
      name: saved.description,
      qty: saved.qty,
    });

    return saved;
  }

  async getProjectBoq(projectId: number): Promise<BoqItem[]> {
    try {
      return await this.boqItemRepo.find({
        where: { projectId },
        relations: ['epsNode', 'subItems', 'subItems.measurements'],
        order: { boqCode: 'ASC' },
      });
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  // === Layer 2: Sub Item / Breakup ===
  async createSubItem(data: Partial<BoqSubItem>): Promise<BoqSubItem> {
    const subItem = this.boqSubItemRepo.create(data);
    const saved = await this.boqSubItemRepo.save(subItem);
    await this.aggregateToBoqItem(saved.boqItemId);
    return saved;
  }

  async updateSubItem(
    id: number,
    data: Partial<BoqSubItem>,
  ): Promise<BoqSubItem> {
    await this.boqSubItemRepo.update(id, data);
    const updated = await this.boqSubItemRepo.findOneBy({ id });
    if (updated) {
      if (data.qty !== undefined || data.rate !== undefined) {
        updated.amount = Number(updated.qty) * Number(updated.rate);
        await this.boqSubItemRepo.save(updated);
      }
      await this.aggregateToBoqItem(updated.boqItemId);
    }
    return updated!;
  }

  async addMeasurement(
    data: Partial<MeasurementElement>,
  ): Promise<MeasurementElement> {
    if (!data.elementId) {
      data.elementId = `MAN-${Date.now()}`;
    }
    const measurement = this.measurementRepo.create(data);
    const saved = await this.measurementRepo.save(measurement);

    if (saved.boqSubItemId) {
      await this.recalculateSubItem(saved.boqSubItemId);
    } else if (saved.boqItemId) {
      await this.rollupQuantity(saved.boqItemId);
    }

    return saved;
  }

  // === Layer 4: Progress ===
  async addProgress(
    data: Partial<MeasurementProgress>,
  ): Promise<MeasurementProgress> {
    return await this.dataSource.transaction(async (manager) => {
      const savedProgress = await manager.save(
        MeasurementProgress,
        manager.create(MeasurementProgress, data),
      );

      const measurement = await manager.findOne(MeasurementElement, {
        where: { id: data.measurementElementId },
        relations: ['boqItem', 'boqSubItem'],
      });

      if (!measurement) throw new NotFoundException('Measurement not found');

      measurement.executedQty =
        Number(measurement.executedQty || 0) + Number(data.executedQty);
      await manager.save(MeasurementElement, measurement);

      if (measurement.boqItem) {
        const boqItem = measurement.boqItem;
        boqItem.consumedQty =
          Number(boqItem.consumedQty || 0) + Number(data.executedQty);
        await manager.save(BoqItem, boqItem);
      }

      if (measurement.boqSubItem) {
        const subItem = measurement.boqSubItem;
        subItem.executedQty =
          Number(subItem.executedQty || 0) + Number(data.executedQty);
        await manager.save(BoqSubItem, subItem);
      }

      // Trigger Financial Update in Schedule
      if (measurement.boqItemId) {
        await this.planningService.updateActivitiesByBoqItem(
          measurement.boqItemId,
        );
      }

      // NEW: Sync Work Order progress
      if (measurement.boqItemId || measurement.boqSubItemId) {
        await this.workDocService.syncWorkOrderProgress();
      }

      return savedProgress;
    });
  }

  private async rollupQuantity(boqItemId: number) {
    const boqItem = await this.boqItemRepo.findOne({
      where: { id: boqItemId },
    });
    if (!boqItem) return;

    if (boqItem.qtyMode === BoqQtyMode.DERIVED) {
      const { sum } = await this.measurementRepo
        .createQueryBuilder('m')
        .select('SUM(m.qty)', 'sum')
        .where('m.boqItemId = :id', { id: boqItemId })
        .getRawOne();

      boqItem.qty = Number(sum || 0);
      if (boqItem.qty > 0 && Number(boqItem.amount) > 0) {
        // If amount exists, keep rate consistent. If rate is 0, infer it.
        if (Number(boqItem.rate) === 0) {
          boqItem.rate = Number(boqItem.amount) / boqItem.qty;
        } else {
          boqItem.amount = boqItem.qty * boqItem.rate;
        }
      } else {
        boqItem.amount = boqItem.qty * boqItem.rate;
      }
      await this.boqItemRepo.save(boqItem);

      // Trigger Financial Update in Schedule
      await this.planningService.updateActivitiesByBoqItem(boqItemId);
    }
  }

  public async recalculateSubItem(subItemId: number) {
    const subItem = await this.boqSubItemRepo.findOne({
      where: { id: subItemId },
      relations: ['boqItem'],
    });
    if (!subItem) return;

    const { sum } = await this.measurementRepo
      .createQueryBuilder('m')
      .select('SUM(m.qty)', 'sum')
      .where('m.boqSubItemId = :id', { id: subItemId })
      .getRawOne();

    subItem.qty = Number(sum || 0);
    subItem.amount = subItem.qty * subItem.rate;
    await this.boqSubItemRepo.save(subItem);

    if (subItem.boqItemId) {
      await this.aggregateToBoqItem(subItem.boqItemId);
    }
  }

  private async aggregateToBoqItem(boqItemId: number) {
    const boqItem = await this.boqItemRepo.findOne({
      where: { id: boqItemId },
    });
    if (!boqItem) {
      console.error(
        `[BoqService] BoqItem ${boqItemId} not found during rollup`,
      );
      return;
    }

    const { totalQty, totalAmount } = await this.boqSubItemRepo
      .createQueryBuilder('s')
      .select('SUM(s.qty)', 'totalQty')
      .addSelect('SUM(s.amount)', 'totalAmount')
      .where('s.boqItemId = :id', { id: boqItemId })
      .getRawOne();

    console.log(
      `[BoqService] DB Rollup Result: Qty=${totalQty}, Amt=${totalAmount}`,
    );

    boqItem.qty = Number(totalQty || 0);
    boqItem.amount = Number(totalAmount || 0);

    // Ensure rate is not 0 if we have an amount
    if (boqItem.qty > 0 && boqItem.amount > 0) {
      boqItem.rate = boqItem.amount / boqItem.qty;
    }

    await this.boqItemRepo.save(boqItem);

    // Trigger Financial Update in Schedule
    await this.planningService.updateActivitiesByBoqItem(boqItemId);
    console.log(
      `[BoqService] Saved BoqItem ${boqItemId}. New Amount: ${boqItem.amount}`,
    );
  }

  async findByProject(projectId: number): Promise<BoqElement[]> {
    return await this.boqRepo.find({
      where: { projectId },
      relations: ['epsNode'],
      order: { boqCode: 'ASC' },
    });
  }

  // === UPDATED: Recursive Fetch ===
  async findByEpsNode(epsNodeId: number): Promise<BoqItem[]> {
    let allNodes: EpsNode[] = [];
    try {
      allNodes = await this.epsRepo.find({
        select: ['id', 'parentId', 'name'], // Added name for debug
      });
      console.log(
        `[BoqService] Fetched ${allNodes.length} EPS nodes for tree recursion. Checking for EPS ${epsNodeId}`,
      );
    } catch (e) {
      console.error(
        '[BoqService] Failed to fetch EpsNodes for recursion. Fallback to single node.',
        e,
      );
      return await this.boqItemRepo.find({
        where: { epsNode: { id: epsNodeId } },
        order: { boqCode: 'ASC' },
      });
    }

    const descendantIds = new Set<number>();
    descendantIds.add(Number(epsNodeId));

    let foundNew = true;
    let loops = 0;
    while (foundNew && loops < 50) {
      foundNew = false;
      loops++;
      for (const node of allNodes) {
        if (!node.parentId) continue;
        if (!descendantIds.has(node.id) && descendantIds.has(node.parentId)) {
          // console.log(`[BoqService] Found descendant: ${node.name} (${node.id}) -> Parent: ${node.parentId}`);
          descendantIds.add(node.id);
          foundNew = true;
        }
      }
    }

    const ids = Array.from(descendantIds);
    console.log(
      `[BoqService] EPS ${epsNodeId} -> Found ${ids.length} descendant nodes (Loops: ${loops}). IDs: ${ids.join(',')}`,
    );

    if (ids.length === 0) return [];

    return await this.boqItemRepo.find({
      where: { epsNode: { id: In(ids) } },
      relations: ['epsNode', 'subItems', 'subItems.measurements'],
      order: { boqCode: 'ASC' },
    });
  }

  async updateConsumedQuantity(id: number, delta: number) {
    await this.boqRepo.increment({ id }, 'consumedQuantity', delta);
  }

  async updateBoqItem(
    id: number,
    data: Partial<BoqItem>,
    userId: number = 0,
  ): Promise<BoqItem> {
    const item = await this.boqItemRepo.findOneBy({ id });
    if (!item) throw new NotFoundException('BOQ Item not found');

    if (data.qty !== undefined && item.qtyMode === BoqQtyMode.DERIVED) {
      if (data.qty !== item.qty) {
        throw new Error(
          'Cannot manually update Quantity when Mode is DERIVED. Update Measurements instead.',
        );
      }
    }

    const oldData = {
      qty: item.qty,
      rate: item.rate,
      amount: item.amount,
      mode: item.qtyMode,
    };

    Object.assign(item, data);
    item.amount = Number(item.qty) * Number(item.rate);

    const saved = await this.boqItemRepo.save(item);

    // Trigger Financial Update in Schedule
    await this.planningService.updateActivitiesByBoqItem(saved.id);

    await this.auditService.log(userId, 'UPDATE', 'BOQ_ITEM', id, {
      changes: data,
      previous: oldData,
      new: { qty: saved.qty, amount: saved.amount },
    });

    return saved;
  }

  async deleteBoqItem(id: number, userId: number = 0): Promise<void> {
    const item = await this.boqItemRepo.findOneBy({ id });
    if (!item) throw new NotFoundException('BOQ Item not found');

    await this.auditService.log(userId, 'DELETE', 'BOQ_ITEM', id, {
      code: item.boqCode,
      name: item.description,
    });
    await this.boqItemRepo.remove(item);
  }

  async deleteMeasurements(ids: number[]): Promise<void> {
    if (!ids || ids.length === 0) return;

    const measurements = await this.measurementRepo.find({
      where: { id: In(ids) },
      select: ['id', 'boqSubItemId', 'boqItemId'],
    });

    const subItemsToUpdate = new Set<number>();
    const mainItemsToUpdate = new Set<number>();

    measurements.forEach((m) => {
      if (m.boqSubItemId) subItemsToUpdate.add(m.boqSubItemId);
      if (m.boqItemId) mainItemsToUpdate.add(m.boqItemId);
    });

    await this.measurementRepo.delete(ids);

    for (const subId of subItemsToUpdate) {
      await this.recalculateSubItem(subId);
    }
    for (const mainId of mainItemsToUpdate) {
      await this.rollupQuantity(mainId);
    }
  }

  async updateMeasurement(id: number, data: any): Promise<any> {
    const measurement = await this.measurementRepo.findOneBy({ id });
    if (!measurement) throw new NotFoundException('Measurement not found');

    Object.assign(measurement, data);
    return await this.measurementRepo.save(measurement);
  }

  async bulkUpdateMeasurements(ids: number[], data: any): Promise<void> {
    if (!ids || ids.length === 0) return;
    await this.measurementRepo.update({ id: In(ids) }, data);
  }
}
