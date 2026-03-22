import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WoActivityPlan } from './entities/wo-activity-plan.entity';
import { WorkOrder } from '../workdoc/entities/work-order.entity';
import { WorkOrderItem } from '../workdoc/entities/work-order-item.entity';
import { WbsNode } from '../wbs/entities/wbs.entity';
import { Activity } from '../wbs/entities/activity.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';
import { BoqSubItem } from '../boq/entities/boq-sub-item.entity';
import { MeasurementProgress } from '../boq/entities/measurement-progress.entity';
import { ScheduleVersion, ScheduleVersionType } from './entities/schedule-version.entity';
import { ActivityVersion } from './entities/activity-version.entity';

// ─── Response Shapes ──────────────────────────────────────────────────────────

export interface CostSummary {
  totalBudget: number;          // sum BoqItem.amount (qty × rate)
  totalContractValue: number;   // sum all ACTIVE WO totalAmount
  spentToDate: number;          // sum BoqSubItem.executedQty × BoqSubItem.rate
  remaining: number;            // contractValue − spentToDate
  percentComplete: number;      // spentToDate / contractValue × 100
  byWbs: WbsCostRow[];
  byVendor: VendorCostRow[];
  woStatusBreakdown: WoStatusRow[];
}

export interface WbsCostRow {
  id: number;
  code: string;
  name: string;
  level: number;
  budget: number;
  contractValue: number;
  spent: number;
}

export interface VendorCostRow {
  vendorId: number;
  vendorName: string;
  vendorCode: string;
  contractValue: number;
  spent: number;
  woCount: number;
}

export interface WoStatusRow {
  status: string;
  count: number;
  totalAmount: number;
}

export interface CashflowMonth {
  month: string;        // "2026-04"
  label: string;        // "Apr 2026"
  planned: number;
  actual: number;
  budget: number;
  cumulativePlanned: number;
  cumulativeActual: number;
}

