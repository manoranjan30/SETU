import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Budget, BudgetStatus } from './entities/budget.entity';
import {
  BudgetLineItem,
  BudgetLineStatus,
} from './entities/budget-line-item.entity';
import {
  BudgetBoqMap,
  BudgetAllocationType,
} from './entities/budget-boq-map.entity';
import { BudgetLineActivityMap } from './entities/budget-line-activity-map.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';
import { CostService } from './cost.service';
import {
  ExecutionProgressEntry,
  ExecutionProgressEntryStatus,
} from '../execution/entities/execution-progress-entry.entity';
import { Activity } from '../wbs/entities/activity.entity';
import csv from 'csv-parser';
import { Readable } from 'stream';

@Injectable()
export class BudgetService {
  constructor(
    @InjectRepository(Budget)
    private readonly budgetRepo: Repository<Budget>,
    @InjectRepository(BudgetLineItem)
    private readonly budgetLineRepo: Repository<BudgetLineItem>,
    @InjectRepository(BudgetBoqMap)
    private readonly budgetMapRepo: Repository<BudgetBoqMap>,
    @InjectRepository(BudgetLineActivityMap)
    private readonly budgetLineActivityRepo: Repository<BudgetLineActivityMap>,
    @InjectRepository(BoqItem)
    private readonly boqItemRepo: Repository<BoqItem>,
    @InjectRepository(Activity)
    private readonly activityRepo: Repository<Activity>,
    @InjectRepository(ExecutionProgressEntry)
    private readonly progressRepo: Repository<ExecutionProgressEntry>,
    private readonly costService: CostService,
  ) {}

  async listBudgets(projectId: number) {
    return this.budgetRepo.find({
      where: { projectId },
      order: { id: 'DESC' },
    });
  }

  async getBudget(projectId: number, budgetId: number) {
    const budget = await this.budgetRepo.findOne({
      where: { id: budgetId, projectId },
    });
    if (!budget) throw new NotFoundException('Budget not found');
    return budget;
  }

  async getActiveBudget(projectId: number) {
    return this.budgetRepo.findOne({
      where: { projectId, status: BudgetStatus.ACTIVE },
      order: { id: 'DESC' },
    });
  }

  async getBudgetLineById(projectId: number, lineId: number) {
    const line = await this.budgetLineRepo
      .createQueryBuilder('line')
      .innerJoin('line.budget', 'budget')
      .where('line.id = :lineId', { lineId })
      .andWhere('budget.projectId = :projectId', { projectId })
      .getOne();
    if (!line) throw new NotFoundException('Budget line not found');
    return line;
  }

  private normalizeLinePayload(payload: Partial<BudgetLineItem>) {
    const qty =
      payload.qty !== undefined ? Number(payload.qty || 0) : undefined;
    const rate =
      payload.rate !== undefined ? Number(payload.rate || 0) : undefined;
    const amountProvided = payload.amount !== undefined;
    const amount = amountProvided
      ? Number(payload.amount || 0)
      : qty !== undefined && rate !== undefined
      ? qty * rate
      : undefined;

    return {
      ...payload,
      ...(qty !== undefined ? { qty } : {}),
      ...(rate !== undefined ? { rate } : {}),
      ...(amount !== undefined ? { amount } : {}),
    };
  }

  async createBudget(
    projectId: number,
    body: Partial<Budget>,
    userId: number,
  ) {
    const budget = this.budgetRepo.create({
      projectId,
      name: body.name || `Budget ${new Date().getFullYear()}`,
      status: body.status || BudgetStatus.DRAFT,
      version: body.version || 1,
      createdBy: String(userId || 'system'),
    });
    const saved = await this.budgetRepo.save(budget);

    if (saved.status === BudgetStatus.ACTIVE) {
      await this.budgetRepo
        .createQueryBuilder()
        .update(Budget)
        .set({ status: BudgetStatus.DRAFT })
        .where('"projectId" = :projectId', { projectId })
        .andWhere('id != :id', { id: saved.id })
        .execute();
    }

    return saved;
  }

