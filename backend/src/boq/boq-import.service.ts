import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { BoqItem, BoqQtyMode } from './entities/boq-item.entity';
import { BoqSubItem } from './entities/boq-sub-item.entity';
import { EpsNode, EpsNodeType } from '../eps/eps.entity';
import * as csv from 'csv-parser';
import * as XLSX from 'xlsx';
import { Readable } from 'stream';

import { MeasurementElement } from './entities/measurement-element.entity';

@Injectable()
export class BoqImportService {
  constructor(
    @InjectRepository(BoqItem)
    private readonly boqItemRepo: Repository<BoqItem>,
    @InjectRepository(EpsNode)
    private readonly epsRepo: Repository<EpsNode>,
    @InjectRepository(MeasurementElement)
    private readonly measurementRepo: Repository<MeasurementElement>,
    @InjectRepository(BoqSubItem)
    private readonly boqSubItemRepo: Repository<BoqSubItem>, // Injected
  ) { }

  getMeasurementTemplate(): Buffer {
    const headers = [
      'EPS Node ID',
      'EPS Name (Ref)',
      'Element ID/Ref',
      'Element Name',
      'Length',
      'Breadth',
      'Depth',
      'Quantity',
      'Unit',
    ];
    const data = [headers];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      { wch: 15 },
      { wch: 20 },
      { wch: 15 },
      { wch: 30 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 15 },
      { wch: 10 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Measurements');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  async importMeasurements(
    projectId: number,
    boqItemId: number,
    fileBuffer: Buffer,
    mapping?: any,
    defaultEpsId?: number,
    valueMap?: Record<string, number | string>,
    hierarchyMapping?: any,
    boqSubItemId?: number,
  ) {
    console.log(
      `[ImportMeasurements] Starting import for Item ${boqItemId}, SubItem: ${boqSubItemId}`,
    );
    const wb = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

    if (rows.length < 2) {
      console.warn('[ImportMeasurements] Empty file (less than 2 rows)');
      throw new BadRequestException('Empty file');
    }

    const headers = rows[0].map((h: any) => String(h).trim());
    const dataRows = rows.slice(1);

    console.log('[ImportMeasurements] Headers:', headers);
    console.log('[ImportMeasurements] Hierarchy Mapping:', hierarchyMapping);

    const getIndex = (key: string, defaultIdx: number) => {
      if (mapping && mapping[key]) {
        const headerName = mapping[key];
        const idx = headers.findIndex(
          (h) => h.toLowerCase() === headerName.toLowerCase(),
        );
        return idx !== -1 ? idx : defaultIdx;
      }
      return defaultIdx;
    };

    const idxEpsId = getIndex('epsId', 0);
    const idxEpsName = getIndex('epsName', 1);
    const idxElName = getIndex('elementName', 3);
    const idxL = getIndex('length', 4);
    const idxB = getIndex('breadth', 5);
    const idxD = getIndex('depth', 6);
    const idxQty = getIndex('qty', 7);

    // Advanced Fields
    const idxGrid = getIndex('grid', -1);
    const idxLink = getIndex('linkingElement', -1);
    const idxCat = getIndex('elementCategory', -1);
    const idxType = getIndex('elementType', -1);
    const idxUom = getIndex('uom', -1);
    const idxHeight = getIndex('height', -1);
    const idxBottom = getIndex('bottomLevel', -1);
    const idxTop = getIndex('topLevel', -1);
    const idxPerim = getIndex('perimeter', -1);
    const idxBaseArea = getIndex('baseArea', -1);
    const idxPline = getIndex('plineAllLengths', -1);
    const idxCoords = getIndex('baseCoordinates', -1);

    const epsIdsToCheck = new Set<number>();
    const epsNamesToCheck = new Set<string>();

    // Pre-scan for EPS checks
    for (const row of dataRows) {
      if (idxEpsId !== -1 && row[idxEpsId]) {
        const numVal = Number(row[idxEpsId]);
        if (!isNaN(numVal) && numVal !== 0) epsIdsToCheck.add(numVal);
      }
      if (idxEpsName !== -1 && row[idxEpsName]) {
        epsNamesToCheck.add(String(row[idxEpsName]).trim().toLowerCase());
      }
    }

    const validEpsIds = new Set<number>();
    const epsNameMap = new Map<string, number>();

    if (epsIdsToCheck.size > 0) {
      const validEps: EpsNode[] = await this.epsRepo.find({
        where: { id: In(Array.from(epsIdsToCheck)) },
        select: ['id', 'name'],
      });
      validEps.forEach((e) => validEpsIds.add(e.id));
    }

    if (epsNamesToCheck.size > 0 || defaultEpsId) {
      const allNodes: EpsNode[] = await this.epsRepo.find({
        select: ['id', 'name'],
      });
      allNodes.forEach((n) => {
        epsNameMap.set(n.name.toLowerCase().trim(), n.id);
        if (epsIdsToCheck.has(n.id)) validEpsIds.add(n.id);
      });
    }

    let epsNodes: EpsNode[] = [];
    if (hierarchyMapping) {
      epsNodes = await this.epsRepo.find();
    }

    const measurements: MeasurementElement[] = [];
    let skippedCount = 0;

    // Hierarchy Index Map
    let hierarchyIndices: number[] = [];
    if (hierarchyMapping) {
      const getColIndex = (colName: string | undefined): number =>
        colName
          ? headers.findIndex(
            (h) => h.trim().toLowerCase() === colName.trim().toLowerCase(),
          )
          : -1;

      // Look for levels 1 to 5
      hierarchyIndices = [
        getColIndex(hierarchyMapping.level1),
        getColIndex(hierarchyMapping.level2),
        getColIndex(hierarchyMapping.level3),
        getColIndex(hierarchyMapping.level4),
        getColIndex(hierarchyMapping.level5),
      ].filter((idx) => idx !== -1);

      console.log(
        '[ImportMeasurements] Resolved Hierarchy Indices:',
        hierarchyIndices,
      );
    }

    for (const row of dataRows) {
      // Check row limit - skip empty rows?
      if (row.length === 0) continue;

      const rowVal = String(row[idxEpsName] || '').trim();
      let epsId = 0;

      if (hierarchyMapping && hierarchyIndices.length > 0) {
        // Extract values using indices
        const pathValues = hierarchyIndices
          .map((idx) => row[idx])
          .filter(
            (v) => v !== undefined && v !== null && String(v).trim() !== '',
          );
        epsId = await this.resolveEpsPath(projectId, pathValues, epsNodes);
      }

      if (!epsId && valueMap && valueMap[rowVal]) {
        const mappedId = valueMap[rowVal];
        if (mappedId !== 'SKIP') {
          epsId = Number(mappedId);
        } else {
          skippedCount++;
          continue;
        }
      }

      if (!epsId) {
        const currentEpsId = Number(row[idxEpsId]);
        const epsNameRef = String(row[idxEpsName] || '')
          .trim()
          .toLowerCase();

        if (
          currentEpsId &&
          !isNaN(currentEpsId) &&
          validEpsIds.has(currentEpsId)
        ) {
          epsId = currentEpsId;
        } else if (epsNameRef && epsNameMap.has(epsNameRef)) {
          epsId = epsNameMap.get(epsNameRef)!;
        } else if (epsNameRef && epsNameRef.includes('>')) {
          // Detect Path: 'Tower A > Floor 1'
          const parts = epsNameRef.split('>').map(p => p.trim());
          // We need all nodes to resolve path. line 147 fetches all.
          // But validEpsIds logic above might have filtered? 
          // We need full list for path resolution.
          // epsNameMap keys are just names.
          // We need the `allNodes` array from line 147. But scope?
          // I will assume `epsNodes` from line 156 (which is populated if hierarchyMapping). 
          // If not hierarchyMapping, epsNodes might be empty?
          // Line 158: if hierarchyMapping find().
          // I should ensure I have all nodes.
          const nodes = epsNodes.length > 0 ? epsNodes : await this.epsRepo.find();
          epsId = await this.resolveEpsPath(projectId, parts, nodes);
        } else if (defaultEpsId) {
          epsId = defaultEpsId;
        }
      }

      if (!epsId || epsId === 0 || isNaN(epsId)) {
        // If we absolutely cannot find a location, and no default is set, skip.
        if (!defaultEpsId) {
          console.warn(
            `[ImportMeasurements] Row skipped. Invalid EPS ID. Path attempted? ${hierarchyMapping ? 'Yes' : 'No'}.`,
          );
          skippedCount++;
          continue;
        } else {
          epsId = defaultEpsId;
        }
      }

      // Safe helper for numeric fields
      const safeNum = (val: any, fieldName: string): number => {
        if (val === undefined || val === null || val === '') return 0;
        const num = Number(val);
        if (isNaN(num)) return 0;
        return num;
      };

      const m = this.measurementRepo.create({
        projectId: safeNum(projectId, 'projectId'),
        boqItemId: safeNum(boqItemId, 'boqItemId'),
        boqSubItemId: boqSubItemId ? Number(boqSubItemId) : undefined,
        epsNodeId: epsId,
        elementId: `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        elementName: String(row[idxElName] || 'Imported Element').substring(
          0,
          255,
        ),
        elementCategory: idxCat >= 0 ? String(row[idxCat] || '') : undefined,
        elementType: idxType >= 0 ? String(row[idxType] || '') : undefined,
        grid: idxGrid >= 0 ? String(row[idxGrid] || '') : undefined,
        linkingElement: idxLink >= 0 ? String(row[idxLink] || '') : undefined,
        uom: idxUom >= 0 ? String(row[idxUom] || '') : undefined,

        length: safeNum(row[idxL], 'length'),
        breadth: safeNum(row[idxB], 'breadth'),
        depth: safeNum(row[idxD], 'depth'),
        height: idxHeight >= 0 ? safeNum(row[idxHeight], 'height') : 0,
        bottomLevel:
          idxBottom >= 0 ? safeNum(row[idxBottom], 'bottomLevel') : 0,
        topLevel: idxTop >= 0 ? safeNum(row[idxTop], 'topLevel') : 0,
        perimeter: idxPerim >= 0 ? safeNum(row[idxPerim], 'perimeter') : 0,
        baseArea: idxBaseArea >= 0 ? safeNum(row[idxBaseArea], 'baseArea') : 0,

        qty: safeNum(row[idxQty], 'qty'),

        baseCoordinates:
          idxCoords >= 0 ? this.tryParseJson(row[idxCoords]) : undefined,
        plineAllLengths:
          idxPline >= 0 ? this.tryParseJson(row[idxPline]) : undefined,
      });
      measurements.push(m);
    }

    if (measurements.length > 0) {
      await this.measurementRepo.save(measurements);
      console.log(
        `[ImportMeasurements] Saved ${measurements.length} measurements.`,
      );

      if (boqSubItemId) {
        console.log(
          `[ImportMeasurements] Triggering Manual Rollup for SubItem ${boqSubItemId}`,
        );
        const { sum } = await this.measurementRepo
          .createQueryBuilder('m')
          .select('SUM(m.qty)', 'sum')
          .where('m.boqSubItemId = :id', { id: boqSubItemId })
          .getRawOne();

        const totalQty = Number(sum || 0);

        const subItem = await this.boqSubItemRepo.findOne({
          where: { id: boqSubItemId },
          relations: ['boqItem'],
        });
        if (subItem) {
          subItem.qty = totalQty;
          subItem.amount = Number(subItem.qty) * Number(subItem.rate);
          await this.boqSubItemRepo.save(subItem);

          if (subItem.boqItem) {
            const { totalQty: mainQty, totalAmount: mainAmount } =
              await this.boqSubItemRepo
                .createQueryBuilder('s')
                .select('SUM(s.qty)', 'totalQty')
                .addSelect('SUM(s.amount)', 'totalAmount')
                .where('s.boqItemId = :id', { id: subItem.boqItem.id })
                .getRawOne();

            subItem.boqItem.qty = Number(mainQty || 0);
            subItem.boqItem.amount = Number(mainAmount || 0);

            if (subItem.boqItem.qtyMode !== BoqQtyMode.DERIVED) {
              subItem.boqItem.qtyMode = BoqQtyMode.DERIVED;
            }

            await this.boqItemRepo.save(subItem.boqItem);
          }
        }
      }
      return measurements.length;
    }
    console.warn('[ImportMeasurements] No valid measurements to save.');
    return 0;
  }

  getTemplateBuffer(): Buffer {
    // Sheet 1: Blank Data Entry Template
    const headers = [
      'Row Type',
      'BOQ Code',
      'Parent BOQ Code',
      'Parent Sub-Item',
      'Description',
      'Detailed Description',
      'UOM',
      'Quantity',
      'Rate',
      'EPS Path',
      'Element Name',
      'Length',
      'Breadth',
      'Depth',
      'Calculated Qty',
    ];

    // Create Worksheet with Headers
    const ws = XLSX.utils.aoa_to_sheet([headers]);

    // Set Column Widths for better visibility
    ws['!cols'] = [
      { wch: 15 }, // Row Type
      { wch: 15 }, // BOQ Code
      { wch: 15 }, // Parent Code
      { wch: 20 }, // Parent Sub-Item (New)
      { wch: 40 }, // Description
      { wch: 30 }, // Detailed Desc
      { wch: 10 }, // UOM
      { wch: 12 }, // Qty
      { wch: 12 }, // Rate
      { wch: 30 }, // EPS Path
      { wch: 20 }, // Element Name
      { wch: 10 }, // L
      { wch: 10 }, // B
      { wch: 10 }, // D
      { wch: 15 }, // Calc Qty
    ];

    // Sheet 2: Example / Guide
    const exampleHeaders = headers;
    const exampleData = [
      headers,
      ['MAIN_ITEM', 'CIV-001', '', '', 'Earth Work Excavation', 'Excavation for foundation', 'cum', '100', '500', 'Tower A > Basement', '', '', '', '', ''],
      ['SUB_ITEM', '', 'CIV-001', '', 'Manual Excavation', 'Labor work', 'cum', '40', '600', '', '', '', '', '', ''],
      ['MEASUREMENT', '', 'CIV-001', 'Manual Excavation', 'Grid 1-A Pit', '', 'cum', '0', '0', 'Tower A > Basement', 'Pit 1', '2', '2', '1.5', '6'],
      ['MEASUREMENT', '', 'CIV-001', 'Manual Excavation', 'Grid 1-B Pit', '', 'cum', '0', '0', 'Tower A > Basement', 'Pit 2', '2', '2', '1.5', '6'],
      ['MAIN_ITEM', 'CIV-002', '', '', 'PCC Work', 'M10 Grade', 'cum', '50', '3500', 'Tower A > Basement', '', '', '', '', ''],
    ];

    const wsExample = XLSX.utils.aoa_to_sheet(exampleData);
    wsExample['!cols'] = ws['!cols'];

    // Sheet 3: Legend / Instructions
    const legendData = [
      ['Column Name', 'Description', 'Applicable For'],
      ['Row Type', 'Type of row: MAIN_ITEM, SUB_ITEM, or MEASUREMENT', 'All'],
      ['BOQ Code', 'Unique identifier for the main item', 'MAIN_ITEM'],
      ['Parent BOQ Code', 'Links Sub-items/Measurements to a Main Item', 'SUB_ITEM, MEASUREMENT'],
      ['Parent Sub-Item', 'Exact Name of the Sub-item to link Measurement to', 'MEASUREMENT (if child of sub-item)'],
      ['Description', 'Name or Title of the item', 'All'],
      ['UOM', 'Unit of Measurement', 'MAIN_ITEM, SUB_ITEM, MEASUREMENT'],
      ['Quantity', 'Total Quantity Override (Manual)', 'MAIN_ITEM, SUB_ITEM'],
      ['Rate', 'Unit Price', 'MAIN_ITEM, SUB_ITEM'],
      ['EPS Path', 'Location Hierarchy (e.g. Tower A > Floor 1)', 'MAIN_ITEM, MEASUREMENT'],
      ['Element Name', 'Name of the measured element', 'MEASUREMENT'],
      ['Dimensions', 'L, B, D for Calculation', 'MEASUREMENT'],
    ];
    const wsLegend = XLSX.utils.aoa_to_sheet(legendData);
    wsLegend['!cols'] = [{ wch: 20 }, { wch: 50 }, { wch: 30 }];

    // Create Workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Entry');
    XLSX.utils.book_append_sheet(wb, wsExample, 'Example Data');
    XLSX.utils.book_append_sheet(wb, wsLegend, 'Instructions');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  async importBoq(
    projectId: number,
    fileBuffer: Buffer,
    mapping?: any,
    defaultEpsId?: number,
    hierarchyMapping?: any,
    dryRun: boolean = false,
  ) {
    const wb = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

    if (rows.length < 2) throw new BadRequestException('Empty file');

    const headers = rows[0].map((h: any) => String(h).trim());
    const dataRows = rows.slice(1);

    const getIndex = (key: string, defaultName?: string) => {
      let colName = mapping && mapping[key] ? mapping[key] : defaultName;
      if (!colName && defaultName) colName = defaultName;
      if (colName) {
        const idx = headers.findIndex((h) => h.toLowerCase() === colName!.toLowerCase());
        if (idx !== -1) return idx;
        return headers.findIndex((h) => h.toLowerCase().includes(key.toLowerCase()));
      }
      return -1;
    };

    const idxId = getIndex('id', 'ID');
    const idxRowType = getIndex('rowType', 'Row Type');
    const idxCode = getIndex('boqCode', 'BOQ Code');
    const idxParentCode = getIndex('parentBoqCode', 'Parent BOQ Code');
    const idxParentSub = getIndex('parentSubItem', 'Parent Sub-Item'); // New Column Index
    const idxDesc = getIndex('description', 'Description');
    const idxLongDesc = getIndex('longDescription', 'Detailed Description');
    const idxUom = getIndex('uom', 'UOM');
    const idxQty = getIndex('qty', 'Quantity');
    const idxRate = getIndex('rate', 'Rate');
    let idxEpsPath = getIndex('epsPath', 'EPS Path');
    if (idxEpsPath === -1) idxEpsPath = getIndex('epsName', 'EPS Name');
    const idxElName = getIndex('elementName', 'Element Name');
    const idxL = getIndex('length', 'Length');
    const idxB = getIndex('breadth', 'Breadth');
    const idxD = getIndex('depth', 'Depth');
    const idxCalcQty = getIndex('calculatedQty', 'Calculated Qty');

    const allEps = await this.epsRepo.find({ select: ['id', 'name', 'parentId'] });

    // Handle Hierarchy Mapping Indices
    let hierarchyIndices: number[] = [];
    if (hierarchyMapping) {
      const getColIndex = (colName: string | undefined): number =>
        colName
          ? headers.findIndex(
            (h) => h.trim().toLowerCase() === colName.trim().toLowerCase(),
          )
          : -1;

      hierarchyIndices = [
        getColIndex(hierarchyMapping.level1),
        getColIndex(hierarchyMapping.level2),
        getColIndex(hierarchyMapping.level3),
        getColIndex(hierarchyMapping.level4),
        getColIndex(hierarchyMapping.level5),
      ].filter((idx) => idx !== -1);
    }

    const result = {
      newCount: 0,
      updateCount: 0,
      errorCount: 0,
      errors: [] as string[],
      warnings: [] as string[],
      preview: [] as any[]
    };

    // === PASS 1: VALIDATE EPS PATHS ===
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || row.length === 0) continue;
      const pathStr = idxEpsPath !== -1 ? String(row[idxEpsPath] || '').trim() : '';
      if (pathStr && pathStr !== 'undefined' && pathStr !== '') {
        const parts = pathStr.split('>').map(p => p.trim());
        const epsId = await this.resolveEpsPath(projectId, parts, allEps);
        if (!epsId) {
          result.warnings.push(`Row ${i + 2}: EPS Path "${pathStr}" not found. Will use default or root.`);
        }
      } else if (hierarchyIndices.length > 0) {
        // Validation for Hierarchy
        const pathValues = hierarchyIndices
          .map((idx) => row[idx])
          .filter((v) => v !== undefined && v !== null && String(v).trim() !== '');

        if (pathValues.length > 0) {
          const epsId = await this.resolveEpsPath(projectId, pathValues.map(String), allEps);
          if (!epsId) {
            result.warnings.push(`Row ${i + 2}: Hierarchy Path "${pathValues.join(' > ')}" not found.`);
          }
        }
      }
    }

    if (dryRun) {
      // Simple Dry Run Logic
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (!row || row.length === 0) continue;
        const type = String(row[idxRowType] || '').trim().toUpperCase();
        if (['MAIN_ITEM', 'SUB_ITEM', 'MEASUREMENT'].includes(type)) {
          result.newCount++;
        } else {
          result.warnings.push(`Row ${i + 2}: Unknown Row Type "${type}"`);
        }
      }
      return result;
    }

    // === DATA PREP & PERSISTENCE ===
    // 1. Load Existing Items
    const itemCodeMap = new Map<string, BoqItem>();
    const existingItems = await this.boqItemRepo.find({
      where: { projectId },
      loadRelationIds: { relations: ['epsNode'] } // Ensure we get the ID
    });
    existingItems.forEach(i => itemCodeMap.set(i.boqCode, i));

    // 2. Process MAIN_ITEMS first
    for (const row of dataRows) {
      const type = String(row[idxRowType] || '').trim().toUpperCase();
      if (type === 'MAIN_ITEM') {
        const code = String(row[idxCode] || '').trim();
        if (!code) continue;

        let item = itemCodeMap.get(code);
        if (!item) {
          item = this.boqItemRepo.create({
            projectId,
            boqCode: code,
            status: 'IMPORTED'
          });
        }

        // Update fields
        item.description = String(row[idxDesc] || '');
        item.longDescription = idxLongDesc !== -1 ? String(row[idxLongDesc] || '') : '';
        item.uom = String(row[idxUom] || 'set');

        item.qty = Number(row[idxQty] || 0);
        item.rate = Number(row[idxRate] || 0);

        // EPS
        const pathStr = idxEpsPath !== -1 ? String(row[idxEpsPath] || '').trim() : '';
        if (pathStr) {
          const epsId = await this.resolveEpsPath(projectId, pathStr.split('>').map(p => p.trim()), allEps);
          if (epsId) item.epsNodeId = epsId;
        } else if (hierarchyIndices.length > 0) {
          const pathValues = hierarchyIndices
            .map((idx) => row[idx])
            .filter((v) => v !== undefined && v !== null && String(v).trim() !== '');
          if (pathValues.length > 0) {
            const epsId = await this.resolveEpsPath(projectId, pathValues.map(String), allEps);
            if (epsId) item.epsNodeId = epsId;
          } else if (defaultEpsId) {
            item.epsNodeId = defaultEpsId;
          }
        } else if (defaultEpsId) {
          item.epsNodeId = defaultEpsId;
        }

        await this.boqItemRepo.save(item);
        itemCodeMap.set(code, item); // Update map with saved entity (has ID)
        result.newCount++;
      }
    }

    // 3. Process SUB_ITEMS (Require Main Item ID)
    const subItemMap = new Map<string, BoqSubItem>(); // parentCode + desc -> SubItem
    const subItemCodeMap = new Map<string, BoqSubItem>(); // boqCode -> SubItem (New)

    for (const row of dataRows) {
      const type = String(row[idxRowType] || '').trim().toUpperCase();
      if (type === 'SUB_ITEM') {
        const parentCode = String(row[idxParentCode] || '').trim();
        const desc = String(row[idxDesc] || '').trim();
        if (!parentCode || !desc) continue;

        const mainItem = itemCodeMap.get(parentCode);
        if (!mainItem) {
          result.errors.push(`Sub-Item "${desc}": Parent BOQ Code "${parentCode}" not found.`);
          continue;
        }

        const subItem = this.boqSubItemRepo.create({
          boqItem: mainItem,
          description: desc,
          uom: String(row[idxUom] || mainItem.uom),
          qty: Number(row[idxQty] || 0),
          rate: Number(row[idxRate] || mainItem.rate),
          amount: (Number(row[idxQty] || 0)) * (Number(row[idxRate] || mainItem.rate))
        });

        await this.boqSubItemRepo.save(subItem);
        await this.boqSubItemRepo.save(subItem);
        subItemMap.set(`${parentCode}:${desc}`, subItem); // Key for linking measurements

        // Also map by Sub-Item Code if available
        const subCode = String(row[idxCode] || '').trim();
        if (subCode) {
          subItemCodeMap.set(subCode, subItem);
        }

        result.newCount++;
      }
    }

    // 4. Process MEASUREMENTS
    for (const row of dataRows) {
      const type = String(row[idxRowType] || '').trim().toUpperCase();
      if (type === 'MEASUREMENT') {
        const parentCode = String(row[idxParentCode] || '').trim();
        const parentSub = idxParentSub !== -1 ? String(row[idxParentSub] || '').trim() : '';

        if (!parentCode) continue;

        let mainItem: BoqItem | undefined;
        let targetSubItem: BoqSubItem | null | undefined;

        // Try resolving Parent as a Sub-Item first (e.g. 2.2.1 -> Parent 2.2)
        if (subItemCodeMap.has(parentCode)) {
          targetSubItem = subItemCodeMap.get(parentCode);
          if (targetSubItem) {
            mainItem = targetSubItem.boqItem;
          }
        }

        // If not found, assume Parent Code is Main Item (e.g. 2.2.1 -> Parent 2, Sub "Excavation")
        if (!mainItem) {
          mainItem = itemCodeMap.get(parentCode);
        }

        if (!mainItem) continue;

        // If Measurement belongs to a Sub-Item (and not already linked via Code)
        if (parentSub && !targetSubItem) {
          targetSubItem = subItemMap.get(`${parentCode}:${parentSub}`);
          if (!targetSubItem) {
            // Try finding it in DB if not in current batch
            targetSubItem = await this.boqSubItemRepo.findOne({
              where: { boqItem: { id: mainItem.id }, description: parentSub }
            });
          }

          if (!targetSubItem) {
            result.warnings.push(`Measurement "${row[idxElName]}": Parent Sub-Item "${parentSub}" not found under "${parentCode}". Linking to Main Item instead.`);
          }
        }

        // SMART DESCRIPTION MAPPING
        // If Element Name is mapped, use it. If not, fallback to Description column (often used for measurement linkage)
        let elName = 'Measurement';
        if (idxElName !== -1 && row[idxElName]) {
          elName = String(row[idxElName]);
        } else if (idxDesc !== -1 && row[idxDesc]) {
          elName = String(row[idxDesc]);
        }

        const meas = this.measurementRepo.create({
          projectId,
          boqItem: mainItem,
          boqSubItem: targetSubItem || undefined,
          elementName: elName,
          length: Number(row[idxL] || 0),
          breadth: Number(row[idxB] || 0),
          depth: Number(row[idxD] || 0),
          qty: 0, // Will settle below
          uom: String(row[idxUom] || 'set')
        });

        // Quantity Logic:
        // 1. Explicit Calculated Qty Column
        let finalQty = Number(row[idxCalcQty] || 0);

        // 2. If 0, try Auto-Calculation from Dimensions (L*B*D)
        if (finalQty === 0) {
          const l = meas.length || 0;
          const b = meas.breadth || 0;
          const d = meas.depth || 0;
          // Only calculate if at least two dimensions are non-zero (Area/Vol) or L is non-zero (Linear)?
          // Strict interpretation: If L, B, D are provided, multiply them.
          // But if B=0 and D=0, maybe it's just Length?
          // Let's assume standard multiplication if any dimension exists.
          // However, if all are 0, product is 0.
          if (l !== 0 || b !== 0 || d !== 0) {
            finalQty = (l || 1) * (b || 1) * (d || 1);
          }
        }

        // 3. Fallback to "Quantity" Column (Manual Entry) if still 0
        if (finalQty === 0) {
          finalQty = Number(row[idxQty] || 0);
        }

        meas.qty = finalQty;

        // EPS for Measurement
        const pathStr = idxEpsPath !== -1 ? String(row[idxEpsPath] || '').trim() : '';
        let resolvedEpsId: number | undefined;

        if (pathStr) {
          resolvedEpsId = await this.resolveEpsPath(projectId, pathStr.split('>').map(p => p.trim()), allEps);
        } else if (hierarchyIndices.length > 0) {
          const pathValues = hierarchyIndices
            .map((idx) => row[idx])
            .filter((v) => v !== undefined && v !== null && String(v).trim() !== '');
          if (pathValues.length > 0) {
            resolvedEpsId = await this.resolveEpsPath(projectId, pathValues.map(String), allEps);
          }
        }

        // Final Assignment with Logic Flow
        if (resolvedEpsId) {
          meas.epsNodeId = resolvedEpsId;
        } else if (defaultEpsId) {
          meas.epsNodeId = defaultEpsId;
        } else {
          // Inheritance from Main Item (loaded from DB or newly created)
          // Check both epsNodeId property and epsNode relation (which might be an ID if loadRelationIds is true)
          const parentEps = mainItem.epsNode as any;
          if (mainItem.epsNodeId) {
            meas.epsNodeId = mainItem.epsNodeId;
          } else if (parentEps) {
            meas.epsNodeId = typeof parentEps === 'number' ? parentEps : parentEps.id;
          }
        }

        // Absolute Backup: Use Root/First Node if still null
        if (!meas.epsNodeId && allEps.length > 0) {
          meas.epsNodeId = allEps[0].id;
          result.warnings.push(`Measurement "${row[idxElName]}": No EPS found. Fallback to First Available EPS: ${allEps[0].name}`);
        }

        await this.measurementRepo.save(meas);
        result.newCount++;
      }
    }

    // POST-PROCESSING: Recalculate Sub-Item Quantities
    // We iterate over unique Sub-Items touched and sum their measurements
    // We iterate over unique Sub-Items we processed
    const allSubs = Array.from(subItemCodeMap.values());
    for (const sub of allSubs) {
      // Reload with measurements to calculate total
      const freshSub = await this.boqSubItemRepo.findOne({
        where: { id: sub.id },
        relations: ['measurements']
      });

      if (freshSub && freshSub.measurements) {
        const total = freshSub.measurements.reduce((sum, m) => sum + Number(m.qty), 0);
        // Update if difference > epsilon 
        if (Math.abs(freshSub.qty - total) > 0.001) {
          freshSub.qty = total;
          await this.boqSubItemRepo.save(freshSub);
        }
      }
    }

    return {
      newCount: result.newCount,
      updateCount: result.updateCount,
      errorCount: result.errorCount,
      errors: result.errors,
      warnings: result.warnings,
      preview: result.preview
    };
  }

  private async resolveEpsPath(
    projectId: number,
    pathValues: string[],
    allNodes: EpsNode[],
  ): Promise<number> {
    const normalize = (str: any) =>
      String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    if (pathValues.length === 0) return 0;

    console.log(`[ResolveEPS] resolving: ${pathValues.join(' > ')}`);

    // Strategy 1: Identify all potential Root Nodes (Company/Project level)
    const rootNodes = allNodes.filter(n => !n.parentId || n.parentId == 0);

    let startNode: EpsNode | undefined;
    let startIndex = 0;
    const firstVal = normalize(pathValues[0]);

    // Check A: Does path[0] match any Root?
    startNode = rootNodes.find(n => normalize(n.name).includes(firstVal));

    // Check B: Does path[0] match any CHILD of any Root? (Skipped implicit root)
    if (!startNode) {
      for (const root of rootNodes) {
        const children = allNodes.filter(n => n.parentId == root.id);
        const match = children.find(c => normalize(c.name).includes(firstVal));
        if (match) {
          startNode = match;
          startIndex = 1; // We matched path[0] to a child, so next is path[1]
          break;
        }
      }
    }

    // Check C: Does path[1] match any CHILD of any Root? (Skip path[0] as metadata)
    if (!startNode && pathValues.length > 1) {
      const secondVal = normalize(pathValues[1]);
      for (const root of rootNodes) {
        const children = allNodes.filter(n => n.parentId == root.id);
        const match = children.find(c => normalize(c.name).includes(secondVal));
        if (match) {
          startNode = match;
          startIndex = 2; // We matched path[1], so next is path[2]
          break;
        }
      }
    }

    if (!startNode) {
      console.warn(`[ResolveEPS] Failed to find start node for path: ${pathValues.join(' > ')}`);
      return 0; // Fallback to system default
    }

    console.log(`[ResolveEPS] Start Node: ${startNode.name} (Index: ${startIndex})`);
    let currentParentId = startNode.id;
    let resolvedNode = startNode;

    // Traverse remaining path
    for (let i = startIndex; i < pathValues.length; i++) {
      const val = normalize(pathValues[i]);
      if (!val) continue;

      // Find child
      const children = allNodes.filter(n => n.parentId == currentParentId);
      let match = children.find(n => normalize(n.name).includes(val));

      if (match) {
        resolvedNode = match;
        currentParentId = match.id;
      } else {
        console.warn(`[ResolveEPS] Path break at "${pathValues[i]}". Best: ${resolvedNode.name}`);
        break;
      }
    }

    return resolvedNode.id;
  }

  async exportBoqToCsv(projectId: number): Promise<Buffer> {
    const items = await this.boqItemRepo.find({
      where: { projectId },
      relations: {
        epsNode: true,
        subItems: {
          measurements: {
            epsNode: true
          }
        }
      },
      order: { boqCode: 'ASC' },
    });

    // 1. Fetch All EPS Nodes for Path Building
    const allEps = await this.epsRepo.find({ select: ['id', 'name', 'parentId'] });
    const epsMap = new Map<number, EpsNode>();
    allEps.forEach(n => epsMap.set(n.id, n));

    // Helper to build path
    const getEpsPath = (nodeId: number | undefined): string => {
      if (!nodeId) return '';
      let curr = epsMap.get(nodeId);
      const path: string[] = [];
      // Safety depth limit
      let depth = 0;
      while (curr && depth < 20) {
        path.unshift(curr.name);
        if (curr.parentId) curr = epsMap.get(curr.parentId);
        else break;
        depth++;
      }
      return path.join(' > ');
    };

    const headers = [
      'ID',
      'BOQ Code',
      'Parent BOQ Code',
      'Row Type',
      'Description',
      'Detailed Description',
      'UOM',
      'Quantity',
      'Rate',
      'Amount',
      'EPS Path',
      'Element Name',
      'Length',
      'Breadth',
      'Depth',
      'Calculated Qty'
    ];

    const data: any[][] = [headers];

    for (const item of items) {
      // 1. Main Item
      data.push([
        item.id,
        item.boqCode,
        '', // No parent for main item
        'MAIN_ITEM',
        item.description,
        item.longDescription || '',
        item.uom,
        item.qty,
        item.rate,
        item.amount,
        getEpsPath(item.epsNode?.id),
        '', '', '', '', ''
      ]);

      if (item.subItems && item.subItems.length > 0) {
        for (const sub of item.subItems) {
          // 2. Sub Item
          data.push([
            sub.id,
            '', // SubItems don't have their own code usually
            item.boqCode, // Link to parent
            'SUB_ITEM',
            sub.description,
            '',
            sub.uom,
            sub.qty,
            sub.rate,
            sub.amount,
            getEpsPath(item.epsNode?.id),
            '', '', '', '', ''
          ]);

          if (sub.measurements && sub.measurements.length > 0) {
            for (const m of sub.measurements) {
              // 3. Measurement
              data.push([
                m.id,
                '',
                item.boqCode, // Link back to main item (or we could use sub.id if we wanted to be more specific)
                'MEASUREMENT',
                m.elementName || '', // Description for measurement
                '',
                m.uom || sub.uom,
                '',
                '',
                '',
                m.epsNode ? getEpsPath(m.epsNode.id) : getEpsPath(sub.boqItem?.epsNode?.id),
                m.elementName || '',
                m.length,
                m.breadth,
                m.depth,
                m.qty
              ]);
            }
          }
        }
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BOQ Export');
    return XLSX.write(wb, { type: 'buffer', bookType: 'csv' });
  }

  private tryParseJson(val: any): any {
    if (!val) return undefined;
    try {
      if (typeof val === 'string') return JSON.parse(val);
      return val;
    } catch (e) {
      return val;
    }
  }
}
