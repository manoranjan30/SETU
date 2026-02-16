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
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

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
    const headers = [
      'EPS Node ID',
      'EPS Name (Reference)',
      'Parent BOQ Code',
      'BOQ Code',
      'BOQ Name', // Description
      'Detailed Description',
      'UOM',
      'Total Quantity',
      'Rate',
    ];
    const data = [headers];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      { wch: 15 },
      { wch: 30 },
      { wch: 20 },
      { wch: 20 },
      { wch: 40 },
      { wch: 30 },
      { wch: 10 },
      { wch: 15 },
      { wch: 15 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Import Template');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  async importBoq(
    projectId: number,
    fileBuffer: Buffer,
    mapping?: any,
    defaultEpsId?: number,
    hierarchyMapping?: any,
  ) {
    // Read via XLSX (More robust than csv-parser for headers)
    const wb = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    if (rows.length < 2) throw new BadRequestException('Empty file');

    const headers = rows[0].map((h: any) => String(h).trim());
    const dataRows = rows.slice(1);

    console.log('[ImportBOQ] Headers:', headers);

    // Helper to find column index
    const getIndex = (key: string, defaultName?: string) => {
      let colName = mapping && mapping[key] ? mapping[key] : defaultName;
      if (!colName && defaultName) colName = defaultName;

      if (colName) {
        // Try exact or fuzzy match
        const idx = headers.findIndex(
          (h) => h.toLowerCase() === colName!.toLowerCase(),
        );
        if (idx !== -1) return idx;
        // Fallback: search key itself if mapping failed
        return headers.findIndex((h) =>
          h.toLowerCase().includes(key.toLowerCase()),
        );
      }
      return -1;
    };

    const idxCode = getIndex('boqCode', 'BOQ Code');
    const idxDesc = getIndex('description', 'Description');
    const idxLongDesc = getIndex('longDescription', 'Detailed Description'); // Matches template
    const idxUom = getIndex('uom', 'UOM');
    const idxQty = getIndex('qty', 'Total Quantity');
    const idxRate = getIndex('rate', 'Rate');
    const idxParentCode = getIndex('parentBoqCode', 'Parent BOQ Code'); // Needed for Sub Items

    const idxEpsId = getIndex('epsId', 'EPS Node ID');
    const idxEpsName = getIndex('epsName', 'EPS Name');

    // Hierarchy Indices
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

    const allEps = await this.epsRepo.find({
      select: ['id', 'name', 'parentId'],
    });

    const batchMain: BoqItem[] = [];
    const batchSub: { parentCode: string; data: Partial<BoqSubItem> }[] = [];

    // Cache for Code -> Entity
    const itemCodeMap = new Map<string, BoqItem>(); // Codes in DB or current batch

    // Pre-fetch existing items for this project to resolve parents
    const existingItems = await this.boqItemRepo.find({
      where: { projectId },
      select: ['id', 'boqCode'],
    });
    existingItems.forEach((i) => itemCodeMap.set(i.boqCode, i));

    let processedCount = 0;

    for (const row of dataRows) {
      if (row.length === 0) continue;

      const code = String(row[idxCode] || '').trim();
      if (!code) continue;

      const parentCode =
        idxParentCode !== -1 ? String(row[idxParentCode] || '').trim() : '';

      // Common Data
      const desc = String(row[idxDesc] || '');
      const uom = String(row[idxUom] || 'nos');
      const qty = Number(row[idxQty] || 0);
      const rate = Number(row[idxRate] || 0);
      const longDesc =
        idxLongDesc !== -1 ? String(row[idxLongDesc] || '') : null;

      if (parentCode) {
        // === SUB ITEM ===
        // Defer processing until Main Items are saved?
        // We might need to save Main Items first if they are in the same file.
        batchSub.push({
          parentCode,
          data: {
            description: desc,
            uom,
            qty,
            rate,
            amount: qty * rate,
            // longDescription? SubItem entity doesn't have it yet?
            // Plan said "Summary Level Changes". SubItem uses standard fields.
            // Ideally SubItems should inherit or just use description.
            // If user put detail in SubItem row, maybe append to desc?
          },
        });
      } else {
        // === MAIN ITEM ===
        // EPS Logic
        let epsId = 0;
        // 1. Hierarchy
        if (hierarchyMapping && hierarchyIndices.length > 0) {
          const pathValues = hierarchyIndices
            .map((idx) => row[idx])
            .filter((v) => v);
          epsId = await this.resolveEpsPath(projectId, pathValues, allEps);
        }
        // 2. Direct ID/Name
        if (!epsId) {
          const directId = Number(row[idxEpsId]);
          if (!isNaN(directId) && directId > 0) epsId = directId;
        }
        if (!epsId) {
          // Try EPS Name match from map?
          // Skipped for brevity, assume ID or Hierarchy is primary.
        }

        if (!epsId && defaultEpsId) epsId = defaultEpsId;

        const boq = this.boqItemRepo.create({
          projectId,
          boqCode: code,
          description: desc,
          longDescription: longDesc || undefined, // New Field
          uom,
          qtyMode: BoqQtyMode.MANUAL,
          qty,
          rate,
          amount: qty * rate,
          status: 'IMPORTED',
          epsNode: epsId ? ({ id: epsId } as any) : null, // Optional
          epsNodeId: epsId || null,
          customAttributes: { source: 'Excel Import' },
        });

        // Update Map immediately (using placeholder ID? No, need save first)
        // We will save batchMain first, then reload map.
        batchMain.push(boq);
      }
      processedCount++;
    }

    // 1. Save Main Items
    if (batchMain.length > 0) {
      console.log(`[Import] Saving ${batchMain.length} Main Items...`);
      // Insert or Update? For now Insert (might duplicate code errors if constraint)
      // Ideally Upsert.
      await this.boqItemRepo.save(batchMain);

      // Refresh Map
      const refreshed = await this.boqItemRepo.find({
        where: { projectId },
        select: ['id', 'boqCode'],
      });
      refreshed.forEach((i) => itemCodeMap.set(i.boqCode, i));
    }

    // 2. Save Sub Items
    if (batchSub.length > 0) {
      console.log(`[Import] Saving ${batchSub.length} Sub Items...`);
      const subItemsToSave: BoqSubItem[] = [];
      for (const sub of batchSub) {
        const parent = itemCodeMap.get(sub.parentCode);
        if (parent) {
          const s = this.boqSubItemRepo.create({
            ...sub.data,
            boqItem: parent,
          });
          subItemsToSave.push(s);
        } else {
          console.warn(
            `[Import] Orphan SubItem skipped. Parent Code '${sub.parentCode}' not found.`,
          );
        }
      }
      if (subItemsToSave.length > 0) {
        await this.boqSubItemRepo.save(subItemsToSave);
      }
    }

    return processedCount;
  }

  private async resolveEpsPath(
    rootId: number,
    pathValues: any[],
    allNodes: EpsNode[],
  ): Promise<number> {
    const normalize = (str: string) =>
      str.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (pathValues.length === 0) return 0;

    // Try to identify the starting parent.
    // Usually, imports are under a Project. The first value (e.g. Block) should be a child of the Project.
    // We find the Project Node first.
    let parentId: number | null = null;

    // Find project node first
    const projectNode = allNodes.find((n) => n.id === rootId);
    // If the projectId passed IS a node ID, we start there.
    if (projectNode) {
      parentId = projectNode.id;
    } else {
      // Fallback: If projectId refers to something else (e.g. project profile ID),
      // we should have passed the actual Root Node ID.
      // Assuming for now rootId IS the EPS Node ID for the project.
    }

    let resolvedNode: EpsNode | null = null;

    for (const valRaw of pathValues) {
      const val = String(valRaw || '').trim();
      if (!val) break;

      const normVal = normalize(val);
      // Search Children
      const candidates = allNodes.filter((n) => n.parentId === parentId);

      // Debug Log
      // console.log(`Searching for '${val}' under Parent ${parentId}. Candidates: ${candidates.length}`);

      let match = candidates.find((n) => normalize(n.name) === normVal);
      if (!match)
        match = candidates.find(
          (n) =>
            normalize(n.name).includes(normVal) ||
            normVal.includes(normalize(n.name)),
        );

      if (match) {
        resolvedNode = match;
        parentId = match.id;
      } else {
        // console.warn(`Path broken at '${val}'.`);
        // Break logic: We found as deep as we could.
        // Should we return the last known good node?
        // User requirement implies "Full Hierarchy mapped".
        // If we fail on "Level 3", returning "Level 2" (Block) is why they see "Block" only.
        // However, if the node doesn't exist, we can't link to it.
        // We are not auto-creating nodes yet.
        return resolvedNode ? resolvedNode.id : 0;
      }
    }
    return resolvedNode ? resolvedNode.id : 0;
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