  async updateBudget(
    projectId: number,
    budgetId: number,
    body: Partial<Budget>,
    userId: number,
  ) {
    const budget = await this.getBudget(projectId, budgetId);
    Object.assign(budget, {
      name: body.name ?? budget.name,
      status: body.status ?? budget.status,
      version: body.version ?? budget.version,
      createdBy: budget.createdBy || String(userId || 'system'),
    });
    const saved = await this.budgetRepo.save(budget);

    if (saved.status === BudgetStatus.ACTIVE) {
      await this.budgetRepo
        .createQueryBuilder()
        .update(Budget)
        .set({ status: BudgetStatus.DRAFT })
        .where('"projectId" = :projectId', { projectId })
        .andWhere('id != :id', { id: saved.id })
        .execute();
    }

    return saved;
  }

  async deleteBudget(projectId: number, budgetId: number) {
    const budget = await this.getBudget(projectId, budgetId);
    const lineIds = await this.budgetLineRepo.find({
      where: { budgetId },
      select: ['id'],
    });
    if (lineIds.length > 0) {
      const mappedCount = await this.budgetMapRepo.count({
        where: { budgetLineItemId: In(lineIds.map((l) => l.id)) },
      });
      if (mappedCount > 0) {
        throw new BadRequestException(
          'Budget has mapped BOQ items. Clear mappings before deleting.',
        );
      }
    }
    await this.budgetRepo.remove(budget);
    return { deleted: true };
  }

  async listBudgetLines(projectId: number, budgetId: number) {
    await this.getBudget(projectId, budgetId);
    return this.budgetLineRepo.find({
      where: { budgetId },
      order: { id: 'ASC' },
    });
  }

  async listBudgetLineActivities(
    projectId: number,
    budgetId: number,
    lineId: number,
  ) {
    await this.getBudget(projectId, budgetId);
    const line = await this.budgetLineRepo.findOne({
      where: { id: lineId, budgetId },
    });
    if (!line) throw new NotFoundException('Budget line not found');
    const mappings = await this.budgetLineActivityRepo.find({
      where: { budgetLineItemId: lineId },
    });
    return mappings.map((m) => ({
      id: m.id,
      budgetLineItemId: m.budgetLineItemId,
      activityId: m.activityId,
    }));
  }

  async addBudgetLineActivities(
    projectId: number,
    budgetId: number,
    lineId: number,
    activityIds: number[],
    userId: number,
  ) {
    await this.getBudget(projectId, budgetId);
    const line = await this.budgetLineRepo.findOne({
      where: { id: lineId, budgetId },
    });
    if (!line) throw new NotFoundException('Budget line not found');

    const uniqueIds = Array.from(
      new Set((activityIds || []).map((id) => Number(id)).filter(Boolean)),
    );
    if (!uniqueIds.length) return { added: 0 };

    const activities = await this.activityRepo.find({
      where: { id: In(uniqueIds), projectId },
      select: ['id'],
    });
    const validIds = activities.map((a) => a.id);
    if (!validIds.length) {
      throw new BadRequestException('No valid activities found for project');
    }

    await this.budgetLineActivityRepo
      .createQueryBuilder()
      .insert()
      .values(
        validIds.map((activityId) => ({
          budgetLineItemId: lineId,
          activityId,
          createdBy: String(userId || 'system'),
        })),
      )
      .orIgnore()
      .execute();

    return { added: validIds.length };
  }

  async removeBudgetLineActivity(
    projectId: number,
    budgetId: number,
    lineId: number,
    activityId: number,
  ) {
    await this.getBudget(projectId, budgetId);
    const line = await this.budgetLineRepo.findOne({
      where: { id: lineId, budgetId },
    });
    if (!line) throw new NotFoundException('Budget line not found');

    const activity = await this.activityRepo.findOne({
      where: { id: activityId, projectId },
      select: ['id'],
    });
    if (!activity) throw new BadRequestException('Activity not found');

    await this.budgetLineActivityRepo.delete({
      budgetLineItemId: lineId,
      activityId,
    });
    return { deleted: true };
  }

