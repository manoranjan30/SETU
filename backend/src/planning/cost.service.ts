import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WoActivityPlan } from './entities/wo-activity-plan.entity';
import { WorkOrder } from '../workdoc/entities/work-order.entity';
import { WorkOrderItem } from '../workdoc/entities/work-order-item.entity';
import { WbsNode } from '../wbs/entities/wbs.entity';
import { Activity } from '../wbs/entities/activity.entity';

// ─── Response Shapes ──────────────────────────────────────────────────────────

export interface CostSummary {
  totalBudget: number;          // sum BOQ budgetedValue on WBS nodes
  totalContractValue: number;   // sum all ACTIVE WO totalAmount
  spentToDate: number;          // sum executedQty × rate across all WO items
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
  ) {}

  // ── 1. Summary ───────────────────────────────────────────────────────────

  async getSummary(projectId: number): Promise<CostSummary> {
    // All active WOs for this project
    const workOrders = await this.woRepo.find({
      where: { projectId },
      relations: ['vendor', 'items'],
    });

    const activeWOs = workOrders.filter((wo) => wo.status === 'ACTIVE');

    const totalContractValue = activeWOs.reduce(
      (s, wo) => s + Number(wo.totalAmount),
      0,
    );

    const spentToDate = workOrders.reduce((s, wo) => {
      return (
        s +
        (wo.items || []).reduce((si, item) => {
          return si + Number(item.executedQuantity || 0) * Number(item.rate || 0);
        }, 0)
      );
    }, 0);

    // WBS rollup budget
    const wbsNodes = await this.wbsRepo.find({
      where: { projectId },
      order: { wbsLevel: 'ASC', sequenceNo: 'ASC' },
    });

    const totalBudget = wbsNodes
      .filter((n) => n.wbsLevel === 1)
      .reduce((s, n) => s + Number(n.budgetedValue || 0), 0);

    // WO-based actuals per WBS: join activity plans → activity → wbsNode
    const plans = await this.planRepo.find({
      where: { projectId },
      relations: ['activity', 'workOrderItem'],
    });

    const wbsSpent: Record<number, number> = {};
    const wbsContract: Record<number, number> = {};
    for (const plan of plans) {
      const wbsId = plan.activity?.wbsNodeId;
      if (!wbsId) continue;
      const val =
        Number(plan.plannedQuantity) * Number(plan.workOrderItem?.rate || 0);
      wbsContract[wbsId] = (wbsContract[wbsId] || 0) + val;
      const actualVal =
        Number(plan.workOrderItem?.executedQuantity || 0) *
        Number(plan.workOrderItem?.rate || 0);
      wbsSpent[wbsId] = (wbsSpent[wbsId] || 0) + actualVal;
    }

    const byWbs: WbsCostRow[] = wbsNodes
      .filter((n) => n.wbsLevel <= 2)
      .map((n) => ({
        id: n.id,
        code: n.wbsCode,
        name: n.wbsName,
        level: n.wbsLevel,
        budget: Number(n.budgetedValue || 0),
        contractValue: wbsContract[n.id] || 0,
        spent: wbsSpent[n.id] || 0,
      }));

    // Vendor breakdown
    const vendorMap = new Map<
      number,
      { name: string; code: string; cv: number; spent: number; count: number }
    >();
    for (const wo of workOrders) {
      if (!wo.vendor) continue;
      const entry = vendorMap.get(wo.vendor.id) || {
        name: wo.vendor.name,
        code: wo.vendor.vendorCode || '',
        cv: 0,
        spent: 0,
        count: 0,
      };
      entry.cv += Number(wo.totalAmount);
      entry.count += 1;
      entry.spent += (wo.items || []).reduce(
        (s, i) => s + Number(i.executedQuantity || 0) * Number(i.rate || 0),
        0,
      );
      vendorMap.set(wo.vendor.id, entry);
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
  ): Promise<CashflowMonth[]> {
    // --- Planned spend from WoActivityPlan (mapped activities) ---
    const plans = await this.planRepo.find({
      where: { projectId },
      relations: ['activity', 'workOrderItem'],
    });

    const plannedByMonth: Record<string, number> = {};
    const actualByMonth: Record<string, number> = {};

    for (const plan of plans) {
      const rate = Number(plan.workOrderItem?.rate || 0);
      const plannedQty = Number(plan.plannedQuantity || 0);
      const plannedValue = plannedQty * rate;

      // Determine date range for planned distribution
      let start: Date | null = null;
      let end: Date | null = null;

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

      if (start && end && plannedValue > 0) {
        const months = monthsBetween(start, end);
        const perMonth = plannedValue / months.length;
        for (const mk of months) {
          plannedByMonth[mk] = (plannedByMonth[mk] || 0) + perMonth;
        }
      }

      // Actual: executedQty × rate → current month as proxy
      const executedQty = Number(plan.workOrderItem?.executedQuantity || 0);
      if (executedQty > 0) {
        // Spread actual across planned period proportionally
        const actualValue = executedQty * rate;
        if (start && end) {
          const months = monthsBetween(start, end);
          const perMonth = actualValue / months.length;
          for (const mk of months) {
            actualByMonth[mk] = (actualByMonth[mk] || 0) + perMonth;
          }
        }
      }
    }

    // --- Unlinked WO items: spread across WO validity period ---
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
        if (mappedItemIds.has(item.id)) continue; // already handled above
        if (item.isParent) continue;

        const itemAmt = Number(item.amount || 0);
        if (itemAmt <= 0) continue;

        const months = monthsBetween(woStart, woEnd);
        const perMonth = itemAmt / months.length;
        for (const mk of months) {
          plannedByMonth[mk] = (plannedByMonth[mk] || 0) + perMonth;
        }

        const actualVal =
          Number(item.executedQuantity || 0) * Number(item.rate || 0);
        if (actualVal > 0) {
          const perMonthA = actualVal / months.length;
          for (const mk of months) {
            actualByMonth[mk] = (actualByMonth[mk] || 0) + perMonthA;
          }
        }
      }
    }

    // --- BOQ budget per month from WBS node date ranges ---
    const wbsNodes = await this.wbsRepo.find({ where: { projectId } });
    const budgetByMonth: Record<string, number> = {};
    for (const node of wbsNodes) {
      if (!node.budgetedValue || Number(node.budgetedValue) <= 0) continue;
      const start = node.startDatePlanned
        ? new Date(node.startDatePlanned)
        : null;
      const end = node.finishDatePlanned
        ? new Date(node.finishDatePlanned)
        : null;
      if (!start || !end) continue;
      const months = monthsBetween(start, end);
      const perMonth = Number(node.budgetedValue) / months.length;
      for (const mk of months) {
        budgetByMonth[mk] = (budgetByMonth[mk] || 0) + perMonth;
      }
    }

    // --- Merge all months and sort ---
    const allMonths = Array.from(
      new Set([
        ...Object.keys(plannedByMonth),
        ...Object.keys(actualByMonth),
        ...Object.keys(budgetByMonth),
      ]),
    ).sort();

    // Apply optional range filter
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
    fy?: number, // Financial year start, e.g. 2025 for FY 2025-26
  ): Promise<AopNode[]> {
    // Determine date range for the financial year (Apr → Mar)
    const fyStart = fy ?? new Date().getFullYear();
    const fyFromMonth = `${fyStart}-04`;
    const fyToMonth = `${fyStart + 1}-03`;

    // All months in the FY
    const fyMonths = monthsBetween(
      new Date(fyStart, 3, 1),
      new Date(fyStart + 1, 2, 1),
    );

    // Fetch WBS tree (all levels)
    const wbsNodes = await this.wbsRepo.find({
      where: { projectId },
      order: { wbsLevel: 'ASC', sequenceNo: 'ASC' },
    });

    // Fetch all activity plans with joins
    const plans = await this.planRepo.find({
      where: { projectId },
      relations: ['activity', 'workOrderItem', 'workOrder', 'workOrder.vendor'],
    });

    // Planned & actual per wbsNodeId per month
    const wbsPlanned: Record<number, Record<string, number>> = {};
    const wbsActual: Record<number, Record<string, number>> = {};

    for (const plan of plans) {
      const wbsId = plan.activity?.wbsNodeId;
      if (!wbsId) continue;

      const rate = Number(plan.workOrderItem?.rate || 0);
      const plannedQty = Number(plan.plannedQuantity || 0);
      const plannedValue = plannedQty * rate;

      let start: Date | null = null;
      let end: Date | null = null;

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

      if (start && end && plannedValue > 0) {
        const months = monthsBetween(start, end).filter(
          (m) => m >= fyFromMonth && m <= fyToMonth,
        );
        if (months.length) {
          const perMonth = plannedValue / months.length;
          if (!wbsPlanned[wbsId]) wbsPlanned[wbsId] = {};
          for (const mk of months) {
            wbsPlanned[wbsId][mk] = (wbsPlanned[wbsId][mk] || 0) + perMonth;
          }
        }
      }

      const executedQty = Number(plan.workOrderItem?.executedQuantity || 0);
      if (executedQty > 0 && start && end) {
        const actualValue = executedQty * rate;
        const months = monthsBetween(start, end).filter(
          (m) => m >= fyFromMonth && m <= fyToMonth,
        );
        if (months.length) {
          const perMonth = actualValue / months.length;
          if (!wbsActual[wbsId]) wbsActual[wbsId] = {};
          for (const mk of months) {
            wbsActual[wbsId][mk] = (wbsActual[wbsId][mk] || 0) + perMonth;
          }
        }
      }
    }

    // Build a node map for rollup
    const nodeMap = new Map<number, WbsNode>();
    for (const n of wbsNodes) nodeMap.set(n.id, n);

    // Propagate child values up to parents
    const orderedByLevel = [...wbsNodes].sort(
      (a, b) => b.wbsLevel - a.wbsLevel,
    );
    for (const node of orderedByLevel) {
      if (!node.parentId) continue;
      // Roll planned up
      const childPlanned = wbsPlanned[node.id] || {};
      if (!wbsPlanned[node.parentId]) wbsPlanned[node.parentId] = {};
      for (const [mk, v] of Object.entries(childPlanned)) {
        wbsPlanned[node.parentId][mk] =
          (wbsPlanned[node.parentId][mk] || 0) + v;
      }
      // Roll actual up
      const childActual = wbsActual[node.id] || {};
      if (!wbsActual[node.parentId]) wbsActual[node.parentId] = {};
      for (const [mk, v] of Object.entries(childActual)) {
        wbsActual[node.parentId][mk] = (wbsActual[node.parentId][mk] || 0) + v;
      }
    }

    // Build AOP tree — only top-2 levels for the response
    // WO-level breakdown under each WBS L1 node
    const wosByWbs: Record<number, WorkOrder[]> = {};
    for (const plan of plans) {
      const wbsId = plan.activity?.wbsNodeId;
      if (!wbsId || !plan.workOrder) continue;
      // Find level-1 ancestor of this wbs node
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

      let start: Date | null = null;
      let end: Date | null = null;
      if (plan.plannedStart && plan.plannedFinish) {
        start = new Date(plan.plannedStart);
        end = new Date(plan.plannedFinish);
      } else if (plan.activity?.startDatePlanned && plan.activity?.finishDatePlanned) {
        start = new Date(plan.activity.startDatePlanned);
        end = new Date(plan.activity.finishDatePlanned);
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

      const executedQty = Number(plan.workOrderItem?.executedQuantity || 0);
      if (executedQty > 0 && start && end) {
        const actualValue = executedQty * rate;
        const months = monthsBetween(start, end).filter(
          (m) => m >= fyFromMonth && m <= fyToMonth,
        );
        if (months.length) {
          const perMonth = actualValue / months.length;
          if (!woActual[woId]) woActual[woId] = {};
          for (const mk of months) {
            woActual[woId][mk] = (woActual[woId][mk] || 0) + perMonth;
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

    // Build level-1 WBS nodes with WO children
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

    // Grand total row
    const totalMonths: Record<string, { planned: number; actual: number }> = {};
    for (const mk of fyMonths) {
      totalMonths[mk] = {
        planned: aopTree.reduce(
          (s, n) => s + (n.months[mk]?.planned || 0),
          0,
        ),
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
