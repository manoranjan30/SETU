import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { BoqImportService } from './boq-import.service';
import { BoqItem, BoqQtyMode } from './entities/boq-item.entity';
import { BoqSubItem } from './entities/boq-sub-item.entity';
import { EpsNode } from '../eps/eps.entity';
import { MeasurementElement } from './entities/measurement-element.entity';
import { BudgetService } from '../planning/budget.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildExcelBuffer(headers: string[], rows: any[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const makeRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockImplementation((dto: any) => ({ ...dto })),
  save: jest.fn().mockImplementation(async (entity: any) => ({ id: 1, ...entity })),
  createQueryBuilder: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ sum: 0, totalQty: 0, totalAmount: 0 }),
  }),
});

const makeBudgetService = () => ({
  getActiveBudget: jest.fn().mockResolvedValue(null),
  listBudgetLines: jest.fn().mockResolvedValue([]),
  linkBoqToBudgetLine: jest.fn().mockResolvedValue(undefined),
});

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('BoqImportService', () => {
  let service: BoqImportService;
  let boqItemRepo: ReturnType<typeof makeRepo>;
  let epsRepo: ReturnType<typeof makeRepo>;
  let measurementRepo: ReturnType<typeof makeRepo>;
  let boqSubItemRepo: ReturnType<typeof makeRepo>;
  let budgetService: ReturnType<typeof makeBudgetService>;

  beforeEach(async () => {
    boqItemRepo = makeRepo();
    epsRepo = makeRepo();
    measurementRepo = makeRepo();
    boqSubItemRepo = makeRepo();
    budgetService = makeBudgetService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoqImportService,
        { provide: getRepositoryToken(BoqItem), useValue: boqItemRepo },
        { provide: getRepositoryToken(EpsNode), useValue: epsRepo },
        { provide: getRepositoryToken(MeasurementElement), useValue: measurementRepo },
        { provide: getRepositoryToken(BoqSubItem), useValue: boqSubItemRepo },
        { provide: BudgetService, useValue: budgetService },
      ],
    }).compile();

    service = module.get<BoqImportService>(BoqImportService);
  });

  // -------------------------------------------------------------------------
  // importBoq — happy path: MAIN_ITEM parsing
  // -------------------------------------------------------------------------

  describe('importBoq — MAIN_ITEM parsing', () => {
    it('parses boqCode, description, UOM from a valid Excel buffer', async () => {
      const headers = ['Row Type', 'Budget Line ID', 'BOQ Code', 'Parent BOQ Code', 'Parent Sub-Item', 'Description', 'Detailed Description', 'UOM', 'Quantity', 'Rate', 'EPS Path', 'Element Name', 'Length', 'Breadth', 'Depth', 'Calculated Qty'];
      const rows = [
        ['MAIN_ITEM', '', 'CIV-001', '', '', 'Earth Work Excavation', 'Foundation work', 'cum', 100, 500, '', '', '', '', '', ''],
      ];
      const buffer = buildExcelBuffer(headers, rows);

      let savedItem: any;
      boqItemRepo.save.mockImplementation(async (entity: any) => {
        savedItem = entity;
        return { id: 10, ...entity };
      });
      boqItemRepo.find.mockResolvedValue([]); // no existing items
      epsRepo.find.mockResolvedValue([]); // no EPS nodes

      const result = await service.importBoq(1, buffer);

      expect(result.newCount).toBe(1);
      expect(result.errorCount).toBe(0);
      expect(savedItem).toBeDefined();
      expect(savedItem.boqCode).toBe('CIV-001');
      expect(savedItem.description).toBe('Earth Work Excavation');
      expect(savedItem.uom).toBe('cum');
    });

    it('coerces quantity and rate to numbers (not strings)', async () => {
      const headers = ['Row Type', 'Budget Line ID', 'BOQ Code', 'Parent BOQ Code', 'Parent Sub-Item', 'Description', 'Detailed Description', 'UOM', 'Quantity', 'Rate', 'EPS Path', 'Element Name', 'Length', 'Breadth', 'Depth', 'Calculated Qty'];
      const rows = [
        // Pass qty and rate as strings in the sheet data
        ['MAIN_ITEM', '', 'CIV-002', '', '', 'PCC Work', '', 'cum', '50', '3500', '', '', '', '', '', ''],
      ];
      const buffer = buildExcelBuffer(headers, rows);

      let savedItem: any;
      boqItemRepo.save.mockImplementation(async (entity: any) => {
        savedItem = entity;
        return { id: 11, ...entity };
      });
      boqItemRepo.find.mockResolvedValue([]);
      epsRepo.find.mockResolvedValue([]);

      await service.importBoq(1, buffer);

      expect(typeof savedItem.qty).toBe('number');
      expect(typeof savedItem.rate).toBe('number');
      expect(savedItem.qty).toBe(50);
      expect(savedItem.rate).toBe(3500);
    });

    it('skips MAIN_ITEM rows where BOQ Code is empty', async () => {
      const headers = ['Row Type', 'Budget Line ID', 'BOQ Code', 'Parent BOQ Code', 'Parent Sub-Item', 'Description', 'Detailed Description', 'UOM', 'Quantity', 'Rate', 'EPS Path', 'Element Name', 'Length', 'Breadth', 'Depth', 'Calculated Qty'];
      const rows = [
        // Empty BOQ code — should be skipped
        ['MAIN_ITEM', '', '', '', '', 'No Code Item', '', 'cum', 10, 100, '', '', '', '', '', ''],
      ];
      const buffer = buildExcelBuffer(headers, rows);
      boqItemRepo.find.mockResolvedValue([]);
      epsRepo.find.mockResolvedValue([]);

      const result = await service.importBoq(1, buffer);

      expect(result.newCount).toBe(0);
      expect(boqItemRepo.save).not.toHaveBeenCalled();
    });

    it('processes multiple MAIN_ITEM rows independently', async () => {
      const headers = ['Row Type', 'Budget Line ID', 'BOQ Code', 'Parent BOQ Code', 'Parent Sub-Item', 'Description', 'Detailed Description', 'UOM', 'Quantity', 'Rate', 'EPS Path', 'Element Name', 'Length', 'Breadth', 'Depth', 'Calculated Qty'];
      const rows = [
        ['MAIN_ITEM', '', 'CIV-001', '', '', 'Item One', '', 'sqm', 10, 200, '', '', '', '', '', ''],
        ['MAIN_ITEM', '', 'CIV-002', '', '', 'Item Two', '', 'cum', 20, 400, '', '', '', '', '', ''],
      ];
      const buffer = buildExcelBuffer(headers, rows);

      const savedItems: any[] = [];
      boqItemRepo.save.mockImplementation(async (entity: any) => {
        savedItems.push({ ...entity });
        return { id: savedItems.length, ...entity };
      });
      boqItemRepo.find.mockResolvedValue([]);
      epsRepo.find.mockResolvedValue([]);

      const result = await service.importBoq(1, buffer);

      expect(result.newCount).toBe(2);
      const codes = savedItems.map((i) => i.boqCode);
      expect(codes).toContain('CIV-001');
      expect(codes).toContain('CIV-002');
    });
  });

  // -------------------------------------------------------------------------
  // importBoq — column mapping
  // -------------------------------------------------------------------------

  describe('importBoq — custom column mapping', () => {
    it('uses mapping to read boqCode from a custom column name', async () => {
      // Non-standard headers
      const headers = ['Type', 'Code', 'Name', 'Unit', 'Qty', 'Price'];
      const rows = [
        ['MAIN_ITEM', 'ARCH-001', 'Plastering', 'sqm', 80, 120],
      ];
      const buffer = buildExcelBuffer(headers, rows);

      // Provide mapping so the service knows which column holds each field
      const mapping = {
        rowType: 'Type',
        boqCode: 'Code',
        description: 'Name',
        uom: 'Unit',
        qty: 'Qty',
        rate: 'Price',
      };

      let savedItem: any;
      boqItemRepo.save.mockImplementation(async (entity: any) => {
        savedItem = entity;
        return { id: 20, ...entity };
      });
      boqItemRepo.find.mockResolvedValue([]);
      epsRepo.find.mockResolvedValue([]);

      const result = await service.importBoq(1, buffer, mapping);

      expect(result.newCount).toBe(1);
      expect(savedItem.boqCode).toBe('ARCH-001');
      expect(savedItem.description).toBe('Plastering');
      expect(savedItem.uom).toBe('sqm');
    });
  });

  // -------------------------------------------------------------------------
  // importBoq — error / edge cases
  // -------------------------------------------------------------------------

  describe('importBoq — error handling', () => {
    it('throws BadRequestException for an empty buffer (less than 2 rows)', async () => {
      // Build a workbook with only a header row (no data)
      const ws = XLSX.utils.aoa_to_sheet([['Row Type', 'BOQ Code']]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const buffer: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      await expect(service.importBoq(1, buffer)).rejects.toThrow(BadRequestException);
      await expect(service.importBoq(1, buffer)).rejects.toThrow('Empty file');
    });

    it('throws when the buffer is corrupted/not a valid xlsx', async () => {
      const corruptBuffer = Buffer.from('this is not a valid xlsx file!!');

      await expect(service.importBoq(1, corruptBuffer)).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // importBoq — dry-run mode
  // -------------------------------------------------------------------------

  describe('importBoq — dryRun mode', () => {
    it('returns preview counts without persisting data', async () => {
      const headers = ['Row Type', 'Budget Line ID', 'BOQ Code', 'Parent BOQ Code', 'Parent Sub-Item', 'Description', 'Detailed Description', 'UOM', 'Quantity', 'Rate', 'EPS Path', 'Element Name', 'Length', 'Breadth', 'Depth', 'Calculated Qty'];
      const rows = [
        ['MAIN_ITEM', '', 'CIV-001', '', '', 'Excavation', '', 'cum', 100, 500, '', '', '', '', '', ''],
        ['SUB_ITEM', '', '', 'CIV-001', '', 'Manual', '', 'cum', 40, 600, '', '', '', '', '', ''],
      ];
      const buffer = buildExcelBuffer(headers, rows);
      epsRepo.find.mockResolvedValue([]);

      const result = await service.importBoq(1, buffer, undefined, undefined, undefined, true);

      // dryRun increments newCount for each recognised row type
      expect(result.newCount).toBe(2);
      // Nothing should be saved
      expect(boqItemRepo.save).not.toHaveBeenCalled();
      expect(boqSubItemRepo.save).not.toHaveBeenCalled();
    });

    it('adds warnings for unknown row types in dryRun', async () => {
      const headers = ['Row Type', 'BOQ Code'];
      const rows = [
        ['UNKNOWN_TYPE', 'X-001'],
      ];
      const buffer = buildExcelBuffer(headers, rows);
      epsRepo.find.mockResolvedValue([]);

      const result = await service.importBoq(1, buffer, undefined, undefined, undefined, true);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('UNKNOWN_TYPE');
    });
  });

  // -------------------------------------------------------------------------
  // importBoq — SUB_ITEM parsing
  // -------------------------------------------------------------------------

  describe('importBoq — SUB_ITEM parsing', () => {
    it('adds an error when parent BOQ code for SUB_ITEM does not exist', async () => {
      const headers = ['Row Type', 'Budget Line ID', 'BOQ Code', 'Parent BOQ Code', 'Parent Sub-Item', 'Description', 'Detailed Description', 'UOM', 'Quantity', 'Rate', 'EPS Path', 'Element Name', 'Length', 'Breadth', 'Depth', 'Calculated Qty'];
      const rows = [
        // SUB_ITEM with a parent that was never declared as MAIN_ITEM in this file
        ['SUB_ITEM', '', '', 'GHOST-999', '', 'Labour', '', 'cum', 10, 100, '', '', '', '', '', ''],
      ];
      const buffer = buildExcelBuffer(headers, rows);
      boqItemRepo.find.mockResolvedValue([]);
      epsRepo.find.mockResolvedValue([]);

      const result = await service.importBoq(1, buffer);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('GHOST-999');
    });

    it('skips SUB_ITEM rows with empty description', async () => {
      const headers = ['Row Type', 'Budget Line ID', 'BOQ Code', 'Parent BOQ Code', 'Parent Sub-Item', 'Description', 'Detailed Description', 'UOM', 'Quantity', 'Rate', 'EPS Path', 'Element Name', 'Length', 'Breadth', 'Depth', 'Calculated Qty'];
      const rows = [
        ['MAIN_ITEM', '', 'CIV-001', '', '', 'Main Item', '', 'cum', 100, 500, '', '', '', '', '', ''],
        // SUB_ITEM with empty description — should be silently skipped
        ['SUB_ITEM', '', '', 'CIV-001', '', '', '', 'cum', 0, 0, '', '', '', '', '', ''],
      ];
      const buffer = buildExcelBuffer(headers, rows);
      boqItemRepo.find.mockResolvedValue([]);
      epsRepo.find.mockResolvedValue([]);

      const savedCalls: any[] = [];
      boqItemRepo.save.mockImplementation(async (entity: any) => {
        savedCalls.push(entity);
        return { id: savedCalls.length, ...entity };
      });
      boqSubItemRepo.find.mockResolvedValue([]);
      boqSubItemRepo.save.mockResolvedValue({});

      const result = await service.importBoq(1, buffer);

      // MAIN_ITEM saved, SUB_ITEM skipped
      expect(boqSubItemRepo.save).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // importBoq — amount computation
  // -------------------------------------------------------------------------

  describe('importBoq — amount computation', () => {
    it('calculates amount as qty * rate for MAIN_ITEM when no active budget', async () => {
      const headers = ['Row Type', 'Budget Line ID', 'BOQ Code', 'Parent BOQ Code', 'Parent Sub-Item', 'Description', 'Detailed Description', 'UOM', 'Quantity', 'Rate', 'EPS Path', 'Element Name', 'Length', 'Breadth', 'Depth', 'Calculated Qty'];
      const rows = [
        ['MAIN_ITEM', '', 'STRUCT-01', '', '', 'Reinforcement', '', 'MT', 5, 80000, '', '', '', '', '', ''],
      ];
      const buffer = buildExcelBuffer(headers, rows);
      boqItemRepo.find.mockResolvedValue([]);
      epsRepo.find.mockResolvedValue([]);

      let savedItem: any;
      boqItemRepo.save.mockImplementation(async (entity: any) => {
        savedItem = entity;
        return { id: 30, ...entity };
      });

      await service.importBoq(1, buffer);

      expect(savedItem.amount).toBe(5 * 80000);
    });
  });

  // -------------------------------------------------------------------------
  // getTemplateBuffer — smoke test
  // -------------------------------------------------------------------------

  describe('getTemplateBuffer', () => {
    it('returns a non-empty Buffer (valid XLSX)', async () => {
      boqItemRepo.find.mockResolvedValue([]);
      measurementRepo.find.mockResolvedValue([]);
      epsRepo.find.mockResolvedValue([]);

      const buffer = await service.getTemplateBuffer();

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // The returned buffer must be parseable as XLSX
      expect(() => XLSX.read(buffer, { type: 'buffer' })).not.toThrow();
    });

    it('template has a "Data Entry" sheet with the expected headers', async () => {
      boqItemRepo.find.mockResolvedValue([]);
      measurementRepo.find.mockResolvedValue([]);
      epsRepo.find.mockResolvedValue([]);

      const buffer = await service.getTemplateBuffer();
      const wb = XLSX.read(buffer, { type: 'buffer' });

      expect(wb.SheetNames).toContain('Data Entry');

      const ws = wb.Sheets['Data Entry'];
      const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
      const firstRow: string[] = rows[0] as string[];

      expect(firstRow).toContain('Row Type');
      expect(firstRow).toContain('BOQ Code');
      expect(firstRow).toContain('Description');
      expect(firstRow).toContain('UOM');
      expect(firstRow).toContain('Quantity');
      expect(firstRow).toContain('Rate');
    });
  });
});