  private async parseCsvBuffer(buffer: Buffer): Promise<Record<string, any>[]> {
    return new Promise((resolve, reject) => {
      const rows: Record<string, any>[] = [];
      Readable.from(buffer)
        .pipe(csv())
        .on('data', (data) => rows.push(data))
        .on('end', () => resolve(rows))
        .on('error', reject);
    });
  }

  async importBudgetLines(
    projectId: number,
    budgetId: number,
    fileBuffer: Buffer,
  ) {
    await this.getBudget(projectId, budgetId);
    const rows = await this.parseCsvBuffer(fileBuffer);
    const errors: string[] = [];
    const toSave: BudgetLineItem[] = [];

    const normalizeKey = (key: string) =>
      key.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const normalizedRow: Record<string, any> = {};
      Object.entries(row).forEach(([k, v]) => {
        normalizedRow[normalizeKey(k)] = v;
      });

      const code =
        normalizedRow.code ||
        normalizedRow.budgetlineid ||
        normalizedRow.budgetlinecode ||
        normalizedRow.linecode ||
        '';
      const name =
        normalizedRow.name ||
        normalizedRow.description ||
        normalizedRow.linedescription ||
        '';

      if (!code || !name) {
        errors.push(`Row ${i + 2}: code and name are required.`);
        continue;
      }

      const qty = Number(normalizedRow.qty || normalizedRow.quantity || 0);
      const rate = Number(normalizedRow.rate || 0);
      const amountRaw = normalizedRow.amount;
      const amount =
        amountRaw !== undefined && amountRaw !== ''
          ? Number(amountRaw)
          : qty * rate;

      const line = this.budgetLineRepo.create({
        budgetId,
        code: String(code).trim(),
        name: String(name).trim(),
        category:
          normalizedRow.category !== undefined && normalizedRow.category !== ''
            ? String(normalizedRow.category)
            : null,
        uom:
          normalizedRow.uom !== undefined && normalizedRow.uom !== ''
            ? String(normalizedRow.uom)
            : null,
        qty: Number.isNaN(qty) ? 0 : qty,
        rate: Number.isNaN(rate) ? 0 : rate,
        amount: Number.isNaN(amount) ? 0 : amount,
        notes:
          normalizedRow.notes !== undefined && normalizedRow.notes !== ''
            ? String(normalizedRow.notes)
            : null,
        wbsNodeId: normalizedRow.wbsnodeid
          ? Number(normalizedRow.wbsnodeid)
          : null,
        epsNodeId: normalizedRow.epsnodeid
          ? Number(normalizedRow.epsnodeid)
          : null,
      });
      toSave.push(line);
    }

    if (toSave.length > 0) {
      await this.budgetLineRepo.save(toSave);
    }

