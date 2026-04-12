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
import { BudgetService } from '../planning/budget.service';
import { BudgetLineItem } from '../planning/entities/budget-line-item.entity';
import { forwardRef, Inject } from '@nestjs/common';

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
    @Inject(forwardRef(() => BudgetService))
    private readonly budgetService: BudgetService,
  ) {}

  private async getProjectScopedEpsNodes(projectId: number) {
    const allNodes = await this.epsRepo.find({
      select: ['id', 'name', 'parentId', 'type'],
      order: { id: 'ASC' },
    });

    const nodeMap = new Map<number, EpsNode>();
    const childrenMap = new Map<number, EpsNode[]>();
    allNodes.forEach((node) => {
      nodeMap.set(node.id, node);
      childrenMap.set(node.id, []);
    });
    allNodes.forEach((node) => {
      if (node.parentId && childrenMap.has(node.parentId)) {
        childrenMap.get(node.parentId)!.push(node);
      }
    });

    const projectNode = nodeMap.get(projectId);
    if (!projectNode) {
      throw new NotFoundException('Project EPS node not found');
    }

    const scopedNodes: EpsNode[] = [projectNode];
    const visit = (nodeId: number) => {
      const children = childrenMap.get(nodeId) || [];
      children.forEach((child) => {
        scopedNodes.push(child);
        visit(child.id);
      });
    };
    visit(projectId);

    const buildPath = (nodeId: number) => {
      const parts: string[] = [];
      let current = nodeMap.get(nodeId) || null;
      const visited = new Set<number>();
      while (current && !visited.has(current.id)) {
        parts.unshift(current.name);
        visited.add(current.id);
        current = current.parentId ? nodeMap.get(current.parentId) || null : null;
      }
      return parts.join(' > ');
    };

    const floorNodes = scopedNodes.filter((node) => {
      const children = childrenMap.get(node.id) || [];
      return (
        node.id !== projectId &&
        (node.type === EpsNodeType.FLOOR || children.length === 0)
      );
    });

    return {
      projectNode,
      scopedNodes,
      scopedNodeIds: new Set(scopedNodes.map((node) => node.id)),
      pathById: new Map(scopedNodes.map((node) => [node.id, buildPath(node.id)])),
      floorNodes,
    };
  }

  async getMeasurementTemplate(
    projectId?: number,
    boqItemId?: number,
    boqSubItemId?: number,
  ): Promise<Buffer> {
    const headers = [
      'Parent BOQ Code',
      'Parent Sub-Item',
      'EPS Path',
      'EPS Node ID',
      'EPS Name (Ref)',
      'Element ID/Ref',
      'Element Name',
      'Element Category',
      'Element Type',
      'Grid',
      'Linking Element (3D)',
      'Length',
      'Breadth',
      'Depth',
      'Height',
      'Bottom Level',
      'Top Level',
      'Perimeter',
      'Base Area',
      'Quantity',
      'Unit',
      'Base Coordinates (JSON)',
      'Pline All Lengths',
    ];
    const boqItem =
      projectId && boqItemId
        ? await this.boqItemRepo.findOne({
            where: { id: boqItemId, projectId },
            relations: ['subItems'],
          })
        : null;
    const scopedSubItem =
      boqItem && boqSubItemId
        ? boqItem.subItems?.find((sub) => sub.id === boqSubItemId) || null
        : null;
    const scope =
      projectId ? await this.getProjectScopedEpsNodes(projectId) : null;
    const measurementWhere =
      projectId && boqItemId
        ? {
            projectId,
            boqItemId,
            ...(boqSubItemId ? { boqSubItemId } : {}),
          }
        : null;
    const existingMeasurements = measurementWhere
      ? await this.measurementRepo.find({
          where: measurementWhere,
          order: { id: 'ASC' },
        })
      : [];

    const stringifyJsonCell = (value: unknown) => {
      if (value === undefined || value === null || value === '') return '';
      if (typeof value === 'string') return value;
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    };

    const starterRow = [
      boqItem?.boqCode || '',
      scopedSubItem?.description || '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      scopedSubItem?.uom || boqItem?.uom || '',
      '',
      '',
      '',
    ];

    const measurementRows = existingMeasurements.map((measurement) => [
      boqItem?.boqCode || '',
      scopedSubItem?.description || '',
      scope?.pathById.get(Number(measurement.epsNodeId)) || '',
      measurement.epsNodeId || '',
      (measurement.epsNodeId
        ? scope?.scopedNodes.find((node) => node.id === Number(measurement.epsNodeId))
            ?.name
        : '') || '',
      measurement.elementId || '',
      measurement.elementName || '',
      measurement.elementCategory || '',
      measurement.elementType || '',
      measurement.grid || '',
      measurement.linkingElement || '',
      measurement.length ?? '',
      measurement.breadth ?? '',
      measurement.depth ?? '',
      measurement.height ?? '',
      measurement.bottomLevel ?? '',
      measurement.topLevel ?? '',
      measurement.perimeter ?? '',
      measurement.baseArea ?? '',
      measurement.qty ?? '',
      measurement.uom || scopedSubItem?.uom || boqItem?.uom || '',
      stringifyJsonCell(measurement.baseCoordinates),
      stringifyJsonCell(measurement.plineAllLengths),
    ]);

    const data = [headers, ...measurementRows, starterRow];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      { wch: 18 },
      { wch: 28 },
      { wch: 48 },
      { wch: 15 },
      { wch: 48 },
      { wch: 15 },
      { wch: 30 },
      { wch: 22 },
      { wch: 22 },
      { wch: 12 },
      { wch: 20 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
      { wch: 10 },
      { wch: 28 },
      { wch: 28 },
    ];

    const boqReference = [
      ['Parent BOQ Code', 'BOQ Description', 'Parent Sub-Item', 'UOM'],
      ...(boqItem
        ? (boqItem.subItems?.length
            ? boqItem.subItems.map((sub) => [
                boqItem.boqCode,
                boqItem.description,
                sub.description,
                sub.uom || boqItem.uom || '',
              ])
            : [[boqItem.boqCode, boqItem.description, '', boqItem.uom || '']])
        : []),
    ];
    const wsBoqRef = XLSX.utils.aoa_to_sheet(boqReference);
    wsBoqRef['!cols'] = [
      { wch: 18 },
      { wch: 40 },
      { wch: 28 },
      { wch: 10 },
    ];

    const epsReference = [
      ['EPS Node ID', 'EPS Name', 'EPS Path', 'EPS Type'],
      ...((scope?.floorNodes || []).map((node) => [
        node.id,
        node.name,
        scope?.pathById.get(node.id) || node.name,
        node.type || '',
      ]) as any[]),
    ];
    const wsEpsRef = XLSX.utils.aoa_to_sheet(epsReference);
    wsEpsRef['!cols'] = [
      { wch: 14 },
      { wch: 24 },
      { wch: 52 },
      { wch: 14 },
    ];

    const instructions = [
      ['Field', 'How to use'],
      ['Parent BOQ Code', 'Use the opened BOQ item code shown in the BOQ Reference sheet.'],
      ['Parent Sub-Item', 'Use the exact sub-item description from the BOQ Reference sheet.'],
      ['EPS Path', 'Preferred location field. Use the project-scoped floor path from EPS Floor Reference.'],
      ['EPS Node ID', 'Optional fallback if you want to use ids directly.'],
      ['Element Name', 'Required measurement description.'],
      ['Quantity', 'Used directly when provided. If blank/0, dimensions can still drive quantity.'],
      ['Dimensions', 'Length/Breadth/Depth can be used to derive quantity when needed.'],
    ];
    const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
    wsInstructions['!cols'] = [{ wch: 24 }, { wch: 72 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Measurements');
    XLSX.utils.book_append_sheet(wb, wsBoqRef, 'BOQ Reference');
    XLSX.utils.book_append_sheet(wb, wsEpsRef, 'EPS Floor Reference');
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');
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

    const findHeaderIndex = (...labels: string[]) =>
      headers.findIndex((h) =>
        labels.some((label) => h.trim().toLowerCase() === label.toLowerCase()),
      );

    const idxEpsId = getIndex('epsId', 3);
    const idxEpsName = getIndex('epsName', 4);
    const idxEpsPath = getIndex(
      'epsPath',
      findHeaderIndex('EPS Path', 'Location / EPS Name'),
    );
    const idxParentBoqCode = getIndex(
      'parentBoqCode',
      findHeaderIndex('Parent BOQ Code'),
    );
    const idxParentSubItem = getIndex(
      'parentSubItem',
      findHeaderIndex('Parent Sub-Item'),
    );
    const idxElName = getIndex('elementName', 6);
    const idxL = getIndex('length', 11);
    const idxB = getIndex('breadth', 12);
    const idxD = getIndex('depth', 13);
    const idxQty = getIndex('qty', 19);

    // Advanced Fields
    const idxGrid = getIndex('grid', 9);
    const idxLink = getIndex('linkingElement', 10);
    const idxCat = getIndex('elementCategory', 7);
    const idxType = getIndex('elementType', 8);
    const idxUom = getIndex('uom', 20);
    const idxHeight = getIndex('height', 14);
    const idxBottom = getIndex('bottomLevel', 15);
    const idxTop = getIndex('topLevel', 16);
    const idxPerim = getIndex('perimeter', 17);
    const idxBaseArea = getIndex('baseArea', 18);
    const idxPline = getIndex('plineAllLengths', 22);
    const idxCoords = getIndex('baseCoordinates', 21);

    const currentBoqItem = await this.boqItemRepo.findOne({
      where: { id: boqItemId, projectId },
      relations: ['subItems'],
    });
    if (!currentBoqItem) {
      throw new NotFoundException('BOQ item not found in this project');
    }

    const selectedSubItem = boqSubItemId
      ? (currentBoqItem.subItems || []).find((sub) => sub.id === boqSubItemId) ||
        null
      : null;
    if (boqSubItemId && !selectedSubItem) {
      throw new NotFoundException('Selected BOQ sub-item not found under this BOQ item');
    }

    const scopedEps = await this.getProjectScopedEpsNodes(projectId);
    const scopedNodeIds = scopedEps.scopedNodeIds;
    const scopedNodes = scopedEps.scopedNodes;
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
      if (idxEpsPath !== -1 && row[idxEpsPath]) {
        epsNamesToCheck.add(String(row[idxEpsPath]).trim().toLowerCase());
      }
    }

    const validEpsIds = new Set<number>();
    const epsNameMap = new Map<string, number>();
    const epsPathMap = new Map<string, number>();
    const epsLeafNameMap = new Map<string, number[]>();

    if (epsIdsToCheck.size > 0) {
      Array.from(epsIdsToCheck)
        .filter((id) => scopedNodeIds.has(id))
        .forEach((id) => validEpsIds.add(id));
    }

    if (epsNamesToCheck.size > 0 || defaultEpsId || scopedNodes.length > 0) {
      scopedNodes.forEach((n) => {
        const normalizedName = n.name.toLowerCase().trim();
        epsNameMap.set(normalizedName, n.id);
        const path = scopedEps.pathById.get(n.id) || n.name;
        epsPathMap.set(path.toLowerCase().trim(), n.id);
        const existing = epsLeafNameMap.get(normalizedName) || [];
        existing.push(n.id);
        epsLeafNameMap.set(normalizedName, existing);
        if (epsIdsToCheck.has(n.id)) validEpsIds.add(n.id);
      });
    }

    let epsNodes: EpsNode[] = hierarchyMapping ? scopedNodes : [];

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
      const rowPathVal =
        idxEpsPath !== -1 ? String(row[idxEpsPath] || '').trim() : rowVal;
      let epsId = 0;

      const rowParentBoqCode =
        idxParentBoqCode !== -1 ? String(row[idxParentBoqCode] || '').trim() : '';
      const rowParentSubItem =
        idxParentSubItem !== -1 ? String(row[idxParentSubItem] || '').trim() : '';

      if (rowParentBoqCode && rowParentBoqCode !== currentBoqItem.boqCode) {
        console.warn(
          `[ImportMeasurements] Row skipped. Parent BOQ Code "${rowParentBoqCode}" does not match opened BOQ "${currentBoqItem.boqCode}".`,
        );
        skippedCount++;
        continue;
      }

      if (
        selectedSubItem &&
        rowParentSubItem &&
        rowParentSubItem.toLowerCase().trim() !==
          selectedSubItem.description.toLowerCase().trim()
      ) {
        console.warn(
          `[ImportMeasurements] Row skipped. Parent Sub-Item "${rowParentSubItem}" does not match opened sub-item "${selectedSubItem.description}".`,
        );
        skippedCount++;
        continue;
      }

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
        const epsPathRef = rowPathVal.trim().toLowerCase();

        if (
          currentEpsId &&
          !isNaN(currentEpsId) &&
          validEpsIds.has(currentEpsId)
        ) {
          epsId = currentEpsId;
        } else if (epsPathRef && epsPathMap.has(epsPathRef)) {
          epsId = epsPathMap.get(epsPathRef)!;
        } else if (epsNameRef && epsNameMap.has(epsNameRef)) {
          epsId = epsNameMap.get(epsNameRef)!;
        } else if (
          epsNameRef &&
          epsLeafNameMap.has(epsNameRef) &&
          (epsLeafNameMap.get(epsNameRef) || []).length === 1
        ) {
          epsId = (epsLeafNameMap.get(epsNameRef) || [0])[0];
        } else if (epsNameRef && epsNameRef.includes('>')) {
          const parts = epsNameRef.split('>').map((p) => p.trim());
          epsId = await this.resolveEpsPath(projectId, parts, scopedNodes);
        } else if (epsPathRef && epsPathRef.includes('>')) {
          const parts = epsPathRef.split('>').map((p) => p.trim());
          epsId = await this.resolveEpsPath(projectId, parts, scopedNodes);
        } else if (defaultEpsId) {
          epsId = scopedNodeIds.has(defaultEpsId) ? defaultEpsId : 0;
        }
      }

      if (!epsId || epsId === 0 || isNaN(epsId)) {
        console.warn(
          `[ImportMeasurements] Row skipped. EPS location "${rowPathVal || rowVal || row[idxEpsId] || ''}" was not found inside the opened project.`,
        );
        skippedCount++;
        continue;
      }

      // Safe helper for numeric fields
      const safeNum = (val: any, fieldName: string): number => {
        if (val === undefined || val === null || val === '') return 0;
        const num = Number(val);
        if (isNaN(num)) return 0;
        return num;
      };

      const elementName = String(row[idxElName] || 'Imported Element').trim();
      if (!elementName) {
        console.warn('[ImportMeasurements] Row skipped. Element Name is required.');
        skippedCount++;
        continue;
      }

      const m = this.measurementRepo.create({
        projectId: safeNum(projectId, 'projectId'),
        boqItemId: safeNum(boqItemId, 'boqItemId'),
        boqSubItemId: selectedSubItem ? Number(selectedSubItem.id) : undefined,
        epsNodeId: epsId,
        elementId: `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        elementName: elementName.substring(0, 255),
        elementCategory: idxCat >= 0 ? String(row[idxCat] || '') : undefined,
        elementType: idxType >= 0 ? String(row[idxType] || '') : undefined,
        grid: idxGrid >= 0 ? String(row[idxGrid] || '') : undefined,
        linkingElement: idxLink >= 0 ? String(row[idxLink] || '') : undefined,
        uom:
          (idxUom >= 0 ? String(row[idxUom] || '').trim() : '') ||
          selectedSubItem?.uom ||
          currentBoqItem.uom ||
          undefined,

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

  async getTemplateBuffer(projectId?: number): Promise<Buffer> {
    // Sheet 1: Data Entry Template / Round-trip Export
    const headers = [
      'Row Type',
      'Budget Line ID',
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

    const normalizeNumberCell = (value: unknown) =>
      value === null || value === undefined || value === '' ? '' : Number(value);

    const scope = projectId
      ? await this.getProjectScopedEpsNodes(projectId)
      : null;
    const pathById = scope?.pathById || new Map<number, string>();

    const projectItems = projectId
      ? await this.boqItemRepo.find({
          where: { projectId },
          relations: ['epsNode', 'subItems'],
          order: { boqCode: 'ASC', id: 'ASC' },
        })
      : [];
    const projectMeasurements = projectId
      ? await this.measurementRepo.find({
          where: { projectId },
          relations: ['boqItem', 'boqSubItem', 'epsNode'],
          order: { id: 'ASC' },
        })
      : [];

    const measurementsByItem = new Map<number, MeasurementElement[]>();
    const measurementsBySubItem = new Map<number, MeasurementElement[]>();
    projectMeasurements.forEach((measurement) => {
      if (measurement.boqSubItemId) {
        const bucket = measurementsBySubItem.get(measurement.boqSubItemId) || [];
        bucket.push(measurement);
        measurementsBySubItem.set(measurement.boqSubItemId, bucket);
      } else {
        const bucket = measurementsByItem.get(measurement.boqItemId) || [];
        bucket.push(measurement);
        measurementsByItem.set(measurement.boqItemId, bucket);
      }
    });

    const exportRows: any[][] = [];
    projectItems.forEach((item) => {
      exportRows.push([
        'MAIN_ITEM',
        item.budgetLineItemId || '',
        item.boqCode || '',
        '',
        '',
        item.description || '',
        item.longDescription || '',
        item.uom || '',
        normalizeNumberCell(item.qty),
        normalizeNumberCell(item.rate),
        item.epsNodeId ? pathById.get(Number(item.epsNodeId)) || '' : '',
        '',
        '',
        '',
        '',
        '',
      ]);

      (item.subItems || []).forEach((subItem) => {
        exportRows.push([
          'SUB_ITEM',
          '',
          '',
          item.boqCode || '',
          '',
          subItem.description || '',
          '',
          subItem.uom || item.uom || '',
          normalizeNumberCell(subItem.qty),
          normalizeNumberCell(subItem.rate),
          '',
          '',
          '',
          '',
          '',
          '',
        ]);

        (measurementsBySubItem.get(subItem.id) || []).forEach((measurement) => {
          exportRows.push([
            'MEASUREMENT',
            '',
            '',
            item.boqCode || '',
            subItem.description || '',
            measurement.elementName || '',
            '',
            measurement.uom || subItem.uom || item.uom || '',
            normalizeNumberCell(measurement.qty),
            '',
            measurement.epsNodeId
              ? pathById.get(Number(measurement.epsNodeId)) || ''
              : '',
            measurement.elementName || '',
            normalizeNumberCell(measurement.length),
            normalizeNumberCell(measurement.breadth),
            normalizeNumberCell(measurement.depth),
            normalizeNumberCell(measurement.qty),
          ]);
        });
      });

      (measurementsByItem.get(item.id) || []).forEach((measurement) => {
        exportRows.push([
          'MEASUREMENT',
          '',
          '',
          item.boqCode || '',
          '',
          measurement.elementName || '',
          '',
          measurement.uom || item.uom || '',
          normalizeNumberCell(measurement.qty),
          '',
          measurement.epsNodeId
            ? pathById.get(Number(measurement.epsNodeId)) || ''
            : '',
          measurement.elementName || '',
          normalizeNumberCell(measurement.length),
          normalizeNumberCell(measurement.breadth),
          normalizeNumberCell(measurement.depth),
          normalizeNumberCell(measurement.qty),
        ]);
      });
    });

    const starterRows = [
      [
        'MAIN_ITEM',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ],
      [
        'SUB_ITEM',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ],
      [
        'MEASUREMENT',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...exportRows, ...starterRows]);

    // Set Column Widths for better visibility
    ws['!cols'] = [
      { wch: 14 }, // Row Type
      { wch: 16 }, // Budget Line ID
      { wch: 16 }, // BOQ Code
      { wch: 16 }, // Parent Code
      { wch: 20 }, // Parent Sub-Item
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
      [
        'MAIN_ITEM',
        '',
        'CIV-001',
        '',
        '',
        'Earth Work Excavation',
        'Excavation for foundation',
        'cum',
        '100',
        '500',
        'Tower A > Basement',
        '',
        '',
        '',
        '',
        '',
      ],
      [
        'SUB_ITEM',
        '',
        '',
        'CIV-001',
        '',
        'Manual Excavation',
        'Labor work',
        'cum',
        '40',
        '600',
        '',
        '',
        '',
        '',
        '',
        '',
      ],
      [
        'MEASUREMENT',
        '',
        '',
        'CIV-001',
        'Manual Excavation',
        'Grid 1-A Pit',
        '',
        'cum',
        '0',
        '0',
        'Tower A > Basement',
        'Pit 1',
        '2',
        '2',
        '1.5',
        '6',
      ],
      [
        'MEASUREMENT',
        '',
        '',
        'CIV-001',
        'Manual Excavation',
        'Grid 1-B Pit',
        '',
        'cum',
        '0',
        '0',
        'Tower A > Basement',
        'Pit 2',
        '2',
        '2',
        '1.5',
        '6',
      ],
      [
        'MAIN_ITEM',
        '',
        'CIV-002',
        '',
        '',
        'PCC Work',
        'M10 Grade',
        'cum',
        '50',
        '3500',
        'Tower A > Basement',
        '',
        '',
        '',
        '',
        '',
      ],
    ];

    const wsExample = XLSX.utils.aoa_to_sheet(exampleData);
    wsExample['!cols'] = ws['!cols'];

    const boqReference = [
      [
        'Row Type',
        'Budget Line ID',
        'BOQ Code',
        'Parent BOQ Code',
        'Parent Sub-Item',
        'Description',
        'Detailed Description',
        'UOM',
        'Quantity',
        'Rate',
        'EPS Path',
      ],
      ...exportRows.map((row) => row.slice(0, 11)),
    ];
    const wsBoqRef = XLSX.utils.aoa_to_sheet(boqReference);
    wsBoqRef['!cols'] = [
      { wch: 15 },
      { wch: 16 },
      { wch: 15 },
      { wch: 18 },
      { wch: 24 },
      { wch: 40 },
      { wch: 30 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
      { wch: 42 },
    ];

    const epsReference = [
      ['EPS Node ID', 'EPS Name', 'EPS Path', 'EPS Type'],
      ...((scope?.floorNodes || []).map((node) => [
        node.id,
        node.name,
        pathById.get(node.id) || node.name,
        node.type || '',
      ]) as any[]),
    ];
    const wsEpsRef = XLSX.utils.aoa_to_sheet(epsReference);
    wsEpsRef['!cols'] = [
      { wch: 14 },
      { wch: 24 },
      { wch: 52 },
      { wch: 14 },
    ];

    // Sheet 3: Legend / Instructions
    const legendData = [
      ['Column Name', 'Description', 'Applicable For'],
      ['Row Type', 'Type of row: MAIN_ITEM, SUB_ITEM, or MEASUREMENT', 'All'],
      ['BOQ Code', 'Unique identifier for the main item', 'MAIN_ITEM'],
      [
        'Parent BOQ Code',
        'Links Sub-items/Measurements to a Main Item',
        'SUB_ITEM, MEASUREMENT',
      ],
      [
        'Parent Sub-Item',
        'Exact Name of the Sub-item to link Measurement to',
        'MEASUREMENT (if child of sub-item)',
      ],
      ['Description', 'Name or Title of the item', 'All'],
      ['UOM', 'Unit of Measurement', 'MAIN_ITEM, SUB_ITEM, MEASUREMENT'],
      ['Quantity', 'Total Quantity Override (Manual)', 'MAIN_ITEM, SUB_ITEM'],
      ['Rate', 'Unit Price', 'MAIN_ITEM, SUB_ITEM'],
      [
        'EPS Path',
        'Location Hierarchy (e.g. Tower A > Floor 1)',
        'MAIN_ITEM, MEASUREMENT',
      ],
      ['Element Name', 'Name of the measured element', 'MEASUREMENT'],
      ['Dimensions', 'L, B, D for Calculation', 'MEASUREMENT'],
      [
        'Round-trip use',
        'You can download the current project data, copy rows, change EPS path/description/qty, and re-import to build similar towers faster.',
        'All',
      ],
    ];
    const wsLegend = XLSX.utils.aoa_to_sheet(legendData);
    wsLegend['!cols'] = [{ wch: 20 }, { wch: 50 }, { wch: 30 }];

    // Create Workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Entry');
    XLSX.utils.book_append_sheet(wb, wsBoqRef, 'Current BOQ Data');
    XLSX.utils.book_append_sheet(wb, wsEpsRef, 'EPS Floor Reference');
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
    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.read(fileBuffer, { type: 'buffer' });
    } catch {
      throw new BadRequestException('Invalid or corrupted file. Please upload a valid .xlsx file.');
    }
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

    if (rows.length < 2) throw new BadRequestException('Empty file');

    const headers = rows[0].map((h: any) => String(h).trim());
    const dataRows = rows.slice(1);

    const getIndex = (key: string, defaultName?: string) => {
      let colName = mapping && mapping[key] ? mapping[key] : defaultName;
      if (!colName && defaultName) colName = defaultName;
      if (colName) {
        const idx = headers.findIndex(
          (h) => h.toLowerCase() === colName!.toLowerCase(),
        );
        if (idx !== -1) return idx;
        return headers.findIndex((h) =>
          h.toLowerCase().includes(key.toLowerCase()),
        );
      }
      return -1;
    };

    const normalize = (str: any) =>
      String(str || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

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
    const idxBudgetLineId = getIndex('budgetLineItemId', 'Budget Line ID');
    const idxBudgetCode = getIndex('budgetCode', 'Budget Code');
    let idxEpsPath = getIndex('epsPath', 'EPS Path');
    if (idxEpsPath === -1) idxEpsPath = getIndex('epsName', 'EPS Name');
    if (idxEpsPath === -1)
      idxEpsPath = headers.findIndex((h) =>
        ['location', 'eps', 'eps location'].includes(h.trim().toLowerCase()),
      );
    const idxElName = getIndex('elementName', 'Element Name');
    const idxL = getIndex('length', 'Length');
    const idxB = getIndex('breadth', 'Breadth');
    const idxD = getIndex('depth', 'Depth');
    const idxCalcQty = getIndex('calculatedQty', 'Calculated Qty');

    const allEps = await this.epsRepo.find({
      select: ['id', 'name', 'parentId'],
    });

    const activeBudget = await this.budgetService.getActiveBudget(projectId);
    const budgetLineById = new Map<number, BudgetLineItem>();
    const budgetLineByCode = new Map<string, BudgetLineItem>();
    if (activeBudget) {
      const lines = await this.budgetService.listBudgetLines(
        projectId,
        activeBudget.id,
      );
      lines.forEach((line) => {
        budgetLineById.set(line.id, line);
        if (line.code) {
          budgetLineByCode.set(normalize(line.code), line);
        }
      });
    }

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
      preview: [] as any[],
    };
    const touchedBoqItemIds = new Set<number>();
    const touchedBoqSubItemIds = new Set<number>();

    const buildMeasurementImportKey = (params: {
      boqItemId: number;
      boqSubItemId?: number | null;
      epsNodeId?: number | null;
      elementName?: string;
      length?: number;
      breadth?: number;
      depth?: number;
      height?: number;
      bottomLevel?: number;
      topLevel?: number;
      grid?: string;
      linkingElement?: string;
    }) =>
      [
        params.boqItemId || 0,
        params.boqSubItemId || 0,
        params.epsNodeId || 0,
        normalize(params.elementName || ''),
        Number(params.length || 0).toFixed(3),
        Number(params.breadth || 0).toFixed(3),
        Number(params.depth || 0).toFixed(3),
        Number(params.height || 0).toFixed(3),
        Number(params.bottomLevel || 0).toFixed(3),
        Number(params.topLevel || 0).toFixed(3),
        normalize(params.grid || ''),
        normalize(params.linkingElement || ''),
      ].join('|');

    // === PASS 1: VALIDATE EPS PATHS ===
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || row.length === 0) continue;
      const pathStr =
        idxEpsPath !== -1 ? String(row[idxEpsPath] || '').trim() : '';
      if (pathStr && pathStr !== 'undefined' && pathStr !== '') {
        const parts = pathStr.split('>').map((p) => p.trim());
        const epsId = await this.resolveEpsPath(projectId, parts, allEps);
        if (!epsId) {
          result.warnings.push(
            `Row ${i + 2}: EPS Path "${pathStr}" not found. Will use default or root.`,
          );
        }
      } else if (hierarchyIndices.length > 0) {
        // Validation for Hierarchy
        const pathValues = hierarchyIndices
          .map((idx) => row[idx])
          .filter(
            (v) => v !== undefined && v !== null && String(v).trim() !== '',
          );

        if (pathValues.length > 0) {
          const epsId = await this.resolveEpsPath(
            projectId,
            pathValues.map(String),
            allEps,
          );
          if (!epsId) {
            result.warnings.push(
              `Row ${i + 2}: Hierarchy Path "${pathValues.join(' > ')}" not found.`,
            );
          }
        }
      }
    }

    if (dryRun) {
      // Simple Dry Run Logic
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (!row || row.length === 0) continue;
        const type = String(row[idxRowType] || '')
          .trim()
          .toUpperCase();
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
      loadRelationIds: { relations: ['epsNode'] }, // Ensure we get the ID
    });
    existingItems.forEach((i) => itemCodeMap.set(i.boqCode, i));

    const existingSubItems = await this.boqSubItemRepo.find({
      relations: ['boqItem'],
      where: { boqItem: { projectId } },
    });
    const existingSubItemMap = new Map<string, BoqSubItem>();
    existingSubItems.forEach((subItem) => {
      existingSubItemMap.set(
        `${subItem.boqItemId}:${normalize(subItem.description)}`,
        subItem,
      );
    });

    const existingMeasurements = await this.measurementRepo.find({
      where: { projectId },
    });
    const existingMeasurementMap = new Map<string, MeasurementElement>();
    existingMeasurements.forEach((measurement) => {
      existingMeasurementMap.set(
        buildMeasurementImportKey({
          boqItemId: measurement.boqItemId,
          boqSubItemId: measurement.boqSubItemId,
          epsNodeId: measurement.epsNodeId,
          elementName: measurement.elementName,
          length: Number(measurement.length || 0),
          breadth: Number(measurement.breadth || 0),
          depth: Number(measurement.depth || 0),
          height: Number(measurement.height || 0),
          bottomLevel: Number(measurement.bottomLevel || 0),
          topLevel: Number(measurement.topLevel || 0),
          grid: measurement.grid,
          linkingElement: measurement.linkingElement,
        }),
        measurement,
      );
    });

    // 2. Process MAIN_ITEMS first
    for (const row of dataRows) {
      const type = String(row[idxRowType] || '')
        .trim()
        .toUpperCase();
      if (type === 'MAIN_ITEM') {
        const code = String(row[idxCode] || '').trim();
        if (!code) continue;

        let budgetLine: BudgetLineItem | undefined;
        const rawBudgetLineId =
          idxBudgetLineId !== -1 ? row[idxBudgetLineId] : undefined;
        const rawBudgetCode =
          idxBudgetCode !== -1 ? row[idxBudgetCode] : undefined;

        if (activeBudget) {
          const lineId = rawBudgetLineId
            ? Number(rawBudgetLineId)
            : undefined;
          if (lineId && budgetLineById.has(lineId)) {
            budgetLine = budgetLineById.get(lineId);
          } else if (rawBudgetCode) {
            const key = normalize(rawBudgetCode);
            if (budgetLineByCode.has(key)) {
              budgetLine = budgetLineByCode.get(key);
            }
          }

          if (!budgetLine) {
            result.errors.push(
              `Row "${code}": Budget Line is required when Budget is ACTIVE.`,
            );
            result.errorCount++;
            continue;
          }
        } else {
          const lineId = rawBudgetLineId
            ? Number(rawBudgetLineId)
            : undefined;
          if (lineId && budgetLineById.has(lineId)) {
            budgetLine = budgetLineById.get(lineId);
          } else if (rawBudgetCode) {
            const key = normalize(rawBudgetCode);
            if (budgetLineByCode.has(key)) {
              budgetLine = budgetLineByCode.get(key);
            }
          }
        }

        const existingItem = itemCodeMap.get(code);
        let item = existingItem;
        if (!item) {
          item = this.boqItemRepo.create({
            projectId,
            boqCode: code,
            status: 'IMPORTED',
          });
        }

        // Update fields
        item.description = String(row[idxDesc] || '');
        item.longDescription =
          idxLongDesc !== -1 ? String(row[idxLongDesc] || '') : '';
        item.uom = String(row[idxUom] || 'set');

        if (budgetLine) {
          item.budgetLineItemId = budgetLine.id;
          item.uom = budgetLine.uom || item.uom;
          item.qty = Number(budgetLine.qty || 0);
          item.rate = Number(budgetLine.rate || 0);
          item.amount = Number(budgetLine.amount || 0);
        } else {
          item.qty = Number(row[idxQty] || 0);
          item.rate = Number(row[idxRate] || 0);
          item.amount = Number(item.qty || 0) * Number(item.rate || 0);
        }

        // EPS
        const pathStr =
          idxEpsPath !== -1 ? String(row[idxEpsPath] || '').trim() : '';
        if (pathStr) {
          const epsId = await this.resolveEpsPath(
            projectId,
            pathStr.split('>').map((p) => p.trim()),
            allEps,
          );
          if (epsId) item.epsNodeId = epsId;
        } else if (hierarchyIndices.length > 0) {
          const pathValues = hierarchyIndices
            .map((idx) => row[idx])
            .filter(
              (v) => v !== undefined && v !== null && String(v).trim() !== '',
            );
          if (pathValues.length > 0) {
            const epsId = await this.resolveEpsPath(
              projectId,
              pathValues.map(String),
              allEps,
            );
            if (epsId) item.epsNodeId = epsId;
          } else if (defaultEpsId) {
            item.epsNodeId = defaultEpsId;
          }
        } else if (defaultEpsId) {
          item.epsNodeId = defaultEpsId;
        }

        await this.boqItemRepo.save(item);
        if (budgetLine && activeBudget) {
          await this.budgetService.linkBoqToBudgetLine(
            projectId,
            activeBudget.id,
            item.id,
            budgetLine.id,
            0,
          );
        }
        itemCodeMap.set(code, item); // Update map with saved entity (has ID)
        touchedBoqItemIds.add(item.id);
        if (existingItem) {
          result.updateCount++;
        } else {
          result.newCount++;
        }
      }
    }

    // 3. Process SUB_ITEMS (Require Main Item ID)
    const subItemMap = new Map<string, BoqSubItem>(); // parentCode + desc -> SubItem
    const subItemCodeMap = new Map<string, BoqSubItem>(); // boqCode -> SubItem (New)

    for (const row of dataRows) {
      const type = String(row[idxRowType] || '')
        .trim()
        .toUpperCase();
      if (type === 'SUB_ITEM') {
        const parentCode = String(row[idxParentCode] || '').trim();
        const desc = String(row[idxDesc] || '').trim();
        if (!parentCode || !desc) continue;

        const mainItem = itemCodeMap.get(parentCode);
        if (!mainItem) {
          result.errors.push(
            `Sub-Item "${desc}": Parent BOQ Code "${parentCode}" not found.`,
          );
          continue;
        }

        const subItemLookupKey = `${mainItem.id}:${normalize(desc)}`;
        const existingSubItem = existingSubItemMap.get(subItemLookupKey);
        const subItem =
          existingSubItem ||
          this.boqSubItemRepo.create({
            boqItem: mainItem,
            description: desc,
          });

        subItem.boqItem = mainItem;
        subItem.boqItemId = mainItem.id;
        subItem.description = desc;
        subItem.uom = String(row[idxUom] || mainItem.uom);
        subItem.qty = Number(row[idxQty] || 0);
        subItem.rate = Number(row[idxRate] || mainItem.rate);
        subItem.amount =
          Number(row[idxQty] || 0) * Number(row[idxRate] || mainItem.rate);

        await this.boqSubItemRepo.save(subItem);
        existingSubItemMap.set(subItemLookupKey, subItem);
        subItemMap.set(`${parentCode}:${desc}`, subItem); // Key for linking measurements
        touchedBoqItemIds.add(mainItem.id);
        touchedBoqSubItemIds.add(subItem.id);

        // Also map by Sub-Item Code if available
        const subCode = String(row[idxCode] || '').trim();
        if (subCode) {
          subItemCodeMap.set(subCode, subItem);
        }

        if (existingSubItem) {
          result.updateCount++;
        } else {
          result.newCount++;
        }
      }
    }

    // 4. Process MEASUREMENTS
    for (const row of dataRows) {
      const type = String(row[idxRowType] || '')
        .trim()
        .toUpperCase();
      if (type === 'MEASUREMENT') {
        const parentCode = String(row[idxParentCode] || '').trim();
        const parentSub =
          idxParentSub !== -1 ? String(row[idxParentSub] || '').trim() : '';

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
              where: { boqItem: { id: mainItem.id }, description: parentSub },
            });
          }

          if (!targetSubItem) {
            result.warnings.push(
              `Measurement "${row[idxElName]}": Parent Sub-Item "${parentSub}" not found under "${parentCode}". Linking to Main Item instead.`,
            );
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

        const measLength = Number(row[idxL] || 0);
        const measBreadth = Number(row[idxB] || 0);
        const measDepth = Number(row[idxD] || 0);
        const meas = this.measurementRepo.create({
          projectId,
          boqItem: mainItem,
          boqSubItem: targetSubItem || undefined,
          elementName: elName,
          length: measLength,
          breadth: measBreadth,
          depth: measDepth,
          qty: 0, // Will settle below
          uom: String(row[idxUom] || 'set'),
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
        const pathStr =
          idxEpsPath !== -1 ? String(row[idxEpsPath] || '').trim() : '';
        let resolvedEpsId: number | undefined;

        if (pathStr) {
          // Robust split: handles '>', '->', or just space separators
          const parts = pathStr
            .split(/[>|→|⇒]|\s+>\s+/)
            .map((p) => p.trim())
            .filter((p) => !!p);
          resolvedEpsId = await this.resolveEpsPath(projectId, parts, allEps);
        } else if (hierarchyIndices.length > 0) {
          const pathValues = hierarchyIndices
            .map((idx) => row[idx])
            .filter(
              (v) => v !== undefined && v !== null && String(v).trim() !== '',
            );
          if (pathValues.length > 0) {
            resolvedEpsId = await this.resolveEpsPath(
              projectId,
              pathValues.map(String),
              allEps,
            );
          }
        }

        // Final Assignment with Logic Flow
        if (resolvedEpsId && resolvedEpsId !== 0) {
          meas.epsNodeId = resolvedEpsId;
        } else if (defaultEpsId) {
          // If we have a default project EPS from the UI
          meas.epsNodeId = defaultEpsId;
        } else {
          // Inheritance from Main Item (if it has one)
          if (mainItem.epsNodeId) {
            meas.epsNodeId = mainItem.epsNodeId;
          } else {
            const parentEps = mainItem.epsNode as any;
            if (parentEps) {
              meas.epsNodeId =
                typeof parentEps === 'number' ? parentEps : parentEps.id;
            }
          }
        }

        // Absolute Backup: Use the very first matching EPS node if still null
        // But only if we have nodes at all.
        if (!meas.epsNodeId && allEps.length > 0) {
          // Strategy: Try to find any node that matches the current project
          const projectNode = allEps.find(
            (n) =>
              n.id === projectId || normalize(n.name).includes('mallasandra'),
          );
          meas.epsNodeId = projectNode ? projectNode.id : allEps[0].id;
        }
        const measurementKey = buildMeasurementImportKey({
          boqItemId: mainItem.id,
          boqSubItemId: targetSubItem?.id,
          epsNodeId: meas.epsNodeId,
          elementName: meas.elementName,
          length: meas.length,
          breadth: meas.breadth,
          depth: meas.depth,
          height: meas.height,
          bottomLevel: meas.bottomLevel,
          topLevel: meas.topLevel,
          grid: meas.grid,
          linkingElement: meas.linkingElement,
        });
        const existingMeasurement = existingMeasurementMap.get(measurementKey);
        const measurementToSave = existingMeasurement || meas;
        measurementToSave.projectId = projectId;
        measurementToSave.boqItem = mainItem;
        measurementToSave.boqItemId = mainItem.id;
        if (targetSubItem) {
          measurementToSave.boqSubItem = targetSubItem;
          measurementToSave.boqSubItemId = targetSubItem.id;
        } else {
          measurementToSave.boqSubItem = null as any;
          measurementToSave.boqSubItemId = null as any;
        }
        measurementToSave.elementName = meas.elementName;
        measurementToSave.length = meas.length;
        measurementToSave.breadth = meas.breadth;
        measurementToSave.depth = meas.depth;
        measurementToSave.qty = meas.qty;
        measurementToSave.uom = meas.uom;
        measurementToSave.epsNodeId = meas.epsNodeId;

        await this.measurementRepo.save(measurementToSave);
        existingMeasurementMap.set(measurementKey, measurementToSave);
        touchedBoqItemIds.add(mainItem.id);
        if (targetSubItem?.id) {
          touchedBoqSubItemIds.add(targetSubItem.id);
        }
        if (existingMeasurement) {
          result.updateCount++;
        } else {
          result.newCount++;
        }
      }
    }

    // POST-PROCESSING: keep commercial totals aligned with imported measurements.
    for (const subItemId of touchedBoqSubItemIds) {
      const freshSub = await this.boqSubItemRepo.findOne({
        where: { id: subItemId },
        relations: ['boqItem'],
      });
      if (!freshSub) continue;

      const { sum } = await this.measurementRepo
        .createQueryBuilder('m')
        .select('SUM(m.qty)', 'sum')
        .where('m.boqSubItemId = :id', { id: subItemId })
        .getRawOne();

      const measuredQty = Number(sum || 0);
      if (measuredQty > 0 || freshSub.qty > 0) {
        freshSub.qty = measuredQty;
        freshSub.amount = Number(freshSub.qty || 0) * Number(freshSub.rate || 0);
        await this.boqSubItemRepo.save(freshSub);
        if (freshSub.boqItemId) {
          touchedBoqItemIds.add(freshSub.boqItemId);
        }
      }
    }

    for (const boqItemId of touchedBoqItemIds) {
      const boqItem = await this.boqItemRepo.findOne({
        where: { id: boqItemId },
        relations: ['subItems'],
      });
      if (!boqItem) continue;

      const hasSubItems = (boqItem.subItems || []).length > 0;
      if (hasSubItems) {
        const { totalQty, totalAmount } = await this.boqSubItemRepo
          .createQueryBuilder('s')
          .select('SUM(s.qty)', 'totalQty')
          .addSelect('SUM(s.amount)', 'totalAmount')
          .where('s.boqItemId = :id', { id: boqItemId })
          .getRawOne();

        boqItem.qtyMode = BoqQtyMode.DERIVED;
        boqItem.qty = Number(totalQty || 0);
        boqItem.amount = Number(totalAmount || 0);
        boqItem.rate =
          boqItem.qty > 0 ? Number(boqItem.amount || 0) / Number(boqItem.qty) : 0;
      } else {
        const { sum } = await this.measurementRepo
          .createQueryBuilder('m')
          .select('SUM(m.qty)', 'sum')
          .where('m.boqItemId = :id', { id: boqItemId })
          .andWhere('m.boqSubItemId IS NULL')
          .getRawOne();

        const measuredQty = Number(sum || 0);
        if (measuredQty > 0 || boqItem.qty > 0) {
          boqItem.qtyMode = BoqQtyMode.DERIVED;
          boqItem.qty = measuredQty;
          boqItem.amount = Number(boqItem.qty || 0) * Number(boqItem.rate || 0);
        }
      }

      await this.boqItemRepo.save(boqItem);
    }

    return {
      newCount: result.newCount,
      updateCount: result.updateCount,
      errorCount: result.errorCount,
      errors: result.errors,
      warnings: result.warnings,
      preview: result.preview,
    };
  }

  private async resolveEpsPath(
    projectId: number,
    pathValues: string[],
    allNodes: EpsNode[],
  ): Promise<number> {
    const normalize = (str: any) =>
      String(str || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

    if (pathValues.length === 0) return 0;

    const fullPathStr = pathValues.join(' > ');
    console.log(`[ResolveEPS] Attempting to resolve: "${fullPathStr}"`);

    // 1. Root Search (parentId is null or 0)
    const rootNodes = allNodes.filter((n) => !n.parentId || n.parentId == 0);
    const firstVal = normalize(pathValues[0]);

    let resolvedNode: EpsNode | undefined;
    let startIndex = 0;

    // Strategy A: Match path[0] to a Root
    resolvedNode = rootNodes.find((n) => normalize(n.name).includes(firstVal));
    if (resolvedNode) {
      console.log(
        `[ResolveEPS] Matched path[0] "${pathValues[0]}" to Root: ${resolvedNode.name}`,
      );
      startIndex = 1;
    }

    // Strategy B: Match path[0] to any child of any root (Handling skipped root level)
    if (!resolvedNode) {
      for (const root of rootNodes) {
        const children = allNodes.filter((n) => n.parentId == root.id);
        const match = children.find((c) =>
          normalize(c.name).includes(firstVal),
        );
        if (match) {
          resolvedNode = match;
          startIndex = 1;
          console.log(
            `[ResolveEPS] Matched path[0] "${pathValues[0]}" to child of root ${root.name}: ${resolvedNode.name}`,
          );
          break;
        }
      }
    }

    // Strategy C: Match path[1] to any child of any root (Skipping first part as company/metadata)
    if (!resolvedNode && pathValues.length > 1) {
      const secondVal = normalize(pathValues[1]);
      for (const root of rootNodes) {
        const children = allNodes.filter((n) => n.parentId == root.id);
        const match = children.find((c) =>
          normalize(c.name).includes(secondVal),
        );
        if (match) {
          resolvedNode = match;
          startIndex = 2;
          console.log(
            `[ResolveEPS] Matched path[1] "${pathValues[1]}" (skipped "${pathValues[0]}") to child of root ${root.name}: ${resolvedNode.name}`,
          );
          break;
        }
      }
    }

    if (!resolvedNode) {
      console.warn(
        `[ResolveEPS] Failed to find starting point for: "${fullPathStr}"`,
      );
      return 0;
    }

    let currentParentId = resolvedNode.id;

    // 2. Traversal Search
    for (let i = startIndex; i < pathValues.length; i++) {
      const val = normalize(pathValues[i]);
      if (!val) continue;

      const children = allNodes.filter((n) => n.parentId == currentParentId);
      const match = children.find((n) => normalize(n.name).includes(val));

      if (match) {
        resolvedNode = match;
        currentParentId = match.id;
        console.log(
          `[ResolveEPS] Step ${i} matched: "${pathValues[i]}" -> ${resolvedNode.name}`,
        );
      } else {
        console.warn(
          `[ResolveEPS] Path break at "${pathValues[i]}". Using last resolved: ${resolvedNode.name}`,
        );
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
            epsNode: true,
          },
        },
      },
      order: { boqCode: 'ASC' },
    });

    // 1. Fetch All EPS Nodes for Path Building
    const allEps = await this.epsRepo.find({
      select: ['id', 'name', 'parentId'],
    });
    const epsMap = new Map<number, EpsNode>();
    allEps.forEach((n) => epsMap.set(n.id, n));

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
      'Budget Line ID',
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
      'Calculated Qty',
    ];

    const data: any[][] = [headers];

    for (const item of items) {
      // 1. Main Item
      data.push([
        item.id,
        item.budgetLineItemId || '',
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
        '',
        '',
        '',
        '',
        '',
      ]);

      if (item.subItems && item.subItems.length > 0) {
        for (const sub of item.subItems) {
          // 2. Sub Item
          data.push([
            sub.id,
            '',
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
            '',
            '',
            '',
            '',
            '',
          ]);

          if (sub.measurements && sub.measurements.length > 0) {
            for (const m of sub.measurements) {
              // 3. Measurement
              data.push([
                m.id,
                '',
                '',
                item.boqCode, // Link back to main item (or we could use sub.id if we wanted to be more specific)
                'MEASUREMENT',
                m.elementName || '', // Description for measurement
                '',
                m.uom || sub.uom,
                '',
                '',
                '',
                m.epsNode
                  ? getEpsPath(m.epsNode.id)
                  : getEpsPath(sub.boqItem?.epsNode?.id),
                m.elementName || '',
                m.length,
                m.breadth,
                m.depth,
                m.qty,
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