export interface AopNode {
  id: string;
  label: string;
  code: string;
  type: 'wbs' | 'wo' | 'total';
  level: number;
  budget: number;
  contractValue: number;
  months: Record<string, { planned: number; actual: number }>;
  children?: AopNode[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function monthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
}

/** Enumerate all calendar months between two dates inclusive. */
function monthsBetween(start: Date, end: Date): string[] {
  const months: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= last) {
    months.push(monthKey(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return months.length ? months : [monthKey(start)];
}

@Injectable()
export class CostService {
  constructor(
    @InjectRepository(WoActivityPlan)
    private planRepo: Repository<WoActivityPlan>,
    @InjectRepository(WorkOrder)
    private woRepo: Repository<WorkOrder>,
    @InjectRepository(WorkOrderItem)
    private woItemRepo: Repository<WorkOrderItem>,
    @InjectRepository(WbsNode)
    private wbsRepo: Repository<WbsNode>,
    @InjectRepository(Activity)
    private activityRepo: Repository<Activity>,
    @InjectRepository(BoqItem)
    private boqItemRepo: Repository<BoqItem>,
    @InjectRepository(BoqSubItem)
    private boqSubItemRepo: Repository<BoqSubItem>,
    @InjectRepository(MeasurementProgress)
    private progressRepo: Repository<MeasurementProgress>,
    @InjectRepository(ScheduleVersion)
    private scheduleVersionRepo: Repository<ScheduleVersion>,
    @InjectRepository(ActivityVersion)
    private activityVersionRepo: Repository<ActivityVersion>,
  ) {}

  /**
   * Build a map of boqItemId → total spent amount (₹).
   * Uses the same formula as the Progress module:
   *   sum(MeasurementProgress.executedQty × MeasurementElement.boqSubItem.rate)
   *   for all APPROVED records, grouped by boqItemId.
   * This is the authoritative source — BoqSubItem.executedQty is never updated
   * by the execution service; only MeasurementProgress records are.
   */
  private async buildSpentMap(projectId: number): Promise<Map<number, number>> {
    const records = await this.progressRepo.find({
      where: {
        measurementElement: { projectId } as any,
        status: 'APPROVED',
      },
      relations: ['measurementElement', 'measurementElement.boqSubItem'],
    });

    const map = new Map<number, number>();
    for (const p of records) {
      const boqItemId = p.measurementElement?.boqItemId;
      if (!boqItemId) continue;
      const rate = Number(p.measurementElement?.boqSubItem?.rate || 0);
      const value = Number(p.executedQty) * rate;
      map.set(boqItemId, (map.get(boqItemId) || 0) + value);
    }
    return map;
  }

  /**
   * Build a map of activityId → { start, end } from a specific schedule version
   * or the latest active WORKING schedule if no versionId is provided.
   */
  private async buildActivityDatesMap(
    projectId: number,
    versionId?: number,
  ): Promise<Map<number, { start: Date; end: Date }>> {
    let version: ScheduleVersion | null = null;

    if (versionId) {
      version = await this.scheduleVersionRepo.findOne({
        where: { id: versionId, projectId },
      });
    }

    if (!version) {
      // Latest active WORKING schedule
      version = await this.scheduleVersionRepo.findOne({
        where: { projectId, versionType: ScheduleVersionType.WORKING, isActive: true },
        order: { id: 'DESC' },
      });
    }
    if (!version) {
      // Most recent WORKING version (even if not active)
      version = await this.scheduleVersionRepo.findOne({
        where: { projectId, versionType: ScheduleVersionType.WORKING },
        order: { id: 'DESC' },
      });
    }
    if (!version) return new Map();

    const activityVersions = await this.activityVersionRepo.find({
      where: { versionId: version.id },
      select: ['activityId', 'startDate', 'finishDate'],
    });

    const map = new Map<number, { start: Date; end: Date }>();
    for (const av of activityVersions) {
      if (av.startDate && av.finishDate) {
        map.set(av.activityId, {
          start: new Date(av.startDate),
          end: new Date(av.finishDate),
        });
      }
    }
    return map;
  }

  /** List all schedule versions for the project (for version selector UI). */
  async getScheduleVersions(projectId: number) {
    const versions = await this.scheduleVersionRepo.find({
      where: { projectId },
      order: { id: 'DESC' },
    });
    return versions.map((v) => ({
      id: v.id,
      code: v.versionCode,
      type: v.versionType,
      isActive: v.isActive,
      isLocked: v.isLocked,
      remarks: v.remarks,
      createdOn: v.createdOn,
    }));
  }

  // ── 1. Summary ───────────────────────────────────────────────────────────

  async getSummary(projectId: number): Promise<CostSummary> {
    // Budget = sum of BoqItem.amount (qty × rate at BOQ creation)
    const boqItems = await this.boqItemRepo.find({ where: { projectId } });
    const totalBudget = boqItems.reduce((s, b) => s + Number(b.amount || 0), 0);

    // Spent = sum(BoqSubItem.executedQty × BoqSubItem.rate) — correct sub-item rates
    const spentByBoqId = await this.buildSpentMap(projectId);
    const spentToDate = Array.from(spentByBoqId.values()).reduce((s, v) => s + v, 0);

    // Work Orders: contract value
    const workOrders = await this.woRepo.find({
      where: { projectId },
      relations: ['vendor', 'items'],
    });

    const activeWOs = workOrders.filter((wo) => wo.status === 'ACTIVE');
    const totalContractValue = activeWOs.reduce(
      (s, wo) => s + Number(wo.totalAmount),
      0,
    );

    // WBS nodes
    const wbsNodes = await this.wbsRepo.find({
      where: { projectId },
      order: { wbsLevel: 'ASC', sequenceNo: 'ASC' },
    });

    // Activity plans for WBS/vendor breakdown
    const plans = await this.planRepo.find({
      where: { projectId },
      relations: ['activity', 'activity.wbsNode', 'workOrderItem'],
    });

    // Pre-compute total planned qty per boqItemId (for proportional spend attribution)
    const totalPlannedByBoqId = new Map<number, number>();
    for (const plan of plans) {
      const boqId = plan.workOrderItem?.boqItemId;
      if (!boqId) continue;
      totalPlannedByBoqId.set(
        boqId,
        (totalPlannedByBoqId.get(boqId) || 0) + Number(plan.plannedQuantity || 0),
      );
    }

    // WBS contract value and spent (proportional share per plan)
    const wbsSpent: Record<number, number> = {};
    const wbsContract: Record<number, number> = {};
    for (const plan of plans) {
      const wbsId = plan.activity?.wbsNode?.id;
      if (!wbsId) continue;
      const rate = Number(plan.workOrderItem?.rate || 0);
      const planQty = Number(plan.plannedQuantity || 0);
      wbsContract[wbsId] = (wbsContract[wbsId] || 0) + planQty * rate;

      const boqId = plan.workOrderItem?.boqItemId;
      if (boqId) {
        const totalSpent = spentByBoqId.get(boqId) || 0;
        const totalPlanned = totalPlannedByBoqId.get(boqId) || 0;
        const proportional = totalPlanned > 0 ? (planQty / totalPlanned) * totalSpent : 0;
        wbsSpent[wbsId] = (wbsSpent[wbsId] || 0) + proportional;
      }
    }

    // WBS budget from BOQ items
    const wbsBudget: Record<number, number> = {};
    const seenBoqForWbs = new Set<string>();
    for (const plan of plans) {
      const wbsId = plan.activity?.wbsNode?.id;
      if (!wbsId) continue;
      const boqId = plan.workOrderItem?.boqItemId;
      if (!boqId) continue;
      const key = `${wbsId}-${boqId}`;
      if (seenBoqForWbs.has(key)) continue; // avoid counting same BOQ item twice for same WBS
      seenBoqForWbs.add(key);
      const boq = boqItems.find((b) => b.id === boqId);
      if (boq) {
        wbsBudget[wbsId] = (wbsBudget[wbsId] || 0) + Number(boq.amount || 0);
      }
    }

    const byWbs: WbsCostRow[] = wbsNodes
      .filter((n) => n.wbsLevel <= 2)
      .map((n) => ({
        id: n.id,
        code: n.wbsCode,
        name: n.wbsName,
        level: n.wbsLevel,
        budget: wbsBudget[n.id] || Number(n.budgetedValue || 0),
        contractValue: wbsContract[n.id] || 0,
        spent: wbsSpent[n.id] || 0,
      }));

    // Vendor breakdown — deduplicate boqItemId per vendor to avoid double-counting
    // when multiple WO items across multiple WOs reference the same BOQ item.
    const vendorMap = new Map<
      number,
      { name: string; code: string; cv: number; spent: number; count: number }
    >();
    const vendorBoqSeen = new Map<number, Set<number>>(); // vendorId → seen boqItemIds

    for (const wo of workOrders) {
      if (!wo.vendor) continue;
      const vendorId = wo.vendor.id;
      const entry = vendorMap.get(vendorId) || {
        name: wo.vendor.name,
        code: wo.vendor.vendorCode || '',
        cv: 0,
        spent: 0,
        count: 0,
      };
      entry.cv += Number(wo.totalAmount);
      entry.count += 1;

      if (!vendorBoqSeen.has(vendorId)) vendorBoqSeen.set(vendorId, new Set());
      const seen = vendorBoqSeen.get(vendorId)!;
      for (const item of wo.items || []) {
        if (!item.boqItemId || seen.has(item.boqItemId)) continue;
        seen.add(item.boqItemId);
        entry.spent += spentByBoqId.get(item.boqItemId) || 0;
      }

      vendorMap.set(vendorId, entry);
    }

    const byVendor: VendorCostRow[] = Array.from(vendorMap.entries()).map(
      ([id, v]) => ({
        vendorId: id,
        vendorName: v.name,
        vendorCode: v.code,
        contractValue: v.cv,
        spent: v.spent,
        woCount: v.count,
      }),
    );

    // WO status breakdown
    const statusMap = new Map<string, { count: number; total: number }>();
    for (const wo of workOrders) {
      const e = statusMap.get(wo.status) || { count: 0, total: 0 };
      e.count += 1;
      e.total += Number(wo.totalAmount);
      statusMap.set(wo.status, e);
    }
    const woStatusBreakdown: WoStatusRow[] = Array.from(
      statusMap.entries(),
    ).map(([status, v]) => ({
      status,
      count: v.count,
      totalAmount: v.total,
    }));

    return {
      totalBudget,
      totalContractValue,
      spentToDate,
      remaining: totalContractValue - spentToDate,
      percentComplete:
        totalContractValue > 0
          ? Math.min(100, (spentToDate / totalContractValue) * 100)
          : 0,
      byWbs,
      byVendor,
      woStatusBreakdown,
    };
  }

  // ── 2. Cashflow ─────────────────────────────────────────────────────────

  async getCashflow(
    projectId: number,
    fromMonth?: string,
    toMonth?: string,
    versionId?: number,
  ): Promise<CashflowMonth[]> {
    // Spent per boqItemId using correct sub-item rates
    const spentByBoqId = await this.buildSpentMap(projectId);

    // BOQ items for budget distribution
    const boqItems = await this.boqItemRepo.find({ where: { projectId } });
    const boqMap = new Map(boqItems.map((b) => [b.id, b]));

    // Schedule dates: use specified version or default to latest working schedule
    const scheduleDates = await this.buildActivityDatesMap(projectId, versionId);

    // Activity plans
    const plans = await this.planRepo.find({
      where: { projectId },
      relations: ['activity', 'activity.wbsNode', 'workOrderItem'],
    });

    // Pre-compute total planned qty per boqItemId for proportional actual attribution
    const totalPlannedByBoqId = new Map<number, number>();
    for (const plan of plans) {
      const boqId = plan.workOrderItem?.boqItemId;
      if (!boqId) continue;
      totalPlannedByBoqId.set(
        boqId,
        (totalPlannedByBoqId.get(boqId) || 0) + Number(plan.plannedQuantity || 0),
      );
    }

    const plannedByMonth: Record<string, number> = {};
    const actualByMonth: Record<string, number> = {};

    // Planned: use Activity.budgetedValue (= "Assigned Value") for all activities
    // This covers ALL activities — not just those mapped to WOs via WO Qty Mapper.
    const cashflowActivities = await this.activityRepo.find({
      where: { projectId },
      relations: ['wbsNode'],
    });

    for (const activity of cashflowActivities) {
      const plannedValue = Number(activity.budgetedValue || 0);
      if (plannedValue <= 0) continue;

      // Date resolution: schedule version dates → activity planned dates
      const dates = scheduleDates.get(activity.id);
      const start: Date | null =
        dates?.start ??
        (activity.startDatePlanned ? new Date(activity.startDatePlanned) : null);
      const end: Date | null =
        dates?.end ??
        (activity.finishDatePlanned ? new Date(activity.finishDatePlanned) : null);
      if (!start || !end) continue;

      const months = monthsBetween(start, end);
      const perMonth = plannedValue / months.length;
      for (const mk of months) {
        plannedByMonth[mk] = (plannedByMonth[mk] || 0) + perMonth;
      }
    }

    // Actual: proportional share of sub-item spent per WoActivityPlan record
    for (const plan of plans) {
      const plannedQty = Number(plan.plannedQuantity || 0);

      // Date resolution: working schedule → plan dates → activity dates
      const activityId = plan.activityId;
      const schedDates = activityId ? scheduleDates.get(activityId) : null;

      let start: Date | null = schedDates?.start ?? null;
      let end: Date | null = schedDates?.end ?? null;

      if (!start || !end) {
        if (plan.plannedStart && plan.plannedFinish) {
          start = new Date(plan.plannedStart);
          end = new Date(plan.plannedFinish);
        } else if (
          plan.activity?.startDatePlanned &&
          plan.activity?.finishDatePlanned
        ) {
          start = new Date(plan.activity.startDatePlanned);
          end = new Date(plan.activity.finishDatePlanned);
        }
      }

      // Actual: proportional share of sub-item spent, spread across activity period
      const boqId = plan.workOrderItem?.boqItemId;
      if (boqId && start && end) {
        const totalSpent = spentByBoqId.get(boqId) || 0;
        const totalPlanned = totalPlannedByBoqId.get(boqId) || 0;
        const proportionalActual =
          totalPlanned > 0 ? (plannedQty / totalPlanned) * totalSpent : 0;
        if (proportionalActual > 0) {
          const months = monthsBetween(start, end);
          const perMonth = proportionalActual / months.length;
          for (const mk of months) {
            actualByMonth[mk] = (actualByMonth[mk] || 0) + perMonth;
          }
        }
      }
    }

    // Unlinked WO items: spread across WO validity period
    const mappedItemIds = new Set(plans.map((p) => p.workOrderItemId));
    const workOrders = await this.woRepo.find({
      where: { projectId },
      relations: ['items'],
    });

    for (const wo of workOrders) {
      if (!['ACTIVE', 'DRAFT'].includes(wo.status)) continue;

      const woStart = wo.orderValidityStart
        ? new Date(wo.orderValidityStart)
        : new Date(wo.woDate);
      const woEnd = wo.orderValidityEnd
        ? new Date(wo.orderValidityEnd)
        : new Date(
            new Date(wo.woDate).getFullYear() + 1,
            new Date(wo.woDate).getMonth(),
            1,
          );

      for (const item of wo.items || []) {
        if (mappedItemIds.has(item.id)) continue;
        if (item.isParent) continue;

        const itemAmt = Number(item.amount || 0);
        if (itemAmt <= 0) continue;

        const months = monthsBetween(woStart, woEnd);
        const perMonth = itemAmt / months.length;
        for (const mk of months) {
          plannedByMonth[mk] = (plannedByMonth[mk] || 0) + perMonth;
        }

        // Actual for unlinked items: full sub-item spent (no other plans share it)
        const actualVal = item.boqItemId ? (spentByBoqId.get(item.boqItemId) || 0) : 0;
        if (actualVal > 0) {
          const perMonthA = actualVal / months.length;
          for (const mk of months) {
            actualByMonth[mk] = (actualByMonth[mk] || 0) + perMonthA;
          }
        }
      }
    }

    // BOQ budget per month: spread each plan's BOQ amount across activity dates
    const budgetByMonth: Record<string, number> = {};
    for (const plan of plans) {
      const boqId = plan.workOrderItem?.boqItemId;
      const boq = boqId ? boqMap.get(boqId) : null;
      if (!boq || Number(boq.amount) <= 0) continue;

      const schedDatesB = plan.activityId ? scheduleDates.get(plan.activityId) : null;
      let start: Date | null = schedDatesB?.start ?? null;
      let end: Date | null = schedDatesB?.end ?? null;
      if (!start || !end) {
        if (plan.plannedStart && plan.plannedFinish) {
          start = new Date(plan.plannedStart);
          end = new Date(plan.plannedFinish);
        } else if (plan.activity?.startDatePlanned && plan.activity?.finishDatePlanned) {
          start = new Date(plan.activity.startDatePlanned);
          end = new Date(plan.activity.finishDatePlanned);
        }
      }
      if (!start || !end) continue;

      const months = monthsBetween(start, end);
      const perMonth = Number(boq.amount) / months.length;
      for (const mk of months) {
        budgetByMonth[mk] = (budgetByMonth[mk] || 0) + perMonth;
      }
    }

    // Merge all months and sort
    const allMonths = Array.from(
      new Set([
        ...Object.keys(plannedByMonth),
        ...Object.keys(actualByMonth),
        ...Object.keys(budgetByMonth),
      ]),
    ).sort();

    const filtered = allMonths.filter((mk) => {
      if (fromMonth && mk < fromMonth) return false;
      if (toMonth && mk > toMonth) return false;
      return true;
    });

    let cumPlanned = 0;
    let cumActual = 0;

    return filtered.map((mk) => {
      const planned = Math.round(plannedByMonth[mk] || 0);
      const actual = Math.round(actualByMonth[mk] || 0);
      cumPlanned += planned;
      cumActual += actual;
      return {
        month: mk,
        label: monthLabel(mk),
        planned,
        actual,
        budget: Math.round(budgetByMonth[mk] || 0),
        cumulativePlanned: cumPlanned,
        cumulativeActual: cumActual,
      };
    });
  }

  // ── 3. AOP Table ─────────────────────────────────────────────────────────

  async getAop(
    projectId: number,
    fy?: number,
    versionId?: number,
  ): Promise<AopNode[]> {
    const fyStart = fy ?? new Date().getFullYear();
    const fyFromMonth = `${fyStart}-04`;
    const fyToMonth = `${fyStart + 1}-03`;

    const fyMonths = monthsBetween(
      new Date(fyStart, 3, 1),
      new Date(fyStart + 1, 2, 1),
    );

    const wbsNodes = await this.wbsRepo.find({
      where: { projectId },
      order: { wbsLevel: 'ASC', sequenceNo: 'ASC' },
    });

    // Correct spent per boqItem
    const spentByBoqId = await this.buildSpentMap(projectId);

    // Schedule dates: use specified version or default to latest working schedule
    const scheduleDates = await this.buildActivityDatesMap(projectId, versionId);

    const plans = await this.planRepo.find({
      where: { projectId },
      relations: ['activity', 'activity.wbsNode', 'workOrderItem', 'workOrder', 'workOrder.vendor'],
    });

    // Pre-compute total planned qty per boqItemId for proportional split
    const totalPlannedByBoqId = new Map<number, number>();
    for (const plan of plans) {
      const boqId = plan.workOrderItem?.boqItemId;
      if (!boqId) continue;
      totalPlannedByBoqId.set(
        boqId,
        (totalPlannedByBoqId.get(boqId) || 0) + Number(plan.plannedQuantity || 0),
      );
    }

    const wbsPlanned: Record<number, Record<string, number>> = {};
    const wbsActual: Record<number, Record<string, number>> = {};

    // WBS planned: use Activity.budgetedValue (= "Assigned Value" from Master Schedule)
    // This covers ALL activities — including those not yet mapped to any WO.
    const activities = await this.activityRepo.find({
      where: { projectId },
      relations: ['wbsNode'],
    });

    for (const activity of activities) {
      const wbsId = activity.wbsNode?.id;
      const plannedValue = Number(activity.budgetedValue || 0);
      if (!wbsId || plannedValue <= 0) continue;

      // Date resolution: schedule version dates → activity planned dates
      const dates = scheduleDates.get(activity.id);
      const start: Date | null =
        dates?.start ??
        (activity.startDatePlanned ? new Date(activity.startDatePlanned) : null);
      const end: Date | null =
        dates?.end ??
        (activity.finishDatePlanned ? new Date(activity.finishDatePlanned) : null);
      if (!start || !end) continue;

      const months = monthsBetween(start, end).filter(
        (m) => m >= fyFromMonth && m <= fyToMonth,
      );
      if (!months.length) continue;

      const perMonth = plannedValue / months.length;
      if (!wbsPlanned[wbsId]) wbsPlanned[wbsId] = {};
      for (const mk of months) {
        wbsPlanned[wbsId][mk] = (wbsPlanned[wbsId][mk] || 0) + perMonth;
      }
    }

    // WBS actual: proportional share of sub-item spent (from WoActivityPlan records)
    for (const plan of plans) {
      const wbsId = plan.activity?.wbsNode?.id;
      if (!wbsId) continue;

      const plannedQty = Number(plan.plannedQuantity || 0);

      // Date resolution: working schedule → plan dates → activity dates
      const schedDates = plan.activityId ? scheduleDates.get(plan.activityId) : null;
      let start: Date | null = schedDates?.start ?? null;
      let end: Date | null = schedDates?.end ?? null;
      if (!start || !end) {
        if (plan.plannedStart && plan.plannedFinish) {
          start = new Date(plan.plannedStart);
          end = new Date(plan.plannedFinish);
        } else if (
          plan.activity?.startDatePlanned &&
          plan.activity?.finishDatePlanned
        ) {
          start = new Date(plan.activity.startDatePlanned);
          end = new Date(plan.activity.finishDatePlanned);
        }
      }

      // Actual: proportional share of sub-item spent
      const boqId = plan.workOrderItem?.boqItemId;
      if (boqId && start && end) {
        const totalSpent = spentByBoqId.get(boqId) || 0;
        const totalPlanned = totalPlannedByBoqId.get(boqId) || 0;
        const proportionalActual =
          totalPlanned > 0 ? (plannedQty / totalPlanned) * totalSpent : 0;
        if (proportionalActual > 0) {
          const months = monthsBetween(start, end).filter(
            (m) => m >= fyFromMonth && m <= fyToMonth,
          );
          if (months.length) {
            const perMonth = proportionalActual / months.length;
            if (!wbsActual[wbsId]) wbsActual[wbsId] = {};
            for (const mk of months) {
              wbsActual[wbsId][mk] = (wbsActual[wbsId][mk] || 0) + perMonth;
            }
          }
        }
      }
    }

    // Build node map for rollup
    const nodeMap = new Map<number, WbsNode>();
    for (const n of wbsNodes) nodeMap.set(n.id, n);

    // Roll child values up to parents
    const orderedByLevel = [...wbsNodes].sort((a, b) => b.wbsLevel - a.wbsLevel);
    for (const node of orderedByLevel) {
      if (!node.parentId) continue;
      const childPlanned = wbsPlanned[node.id] || {};
      if (!wbsPlanned[node.parentId]) wbsPlanned[node.parentId] = {};
      for (const [mk, v] of Object.entries(childPlanned)) {
        wbsPlanned[node.parentId][mk] = (wbsPlanned[node.parentId][mk] || 0) + v;
      }
      const childActual = wbsActual[node.id] || {};
      if (!wbsActual[node.parentId]) wbsActual[node.parentId] = {};
      for (const [mk, v] of Object.entries(childActual)) {
        wbsActual[node.parentId][mk] = (wbsActual[node.parentId][mk] || 0) + v;
      }
    }

    // WO-level breakdown under each WBS L1 node
    const wosByWbs: Record<number, WorkOrder[]> = {};
    for (const plan of plans) {
      const wbsId = plan.activity?.wbsNode?.id;
      if (!wbsId || !plan.workOrder) continue;
      let cur = nodeMap.get(wbsId);
      while (cur && cur.wbsLevel > 1 && cur.parentId) {
        cur = nodeMap.get(cur.parentId!);
      }
      if (!cur) continue;
      if (!wosByWbs[cur.id]) wosByWbs[cur.id] = [];
      const already = wosByWbs[cur.id].find((w) => w.id === plan.workOrder.id);
      if (!already) wosByWbs[cur.id].push(plan.workOrder);
    }

    // WO planned/actual per month
    const woPlanned: Record<number, Record<string, number>> = {};
    const woActual: Record<number, Record<string, number>> = {};
    for (const plan of plans) {
      const woId = plan.workOrderId;
      const rate = Number(plan.workOrderItem?.rate || 0);
      const plannedQty = Number(plan.plannedQuantity || 0);
      const plannedValue = plannedQty * rate;

      // Date resolution: working schedule → plan dates → activity dates
      const schedDatesWo = plan.activityId ? scheduleDates.get(plan.activityId) : null;
      let start: Date | null = schedDatesWo?.start ?? null;
      let end: Date | null = schedDatesWo?.end ?? null;
      if (!start || !end) {
        if (plan.plannedStart && plan.plannedFinish) {
          start = new Date(plan.plannedStart);
          end = new Date(plan.plannedFinish);
        } else if (plan.activity?.startDatePlanned && plan.activity?.finishDatePlanned) {
          start = new Date(plan.activity.startDatePlanned);
          end = new Date(plan.activity.finishDatePlanned);
        }
      }

      if (start && end && plannedValue > 0) {
        const months = monthsBetween(start, end).filter(
          (m) => m >= fyFromMonth && m <= fyToMonth,
        );
        if (months.length) {
          const perMonth = plannedValue / months.length;
          if (!woPlanned[woId]) woPlanned[woId] = {};
          for (const mk of months) {
            woPlanned[woId][mk] = (woPlanned[woId][mk] || 0) + perMonth;
          }
        }
      }

      // Actual: proportional share of sub-item spent
      const boqId = plan.workOrderItem?.boqItemId;
      if (boqId && start && end) {
        const totalSpent = spentByBoqId.get(boqId) || 0;
        const totalPlanned = totalPlannedByBoqId.get(boqId) || 0;
        const proportionalActual =
          totalPlanned > 0 ? (plannedQty / totalPlanned) * totalSpent : 0;
        if (proportionalActual > 0) {
          const months = monthsBetween(start, end).filter(
            (m) => m >= fyFromMonth && m <= fyToMonth,
          );
          if (months.length) {
            const perMonth = proportionalActual / months.length;
            if (!woActual[woId]) woActual[woId] = {};
            for (const mk of months) {
              woActual[woId][mk] = (woActual[woId][mk] || 0) + perMonth;
            }
          }
        }
      }
    }

    const makeMonths = (
      planned: Record<string, number>,
      actual: Record<string, number>,
    ) => {
      const out: Record<string, { planned: number; actual: number }> = {};
      for (const mk of fyMonths) {
        out[mk] = {
          planned: Math.round(planned[mk] || 0),
          actual: Math.round(actual[mk] || 0),
        };
      }
      return out;
    };

    const rootNodes = wbsNodes.filter((n) => !n.parentId && n.wbsLevel === 1);

    const aopTree: AopNode[] = rootNodes.map((root) => {
      const woChildren: AopNode[] = (wosByWbs[root.id] || []).map((wo) => ({
        id: `wo-${wo.id}`,
        label: `${wo.vendor?.name || 'Unknown'} — ${wo.woNumber}`,
        code: wo.woNumber,
        type: 'wo' as const,
        level: 2,
        budget: 0,
        contractValue: Number(wo.totalAmount),
        months: makeMonths(woPlanned[wo.id] || {}, woActual[wo.id] || {}),
      }));

      return {
        id: `wbs-${root.id}`,
        label: root.wbsName,
        code: root.wbsCode,
        type: 'wbs' as const,
        level: 1,
        budget: Number(root.budgetedValue || 0),
        contractValue: woChildren.reduce((s, c) => s + c.contractValue, 0),
        months: makeMonths(wbsPlanned[root.id] || {}, wbsActual[root.id] || {}),
        children: woChildren,
      };
    });

    const totalMonths: Record<string, { planned: number; actual: number }> = {};
    for (const mk of fyMonths) {
      totalMonths[mk] = {
        planned: aopTree.reduce((s, n) => s + (n.months[mk]?.planned || 0), 0),
        actual: aopTree.reduce((s, n) => s + (n.months[mk]?.actual || 0), 0),
      };
    }

    const total: AopNode = {
      id: 'total',
      label: 'Grand Total',
      code: 'TOTAL',
      type: 'total',
      level: 0,
      budget: aopTree.reduce((s, n) => s + n.budget, 0),
      contractValue: aopTree.reduce((s, n) => s + n.contractValue, 0),
      months: totalMonths,
    };

    return [total, ...aopTree];
  }
}
