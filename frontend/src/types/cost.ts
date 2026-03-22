// ─── Cost Module Types ────────────────────────────────────────────────────────

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

export interface CostSummary {
  totalBudget: number;
  totalContractValue: number;
  spentToDate: number;
  remaining: number;
  percentComplete: number;
  byWbs: WbsCostRow[];
  byVendor: VendorCostRow[];
  woStatusBreakdown: WoStatusRow[];
}

export interface CashflowMonth {
  month: string;             // "2026-04"
  label: string;             // "Apr 2026"
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
