"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoqImportService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const boq_item_entity_1 = require("./entities/boq-item.entity");
const boq_sub_item_entity_1 = require("./entities/boq-sub-item.entity");
const eps_entity_1 = require("../eps/eps.entity");
const XLSX = __importStar(require("xlsx"));
const measurement_element_entity_1 = require("./entities/measurement-element.entity");
let BoqImportService = class BoqImportService {
    boqItemRepo;
    epsRepo;
    measurementRepo;
    boqSubItemRepo;
    constructor(boqItemRepo, epsRepo, measurementRepo, boqSubItemRepo) {
        this.boqItemRepo = boqItemRepo;
        this.epsRepo = epsRepo;
        this.measurementRepo = measurementRepo;
        this.boqSubItemRepo = boqSubItemRepo;
    }
    getMeasurementTemplate() {
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
    async importMeasurements(projectId, boqItemId, fileBuffer, mapping, defaultEpsId, valueMap, hierarchyMapping, boqSubItemId) {
        console.log(`[ImportMeasurements] Starting import for Item ${boqItemId}, SubItem: ${boqSubItemId}`);
        const wb = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (rows.length < 2) {
            console.warn('[ImportMeasurements] Empty file (less than 2 rows)');
            throw new common_1.BadRequestException('Empty file');
        }
        const headers = rows[0].map((h) => String(h).trim());
        const dataRows = rows.slice(1);
        console.log('[ImportMeasurements] Headers:', headers);
        console.log('[ImportMeasurements] Hierarchy Mapping:', hierarchyMapping);
        const getIndex = (key, defaultIdx) => {
            if (mapping && mapping[key]) {
                const headerName = mapping[key];
                const idx = headers.findIndex((h) => h.toLowerCase() === headerName.toLowerCase());
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
        const epsIdsToCheck = new Set();
        const epsNamesToCheck = new Set();
        for (const row of dataRows) {
            if (idxEpsId !== -1 && row[idxEpsId]) {
                const numVal = Number(row[idxEpsId]);
                if (!isNaN(numVal) && numVal !== 0)
                    epsIdsToCheck.add(numVal);
            }
            if (idxEpsName !== -1 && row[idxEpsName]) {
                epsNamesToCheck.add(String(row[idxEpsName]).trim().toLowerCase());
            }
        }
        const validEpsIds = new Set();
        const epsNameMap = new Map();
        if (epsIdsToCheck.size > 0) {
            const validEps = await this.epsRepo.find({
                where: { id: (0, typeorm_2.In)(Array.from(epsIdsToCheck)) },
                select: ['id', 'name'],
            });
            validEps.forEach((e) => validEpsIds.add(e.id));
        }
        if (epsNamesToCheck.size > 0 || defaultEpsId) {
            const allNodes = await this.epsRepo.find({
                select: ['id', 'name'],
            });
            allNodes.forEach((n) => {
                epsNameMap.set(n.name.toLowerCase().trim(), n.id);
                if (epsIdsToCheck.has(n.id))
                    validEpsIds.add(n.id);
            });
        }
        let epsNodes = [];
        if (hierarchyMapping) {
            epsNodes = await this.epsRepo.find();
        }
        const measurements = [];
        let skippedCount = 0;
        let hierarchyIndices = [];
        if (hierarchyMapping) {
            const getColIndex = (colName) => colName
                ? headers.findIndex((h) => h.trim().toLowerCase() === colName.trim().toLowerCase())
                : -1;
            hierarchyIndices = [
                getColIndex(hierarchyMapping.level1),
                getColIndex(hierarchyMapping.level2),
                getColIndex(hierarchyMapping.level3),
                getColIndex(hierarchyMapping.level4),
                getColIndex(hierarchyMapping.level5),
            ].filter((idx) => idx !== -1);
            console.log('[ImportMeasurements] Resolved Hierarchy Indices:', hierarchyIndices);
        }
        for (const row of dataRows) {
            if (row.length === 0)
                continue;
            const rowVal = String(row[idxEpsName] || '').trim();
            let epsId = 0;
            if (hierarchyMapping && hierarchyIndices.length > 0) {
                const pathValues = hierarchyIndices
                    .map((idx) => row[idx])
                    .filter((v) => v !== undefined && v !== null && String(v).trim() !== '');
                epsId = await this.resolveEpsPath(projectId, pathValues, epsNodes);
            }
            if (!epsId && valueMap && valueMap[rowVal]) {
                const mappedId = valueMap[rowVal];
                if (mappedId !== 'SKIP') {
                    epsId = Number(mappedId);
                }
                else {
                    skippedCount++;
                    continue;
                }
            }
            if (!epsId) {
                const currentEpsId = Number(row[idxEpsId]);
                const epsNameRef = String(row[idxEpsName] || '')
                    .trim()
                    .toLowerCase();
                if (currentEpsId &&
                    !isNaN(currentEpsId) &&
                    validEpsIds.has(currentEpsId)) {
                    epsId = currentEpsId;
                }
                else if (epsNameRef && epsNameMap.has(epsNameRef)) {
                    epsId = epsNameMap.get(epsNameRef);
                }
                else if (epsNameRef && epsNameRef.includes('>')) {
                    const parts = epsNameRef.split('>').map(p => p.trim());
                    const nodes = epsNodes.length > 0 ? epsNodes : await this.epsRepo.find();
                    epsId = await this.resolveEpsPath(projectId, parts, nodes);
                }
                else if (defaultEpsId) {
                    epsId = defaultEpsId;
                }
            }
            if (!epsId || epsId === 0 || isNaN(epsId)) {
                if (!defaultEpsId) {
                    console.warn(`[ImportMeasurements] Row skipped. Invalid EPS ID. Path attempted? ${hierarchyMapping ? 'Yes' : 'No'}.`);
                    skippedCount++;
                    continue;
                }
                else {
                    epsId = defaultEpsId;
                }
            }
            const safeNum = (val, fieldName) => {
                if (val === undefined || val === null || val === '')
                    return 0;
                const num = Number(val);
                if (isNaN(num))
                    return 0;
                return num;
            };
            const m = this.measurementRepo.create({
                projectId: safeNum(projectId, 'projectId'),
                boqItemId: safeNum(boqItemId, 'boqItemId'),
                boqSubItemId: boqSubItemId ? Number(boqSubItemId) : undefined,
                epsNodeId: epsId,
                elementId: `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                elementName: String(row[idxElName] || 'Imported Element').substring(0, 255),
                elementCategory: idxCat >= 0 ? String(row[idxCat] || '') : undefined,
                elementType: idxType >= 0 ? String(row[idxType] || '') : undefined,
                grid: idxGrid >= 0 ? String(row[idxGrid] || '') : undefined,
                linkingElement: idxLink >= 0 ? String(row[idxLink] || '') : undefined,
                uom: idxUom >= 0 ? String(row[idxUom] || '') : undefined,
                length: safeNum(row[idxL], 'length'),
                breadth: safeNum(row[idxB], 'breadth'),
                depth: safeNum(row[idxD], 'depth'),
                height: idxHeight >= 0 ? safeNum(row[idxHeight], 'height') : 0,
                bottomLevel: idxBottom >= 0 ? safeNum(row[idxBottom], 'bottomLevel') : 0,
                topLevel: idxTop >= 0 ? safeNum(row[idxTop], 'topLevel') : 0,
                perimeter: idxPerim >= 0 ? safeNum(row[idxPerim], 'perimeter') : 0,
                baseArea: idxBaseArea >= 0 ? safeNum(row[idxBaseArea], 'baseArea') : 0,
                qty: safeNum(row[idxQty], 'qty'),
                baseCoordinates: idxCoords >= 0 ? this.tryParseJson(row[idxCoords]) : undefined,
                plineAllLengths: idxPline >= 0 ? this.tryParseJson(row[idxPline]) : undefined,
            });
            measurements.push(m);
        }
        if (measurements.length > 0) {
            await this.measurementRepo.save(measurements);
            console.log(`[ImportMeasurements] Saved ${measurements.length} measurements.`);
            if (boqSubItemId) {
                console.log(`[ImportMeasurements] Triggering Manual Rollup for SubItem ${boqSubItemId}`);
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
                        const { totalQty: mainQty, totalAmount: mainAmount } = await this.boqSubItemRepo
                            .createQueryBuilder('s')
                            .select('SUM(s.qty)', 'totalQty')
                            .addSelect('SUM(s.amount)', 'totalAmount')
                            .where('s.boqItemId = :id', { id: subItem.boqItem.id })
                            .getRawOne();
                        subItem.boqItem.qty = Number(mainQty || 0);
                        subItem.boqItem.amount = Number(mainAmount || 0);
                        if (subItem.boqItem.qtyMode !== boq_item_entity_1.BoqQtyMode.DERIVED) {
                            subItem.boqItem.qtyMode = boq_item_entity_1.BoqQtyMode.DERIVED;
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
    getTemplateBuffer() {
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
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        ws['!cols'] = [
            { wch: 15 },
            { wch: 15 },
            { wch: 15 },
            { wch: 20 },
            { wch: 40 },
            { wch: 30 },
            { wch: 10 },
            { wch: 12 },
            { wch: 12 },
            { wch: 30 },
            { wch: 20 },
            { wch: 10 },
            { wch: 10 },
            { wch: 10 },
            { wch: 15 },
        ];
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
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Data Entry');
        XLSX.utils.book_append_sheet(wb, wsExample, 'Example Data');
        XLSX.utils.book_append_sheet(wb, wsLegend, 'Instructions');
        return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }
    async importBoq(projectId, fileBuffer, mapping, defaultEpsId, hierarchyMapping, dryRun = false) {
        const wb = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (rows.length < 2)
            throw new common_1.BadRequestException('Empty file');
        const headers = rows[0].map((h) => String(h).trim());
        const dataRows = rows.slice(1);
        const getIndex = (key, defaultName) => {
            let colName = mapping && mapping[key] ? mapping[key] : defaultName;
            if (!colName && defaultName)
                colName = defaultName;
            if (colName) {
                const idx = headers.findIndex((h) => h.toLowerCase() === colName.toLowerCase());
                if (idx !== -1)
                    return idx;
                return headers.findIndex((h) => h.toLowerCase().includes(key.toLowerCase()));
            }
            return -1;
        };
        const idxId = getIndex('id', 'ID');
        const idxRowType = getIndex('rowType', 'Row Type');
        const idxCode = getIndex('boqCode', 'BOQ Code');
        const idxParentCode = getIndex('parentBoqCode', 'Parent BOQ Code');
        const idxParentSub = getIndex('parentSubItem', 'Parent Sub-Item');
        const idxDesc = getIndex('description', 'Description');
        const idxLongDesc = getIndex('longDescription', 'Detailed Description');
        const idxUom = getIndex('uom', 'UOM');
        const idxQty = getIndex('qty', 'Quantity');
        const idxRate = getIndex('rate', 'Rate');
        let idxEpsPath = getIndex('epsPath', 'EPS Path');
        if (idxEpsPath === -1)
            idxEpsPath = getIndex('epsName', 'EPS Name');
        const idxElName = getIndex('elementName', 'Element Name');
        const idxL = getIndex('length', 'Length');
        const idxB = getIndex('breadth', 'Breadth');
        const idxD = getIndex('depth', 'Depth');
        const idxCalcQty = getIndex('calculatedQty', 'Calculated Qty');
        const allEps = await this.epsRepo.find({ select: ['id', 'name', 'parentId'] });
        let hierarchyIndices = [];
        if (hierarchyMapping) {
            const getColIndex = (colName) => colName
                ? headers.findIndex((h) => h.trim().toLowerCase() === colName.trim().toLowerCase())
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
            errors: [],
            warnings: [],
            preview: []
        };
        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            if (!row || row.length === 0)
                continue;
            const pathStr = idxEpsPath !== -1 ? String(row[idxEpsPath] || '').trim() : '';
            if (pathStr && pathStr !== 'undefined' && pathStr !== '') {
                const parts = pathStr.split('>').map(p => p.trim());
                const epsId = await this.resolveEpsPath(projectId, parts, allEps);
                if (!epsId) {
                    result.warnings.push(`Row ${i + 2}: EPS Path "${pathStr}" not found. Will use default or root.`);
                }
            }
            else if (hierarchyIndices.length > 0) {
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
            for (let i = 0; i < dataRows.length; i++) {
                const row = dataRows[i];
                if (!row || row.length === 0)
                    continue;
                const type = String(row[idxRowType] || '').trim().toUpperCase();
                if (['MAIN_ITEM', 'SUB_ITEM', 'MEASUREMENT'].includes(type)) {
                    result.newCount++;
                }
                else {
                    result.warnings.push(`Row ${i + 2}: Unknown Row Type "${type}"`);
                }
            }
            return result;
        }
        const itemCodeMap = new Map();
        const existingItems = await this.boqItemRepo.find({
            where: { projectId },
            loadRelationIds: { relations: ['epsNode'] }
        });
        existingItems.forEach(i => itemCodeMap.set(i.boqCode, i));
        for (const row of dataRows) {
            const type = String(row[idxRowType] || '').trim().toUpperCase();
            if (type === 'MAIN_ITEM') {
                const code = String(row[idxCode] || '').trim();
                if (!code)
                    continue;
                let item = itemCodeMap.get(code);
                if (!item) {
                    item = this.boqItemRepo.create({
                        projectId,
                        boqCode: code,
                        status: 'IMPORTED'
                    });
                }
                item.description = String(row[idxDesc] || '');
                item.longDescription = idxLongDesc !== -1 ? String(row[idxLongDesc] || '') : '';
                item.uom = String(row[idxUom] || 'set');
                item.qty = Number(row[idxQty] || 0);
                item.rate = Number(row[idxRate] || 0);
                const pathStr = idxEpsPath !== -1 ? String(row[idxEpsPath] || '').trim() : '';
                if (pathStr) {
                    const epsId = await this.resolveEpsPath(projectId, pathStr.split('>').map(p => p.trim()), allEps);
                    if (epsId)
                        item.epsNodeId = epsId;
                }
                else if (hierarchyIndices.length > 0) {
                    const pathValues = hierarchyIndices
                        .map((idx) => row[idx])
                        .filter((v) => v !== undefined && v !== null && String(v).trim() !== '');
                    if (pathValues.length > 0) {
                        const epsId = await this.resolveEpsPath(projectId, pathValues.map(String), allEps);
                        if (epsId)
                            item.epsNodeId = epsId;
                    }
                    else if (defaultEpsId) {
                        item.epsNodeId = defaultEpsId;
                    }
                }
                else if (defaultEpsId) {
                    item.epsNodeId = defaultEpsId;
                }
                await this.boqItemRepo.save(item);
                itemCodeMap.set(code, item);
                result.newCount++;
            }
        }
        const subItemMap = new Map();
        const subItemCodeMap = new Map();
        for (const row of dataRows) {
            const type = String(row[idxRowType] || '').trim().toUpperCase();
            if (type === 'SUB_ITEM') {
                const parentCode = String(row[idxParentCode] || '').trim();
                const desc = String(row[idxDesc] || '').trim();
                if (!parentCode || !desc)
                    continue;
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
                subItemMap.set(`${parentCode}:${desc}`, subItem);
                const subCode = String(row[idxCode] || '').trim();
                if (subCode) {
                    subItemCodeMap.set(subCode, subItem);
                }
                result.newCount++;
            }
        }
        for (const row of dataRows) {
            const type = String(row[idxRowType] || '').trim().toUpperCase();
            if (type === 'MEASUREMENT') {
                const parentCode = String(row[idxParentCode] || '').trim();
                const parentSub = idxParentSub !== -1 ? String(row[idxParentSub] || '').trim() : '';
                if (!parentCode)
                    continue;
                let mainItem;
                let targetSubItem;
                if (subItemCodeMap.has(parentCode)) {
                    targetSubItem = subItemCodeMap.get(parentCode);
                    if (targetSubItem) {
                        mainItem = targetSubItem.boqItem;
                    }
                }
                if (!mainItem) {
                    mainItem = itemCodeMap.get(parentCode);
                }
                if (!mainItem)
                    continue;
                if (parentSub && !targetSubItem) {
                    targetSubItem = subItemMap.get(`${parentCode}:${parentSub}`);
                    if (!targetSubItem) {
                        targetSubItem = await this.boqSubItemRepo.findOne({
                            where: { boqItem: { id: mainItem.id }, description: parentSub }
                        });
                    }
                    if (!targetSubItem) {
                        result.warnings.push(`Measurement "${row[idxElName]}": Parent Sub-Item "${parentSub}" not found under "${parentCode}". Linking to Main Item instead.`);
                    }
                }
                let elName = 'Measurement';
                if (idxElName !== -1 && row[idxElName]) {
                    elName = String(row[idxElName]);
                }
                else if (idxDesc !== -1 && row[idxDesc]) {
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
                    qty: 0,
                    uom: String(row[idxUom] || 'set')
                });
                let finalQty = Number(row[idxCalcQty] || 0);
                if (finalQty === 0) {
                    const l = meas.length || 0;
                    const b = meas.breadth || 0;
                    const d = meas.depth || 0;
                    if (l !== 0 || b !== 0 || d !== 0) {
                        finalQty = (l || 1) * (b || 1) * (d || 1);
                    }
                }
                if (finalQty === 0) {
                    finalQty = Number(row[idxQty] || 0);
                }
                meas.qty = finalQty;
                const pathStr = idxEpsPath !== -1 ? String(row[idxEpsPath] || '').trim() : '';
                let resolvedEpsId;
                if (pathStr) {
                    resolvedEpsId = await this.resolveEpsPath(projectId, pathStr.split('>').map(p => p.trim()), allEps);
                }
                else if (hierarchyIndices.length > 0) {
                    const pathValues = hierarchyIndices
                        .map((idx) => row[idx])
                        .filter((v) => v !== undefined && v !== null && String(v).trim() !== '');
                    if (pathValues.length > 0) {
                        resolvedEpsId = await this.resolveEpsPath(projectId, pathValues.map(String), allEps);
                    }
                }
                if (resolvedEpsId) {
                    meas.epsNodeId = resolvedEpsId;
                }
                else if (defaultEpsId) {
                    meas.epsNodeId = defaultEpsId;
                }
                else {
                    const parentEps = mainItem.epsNode;
                    if (mainItem.epsNodeId) {
                        meas.epsNodeId = mainItem.epsNodeId;
                    }
                    else if (parentEps) {
                        meas.epsNodeId = typeof parentEps === 'number' ? parentEps : parentEps.id;
                    }
                }
                if (!meas.epsNodeId && allEps.length > 0) {
                    meas.epsNodeId = allEps[0].id;
                    result.warnings.push(`Measurement "${row[idxElName]}": No EPS found. Fallback to First Available EPS: ${allEps[0].name}`);
                }
                await this.measurementRepo.save(meas);
                result.newCount++;
            }
        }
        const allSubs = Array.from(subItemCodeMap.values());
        for (const sub of allSubs) {
            const freshSub = await this.boqSubItemRepo.findOne({
                where: { id: sub.id },
                relations: ['measurements']
            });
            if (freshSub && freshSub.measurements) {
                const total = freshSub.measurements.reduce((sum, m) => sum + Number(m.qty), 0);
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
    async resolveEpsPath(projectId, pathValues, allNodes) {
        const normalize = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (pathValues.length === 0)
            return 0;
        console.log(`[ResolveEPS] resolving: ${pathValues.join(' > ')}`);
        const rootNodes = allNodes.filter(n => !n.parentId || n.parentId == 0);
        let startNode;
        let startIndex = 0;
        const firstVal = normalize(pathValues[0]);
        startNode = rootNodes.find(n => normalize(n.name).includes(firstVal));
        if (!startNode) {
            for (const root of rootNodes) {
                const children = allNodes.filter(n => n.parentId == root.id);
                const match = children.find(c => normalize(c.name).includes(firstVal));
                if (match) {
                    startNode = match;
                    startIndex = 1;
                    break;
                }
            }
        }
        if (!startNode && pathValues.length > 1) {
            const secondVal = normalize(pathValues[1]);
            for (const root of rootNodes) {
                const children = allNodes.filter(n => n.parentId == root.id);
                const match = children.find(c => normalize(c.name).includes(secondVal));
                if (match) {
                    startNode = match;
                    startIndex = 2;
                    break;
                }
            }
        }
        if (!startNode) {
            console.warn(`[ResolveEPS] Failed to find start node for path: ${pathValues.join(' > ')}`);
            return 0;
        }
        console.log(`[ResolveEPS] Start Node: ${startNode.name} (Index: ${startIndex})`);
        let currentParentId = startNode.id;
        let resolvedNode = startNode;
        for (let i = startIndex; i < pathValues.length; i++) {
            const val = normalize(pathValues[i]);
            if (!val)
                continue;
            const children = allNodes.filter(n => n.parentId == currentParentId);
            let match = children.find(n => normalize(n.name).includes(val));
            if (match) {
                resolvedNode = match;
                currentParentId = match.id;
            }
            else {
                console.warn(`[ResolveEPS] Path break at "${pathValues[i]}". Best: ${resolvedNode.name}`);
                break;
            }
        }
        return resolvedNode.id;
    }
    async exportBoqToCsv(projectId) {
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
        const allEps = await this.epsRepo.find({ select: ['id', 'name', 'parentId'] });
        const epsMap = new Map();
        allEps.forEach(n => epsMap.set(n.id, n));
        const getEpsPath = (nodeId) => {
            if (!nodeId)
                return '';
            let curr = epsMap.get(nodeId);
            const path = [];
            let depth = 0;
            while (curr && depth < 20) {
                path.unshift(curr.name);
                if (curr.parentId)
                    curr = epsMap.get(curr.parentId);
                else
                    break;
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
        const data = [headers];
        for (const item of items) {
            data.push([
                item.id,
                item.boqCode,
                '',
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
                    data.push([
                        sub.id,
                        '',
                        item.boqCode,
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
                            data.push([
                                m.id,
                                '',
                                item.boqCode,
                                'MEASUREMENT',
                                m.elementName || '',
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
    tryParseJson(val) {
        if (!val)
            return undefined;
        try {
            if (typeof val === 'string')
                return JSON.parse(val);
            return val;
        }
        catch (e) {
            return val;
        }
    }
};
exports.BoqImportService = BoqImportService;
exports.BoqImportService = BoqImportService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(boq_item_entity_1.BoqItem)),
    __param(1, (0, typeorm_1.InjectRepository)(eps_entity_1.EpsNode)),
    __param(2, (0, typeorm_1.InjectRepository)(measurement_element_entity_1.MeasurementElement)),
    __param(3, (0, typeorm_1.InjectRepository)(boq_sub_item_entity_1.BoqSubItem)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], BoqImportService);
//# sourceMappingURL=boq-import.service.js.map