    return {
      created: toSave.length,
      errors,
    };
  }

  async createBudgetLine(
    projectId: number,
    budgetId: number,
    body: Partial<BudgetLineItem>,
  ) {
    await this.getBudget(projectId, budgetId);
    const normalized = this.normalizeLinePayload(body);
    const line = this.budgetLineRepo.create({
      budgetId,
      code: normalized.code || '',
      name: normalized.name || '',
      category: normalized.category ?? null,
      uom: normalized.uom ?? null,
      qty: normalized.qty ?? 0,
      rate: normalized.rate ?? 0,
      amount: normalized.amount ?? 0,
      notes: normalized.notes ?? null,
      status: normalized.status || BudgetLineStatus.ACTIVE,
      wbsNodeId: normalized.wbsNodeId ?? null,
      epsNodeId: normalized.epsNodeId ?? null,
    });
    return this.budgetLineRepo.save(line);
  }

  async updateBudgetLine(
    projectId: number,
    budgetId: number,
    lineId: number,
    body: Partial<BudgetLineItem>,
  ) {
    await this.getBudget(projectId, budgetId);
    const line = await this.budgetLineRepo.findOne({
      where: { id: lineId, budgetId },
    });
    if (!line) throw new NotFoundException('Budget line not found');
    const mappingCount = await this.budgetMapRepo.count({
      where: { budgetLineItemId: lineId },
    });
    if (mappingCount > 0) {
      const changingValue =
        body.qty !== undefined ||
        body.rate !== undefined ||
        body.amount !== undefined;
      if (changingValue) {
        throw new BadRequestException(
          'Budget line is mapped to BOQ items. Unmap before editing values.',
        );
      }
    }
    const normalized = this.normalizeLinePayload(body);
    Object.assign(line, normalized);
    if (
      normalized.qty !== undefined ||
      normalized.rate !== undefined ||
      normalized.amount !== undefined
    ) {
      line.amount = Number(line.amount || 0);
    }
    return this.budgetLineRepo.save(line);
  }

  async deleteBudgetLine(
    projectId: number,
    budgetId: number,
    lineId: number,
  ) {
    await this.getBudget(projectId, budgetId);
    const line = await this.budgetLineRepo.findOne({
      where: { id: lineId, budgetId },
    });
    if (!line) throw new NotFoundException('Budget line not found');
    const mappingCount = await this.budgetMapRepo.count({
      where: { budgetLineItemId: lineId },
    });
    if (mappingCount > 0) {
      throw new BadRequestException(
        'Budget line is mapped to BOQ items. Clear mappings before deleting.',
      );
    }
    await this.budgetLineRepo.remove(line);
    return { deleted: true };
  }

  async linkBoqToBudgetLine(
    projectId: number,
    budgetId: number,
    boqItemId: number,
    budgetLineItemId: number,
    userId: number,
  ) {
    await this.getBudget(projectId, budgetId);
    const line = await this.budgetLineRepo.findOne({
      where: { id: budgetLineItemId, budgetId },
    });
    if (!line) throw new BadRequestException('Budget line not found');
    const boqItem = await this.boqItemRepo.findOne({
      where: { id: boqItemId, projectId },
    });
    if (!boqItem) throw new BadRequestException('BOQ item not found');

    boqItem.budgetLineItemId = budgetLineItemId;
    await this.boqItemRepo.save(boqItem);

    await this.budgetMapRepo.delete({ boqItemId });
    const map = this.budgetMapRepo.create({
      budgetLineItemId,
      boqItemId,
      allocationType: BudgetAllocationType.FULL,
      allocationValue: 100,
      createdBy: String(userId || 'system'),
    });
    await this.budgetMapRepo.save(map);

    return { linked: true };
  }

  async getBudgetSummary(projectId: number, budgetId: number) {
    const budget = await this.getBudget(projectId, budgetId);
    const lines = await this.budgetLineRepo.find({ where: { budgetId } });
    const boqItems = await this.boqItemRepo.find({
      where: { projectId },
      select: ['id', 'amount', 'budgetLineItemId', 'boqCode', 'description'],
    });
    const lineIds = lines.map((line) => line.id);
    const activityMaps = lineIds.length
      ? await this.budgetLineActivityRepo.find({
          where: { budgetLineItemId: In(lineIds) },
        })
      : [];
    const activityIds = Array.from(
      new Set(activityMaps.map((m) => m.activityId)),
    );
    const activities = activityIds.length
      ? await this.activityRepo.find({
          where: { id: In(activityIds) },
          select: ['id', 'startDatePlanned', 'finishDatePlanned'],
        })
      : [];
    const activityDateMap = new Map<
      number,
      { start: Date | null; end: Date | null }
    >(
      activities.map((a) => [
        a.id,
        {
          start: a.startDatePlanned ? new Date(a.startDatePlanned) : null,
          end: a.finishDatePlanned ? new Date(a.finishDatePlanned) : null,
        },
      ]),
    );
    const lineActivityMap = new Map<number, number[]>();
    for (const map of activityMaps) {
      if (!lineActivityMap.has(map.budgetLineItemId)) {
        lineActivityMap.set(map.budgetLineItemId, []);
      }
      lineActivityMap.get(map.budgetLineItemId)!.push(map.activityId);
    }

    const spentByBoqId = await this.buildSpentMap(projectId);
    const totalActual = Array.from(spentByBoqId.values()).reduce(
      (s, v) => s + v,
      0,
    );

    const totalBudget = lines.reduce((s, l) => s + Number(l.amount || 0), 0);
    const totalBoq = boqItems.reduce((s, b) => s + Number(b.amount || 0), 0);

    const lineBoqMap = new Map<number, number>();
    const lineActualMap = new Map<number, number>();
    for (const boq of boqItems) {
      if (!boq.budgetLineItemId) continue;
      lineBoqMap.set(
        boq.budgetLineItemId,
        (lineBoqMap.get(boq.budgetLineItemId) || 0) +
          Number(boq.amount || 0),
      );
      const spent = spentByBoqId.get(boq.id) || 0;
      lineActualMap.set(
        boq.budgetLineItemId,
        (lineActualMap.get(boq.budgetLineItemId) || 0) + spent,
      );
    }

    const lineSummary = lines.map((line) => {
      const boqTotal = lineBoqMap.get(line.id) || 0;
      const actual = lineActualMap.get(line.id) || 0;
      const activityIdsForLine = lineActivityMap.get(line.id) || [];
      let timelineStart: Date | null = null;
      let timelineEnd: Date | null = null;
      for (const actId of activityIdsForLine) {
        const dates = activityDateMap.get(actId);
        const start = dates?.start ?? null;
        const end = dates?.end ?? null;
        if (!start || !end) continue;
        if (!timelineStart || start.getTime() < timelineStart.getTime()) {
          timelineStart = start;
        }
        if (!timelineEnd || end.getTime() > timelineEnd.getTime()) {
          timelineEnd = end;
        }
      }
      return {
        id: line.id,
        code: line.code,
        name: line.name,
        category: line.category,
        uom: line.uom,
        qty: Number(line.qty || 0),
        rate: Number(line.rate || 0),
        notes: line.notes,
        status: line.status,
        budgetAmount: Number(line.amount || 0),
        boqAmount: boqTotal,
        consumedBudget: boqTotal,
        availableBudget: Number(line.amount || 0) - boqTotal,
        actualAmount: actual,
        varianceBoq: boqTotal - Number(line.amount || 0),
        varianceActual: actual - Number(line.amount || 0),
        wbsNodeId: line.wbsNodeId,
        epsNodeId: line.epsNodeId,
        activityIds: activityIdsForLine,
        timelineStart: timelineStart ? timelineStart.toISOString() : null,
        timelineEnd: timelineEnd ? timelineEnd.toISOString() : null,
      };
    });

    const costSummary = await this.costService.getSummary(projectId);

    return {
      budget,
      totals: {
        budget: totalBudget,
        boq: totalBoq,
        actual: totalActual,
        varianceBoq: totalBoq - totalBudget,
        varianceActual: totalActual - totalBudget,
      },
      lines: lineSummary,
      byWbs: costSummary.byWbs,
      byVendor: costSummary.byVendor,
      woStatusBreakdown: costSummary.woStatusBreakdown,
    };
  }

  private async buildSpentMap(projectId: number): Promise<Map<number, number>> {
    const records = await this.progressRepo.find({
      where: { projectId, status: ExecutionProgressEntryStatus.APPROVED },
      relations: ['workOrderItem', 'workOrderItem.boqSubItem'],
    });

    const map = new Map<number, number>();
    for (const p of records) {
      const boqItemId = p.workOrderItem?.boqItemId;
      if (!boqItemId) continue;
      const rate =
        Number(p.workOrderItem?.rate || 0) ||
        Number(p.workOrderItem?.boqSubItem?.rate || 0);
      const value = Number(p.enteredQty) * rate;
      map.set(boqItemId, (map.get(boqItemId) || 0) + value);
    }
    return map;
  }
}
