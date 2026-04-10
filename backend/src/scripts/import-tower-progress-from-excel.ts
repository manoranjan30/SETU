import { existsSync } from 'fs';
import { resolve } from 'path';
import * as XLSX from 'xlsx';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { ExecutionService } from '../execution/execution.service';

const PROJECT_ID = 422;
const USER_ID = 1;
const ENTRY_DATE = '2026-03-31';
const DEFAULT_FILE_PATH =
  'C:\\Users\\omano\\Downloads\\Status of tower.xlsx';
const EPSILON = 0.0001;

type DisciplineMeta = {
  label: string;
  suffix: string;
};

type ColumnMeta = DisciplineMeta & {
  wingKey: string;
};

type ParsedCell = {
  floorLabel: string;
  floorNodeName: string;
  activityFloorLabel: string;
  wingKey: string;
  disciplineLabel: string;
  suffix: string;
  percentage: number;
};

type PlanRow = {
  planId: number;
  activityId: number;
  activityName: string;
  wingName: string | null;
  plannedQuantity: number;
};

type FloorRow = {
  id: number;
  name: string;
  wingName: string | null;
};

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\u00A0/g, ' ')
    .trim();
}

function normalizeWingLabel(value: unknown): string | null {
  const text = normalizeText(value).toUpperCase();
  if (!text) return null;
  if (text === 'W-1' || text === 'W1' || text === 'WING 1') return 'Wing_1';
  if (text === 'W-2' || text === 'W2' || text === 'WING 2') return 'Wing_2';
  if (text === 'W-3' || text === 'W3' || text === 'WING 3') return 'Wing_3';
  if (text === 'W-4' || text === 'W4' || text === 'WING 4') return 'Wing_4';
  if (text === 'CLUBHOUSE') return 'Clubhouse';
  return null;
}

function normalizeWingNameFromDb(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  const match = text.match(/^Wing\s+(\d+)$/i);
  if (match) {
    return `Wing_${match[1]}`;
  }
  return text;
}

function normalizeDiscipline(value: unknown): DisciplineMeta | null {
  const text = normalizeText(value).toLowerCase();
  if (!text) return null;
  if (text.includes('structure')) {
    return { label: 'Structure', suffix: 'Str' };
  }
  if (text.includes('finish')) {
    return { label: 'Finishing', suffix: 'Fins' };
  }
  if (text.includes('phe')) {
    return { label: 'PHE', suffix: 'PHE' };
  }
  if (text.includes('elect')) {
    return { label: 'Electrical', suffix: 'Ele' };
  }
  if (text.includes('fire')) {
    return { label: 'Fire', suffix: 'Fire' };
  }
  return null;
}

function ordinal(num: number): string {
  const mod10 = num % 10;
  const mod100 = num % 100;
  if (mod10 === 1 && mod100 !== 11) return `${num}st`;
  if (mod10 === 2 && mod100 !== 12) return `${num}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${num}rd`;
  return `${num}th`;
}

function normalizeFloor(value: unknown): {
  floorLabel: string;
  floorNodeName: string;
  activityFloorLabel: string;
} | null {
  const text = normalizeText(value);
  if (!text) return null;

  if (/^terrace$/i.test(text)) {
    return {
      floorLabel: 'Terrace',
      floorNodeName: 'Terrace',
      activityFloorLabel: 'Terrace',
    };
  }

  if (/^gf$/i.test(text) || /^ground floor$/i.test(text)) {
    return {
      floorLabel: 'GF',
      floorNodeName: 'GF',
      activityFloorLabel: 'GF',
    };
  }

  const match = text.match(/^(\d+)(st|nd|rd|th)?\s*floor$/i);
  if (match) {
    const floorNumber = Number(match[1]);
    const floorLabel = `${ordinal(floorNumber)} Floor`;
    return {
      floorLabel,
      floorNodeName: String(floorNumber),
      activityFloorLabel: floorLabel,
    };
  }

  return null;
}

function parsePercentage(value: unknown): number | null {
  if (value == null || value === '') return null;
  const text = normalizeText(value);
  if (!text || /^na$/i.test(text)) return null;
  const numeric = Number(text);
  if (!Number.isFinite(numeric)) return null;
  if (numeric < 0) return null;
  if (numeric <= 1) return numeric;
  if (numeric <= 100) return numeric / 100;
  return null;
}

function roundQty(value: number): number {
  return Number(value.toFixed(3));
}

function parseWorkbook(filePath: string): ParsedCell[] {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('No worksheet found in the workbook.');
  }

  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(worksheet, {
    header: 1,
    raw: true,
    defval: null,
  });

  const disciplineRow = rows[1] || [];
  const wingRow = rows[2] || [];
  const maxColumns = Math.max(disciplineRow.length, wingRow.length);
  const columnMap = new Map<number, ColumnMeta>();

  let activeDiscipline: DisciplineMeta | null = null;
  for (let column = 4; column < maxColumns; column += 1) {
    const maybeDiscipline = normalizeDiscipline(disciplineRow[column]);
    if (maybeDiscipline) {
      activeDiscipline = maybeDiscipline;
    }
    const wingKey = normalizeWingLabel(wingRow[column]);
    if (activeDiscipline && wingKey) {
      columnMap.set(column, {
        ...activeDiscipline,
        wingKey,
      });
    }
  }

  const parsed: ParsedCell[] = [];
  for (let rowIndex = 3; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    const floor = normalizeFloor(row[1]);
    if (!floor) {
      continue;
    }

    for (const [columnIndex, meta] of columnMap.entries()) {
      const percentage = parsePercentage(row[columnIndex]);
      if (percentage == null) {
        continue;
      }
      parsed.push({
        ...floor,
        wingKey: meta.wingKey,
        disciplineLabel: meta.label,
        suffix: meta.suffix,
        percentage,
      });
    }
  }

  return parsed;
}

async function fetchPlanRows(dataSource: DataSource): Promise<PlanRow[]> {
  const rows = await dataSource.query(
    `
      SELECT
        plan.id AS "planId",
        a.id AS "activityId",
        a."activityName" AS "activityName",
        parent.wbs_name AS "wingName",
        plan."plannedQuantity" AS "plannedQuantity"
      FROM wo_activity_plan plan
      JOIN activity a
        ON a.id = plan.activity_id
      JOIN wbs_node w
        ON w.id = a.wbs_node_id
      LEFT JOIN wbs_node parent
        ON parent.id = w.parent_id
      WHERE a."projectId" = $1
    `,
    [PROJECT_ID],
  );

  return rows.map((row: any) => ({
    planId: Number(row.planId),
    activityId: Number(row.activityId),
    activityName: String(row.activityName),
    wingName: normalizeWingNameFromDb(row.wingName),
    plannedQuantity: Number(row.plannedQuantity || 0),
  }));
}

async function fetchFloorRows(dataSource: DataSource): Promise<FloorRow[]> {
  const rows = await dataSource.query(
    `
      WITH RECURSIVE project_eps AS (
        SELECT id, name, type, "parentId"
        FROM eps_node
        WHERE id = $1

        UNION ALL

        SELECT child.id, child.name, child.type, child."parentId"
        FROM eps_node child
        INNER JOIN project_eps parent
          ON child."parentId" = parent.id
      )
      SELECT
        floor.id,
        floor.name,
        tower.name AS "wingName"
      FROM project_eps floor
      INNER JOIN project_eps tower
        ON tower.id = floor."parentId"
      WHERE floor.type = 'FLOOR'
        AND tower.type = 'TOWER'
    `,
    [PROJECT_ID],
  );

  return rows.map((row: any) => ({
    id: Number(row.id),
    name: String(row.name),
    wingName: normalizeWingNameFromDb(row.wingName),
  }));
}

async function fetchCurrentApprovedTotals(
  dataSource: DataSource,
): Promise<Map<number, number>> {
  const rows = await dataSource.query(
    `
      SELECT
        "woActivityPlanId" AS "planId",
        COALESCE(SUM("enteredQty"), 0) AS total
      FROM execution_progress_entry
      WHERE "projectId" = $1
        AND status != 'REJECTED'
      GROUP BY "woActivityPlanId"
    `,
    [PROJECT_ID],
  );

  const totals = new Map<number, number>();
  for (const row of rows) {
    totals.set(Number(row.planId), Number(row.total || 0));
  }
  return totals;
}

function buildPlanLookup(planRows: PlanRow[]) {
  const lookup = new Map<string, PlanRow[]>();
  for (const row of planRows) {
    const key = `${row.activityName}|${row.wingName || ''}`;
    const bucket = lookup.get(key) || [];
    bucket.push(row);
    lookup.set(key, bucket);
  }
  return lookup;
}

function buildFloorLookup(floorRows: FloorRow[]) {
  const lookup = new Map<string, FloorRow>();
  for (const row of floorRows) {
    const key = `${row.wingName || ''}|${row.name}`;
    lookup.set(key, row);
  }
  return lookup;
}

async function bootstrap() {
  const filePath = resolve(process.argv[2] || DEFAULT_FILE_PATH);
  if (!existsSync(filePath)) {
    throw new Error(`Excel file not found: ${filePath}`);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const dataSource = app.get(DataSource);
    const executionService = app.get(ExecutionService);

    const parsedCells = parseWorkbook(filePath);
    const planRows = await fetchPlanRows(dataSource);
    const floorRows = await fetchFloorRows(dataSource);
    const currentTotals = await fetchCurrentApprovedTotals(dataSource);

    const planLookup = buildPlanLookup(planRows);
    const floorLookup = buildFloorLookup(floorRows);

    const summary = {
      totalNumericCells: parsedCells.length,
      createdEntries: 0,
      skippedNoPlan: 0,
      skippedAmbiguousPlan: 0,
      skippedNoFloor: 0,
      skippedAlreadySatisfied: 0,
      skippedOverComplete: 0,
      skippedNoQty: 0,
      errors: 0,
    };

    const notes: string[] = [];

    for (const cell of parsedCells) {
      if (cell.wingKey === 'Clubhouse') {
        summary.skippedNoPlan += 1;
        notes.push(
          `[skip:no-plan] Clubhouse ${cell.floorLabel} ${cell.disciplineLabel}: no supported plan mapping exists.`,
        );
        continue;
      }

      const activityName = `${cell.activityFloorLabel}_${cell.suffix}`;
      const planKey = `${activityName}|${cell.wingKey}`;
      const planMatches = planLookup.get(planKey) || [];

      if (!planMatches.length) {
        summary.skippedNoPlan += 1;
        notes.push(
          `[skip:no-plan] ${cell.wingKey} ${activityName}: no mapped WO plan found.`,
        );
        continue;
      }

      if (planMatches.length > 1) {
        summary.skippedAmbiguousPlan += 1;
        notes.push(
          `[skip:ambiguous-plan] ${cell.wingKey} ${activityName}: found ${planMatches.length} candidate plans.`,
        );
        continue;
      }

      const plan = planMatches[0];
      const floorKey = `${cell.wingKey}|${cell.floorNodeName}`;
      const floorNode = floorLookup.get(floorKey);

      if (!floorNode) {
        summary.skippedNoFloor += 1;
        notes.push(
          `[skip:no-floor] ${cell.wingKey} ${cell.floorLabel}: EPS floor node not found.`,
        );
        continue;
      }

      const targetQty = roundQty(plan.plannedQuantity * cell.percentage);
      const currentQty = roundQty(currentTotals.get(plan.planId) || 0);
      const deltaQty = roundQty(targetQty - currentQty);

      if (targetQty <= EPSILON) {
        summary.skippedNoQty += 1;
        continue;
      }

      if (deltaQty < -EPSILON) {
        summary.skippedOverComplete += 1;
        notes.push(
          `[skip:over-complete] ${cell.wingKey} ${activityName}: current ${currentQty} is already above target ${targetQty}.`,
        );
        continue;
      }

      if (deltaQty <= EPSILON) {
        summary.skippedAlreadySatisfied += 1;
        continue;
      }

      try {
        await executionService.batchSaveMeasurements(
          PROJECT_ID,
          [
            {
              planId: plan.planId,
              activityId: plan.activityId,
              wbsNodeId: floorNode.id,
              executedQty: deltaQty,
              date: ENTRY_DATE,
              remarks: `One-time import from Status of tower.xlsx (${cell.disciplineLabel} ${cell.wingKey} ${cell.floorLabel} @ ${Math.round(cell.percentage * 100)}%)`,
            },
          ],
          USER_ID,
          true,
        );

        currentTotals.set(plan.planId, roundQty(currentQty + deltaQty));
        summary.createdEntries += 1;
      } catch (error: any) {
        summary.errors += 1;
        notes.push(
          `[error] ${cell.wingKey} ${activityName}: ${error?.message || String(error)}`,
        );
      }
    }

    const approvedCount = await dataSource.query(
      `
        SELECT COUNT(*)::int AS count
        FROM execution_progress_entry
        WHERE "projectId" = $1
      `,
      [PROJECT_ID],
    );

    console.log('--- Tower Progress Import Summary ---');
    console.log(`File: ${filePath}`);
    console.log(`Project: ${PROJECT_ID}`);
    console.log(`Date used: ${ENTRY_DATE}`);
    console.log(summary);
    console.log(
      `Total execution progress entries now in project ${PROJECT_ID}: ${approvedCount[0]?.count ?? 'unknown'}`,
    );

    const interestingNotes = notes.slice(0, 60);
    if (interestingNotes.length) {
      console.log('--- Notes (first 60) ---');
      for (const note of interestingNotes) {
        console.log(note);
      }
      if (notes.length > interestingNotes.length) {
        console.log(`... ${notes.length - interestingNotes.length} more notes omitted.`);
      }
    }
  } finally {
    await app.close();
  }
}

bootstrap().catch((error) => {
  console.error('[import-tower-progress-from-excel] Failed:', error);
  process.exit(1);
});
