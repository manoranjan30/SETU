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
            'EPS Node ID',
            'EPS Name (Reference)',
            'Parent BOQ Code',
            'BOQ Code',
            'BOQ Name',
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
    async importBoq(projectId, fileBuffer, mapping, defaultEpsId, hierarchyMapping) {
        const wb = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (rows.length < 2)
            throw new common_1.BadRequestException('Empty file');
        const headers = rows[0].map((h) => String(h).trim());
        const dataRows = rows.slice(1);
        console.log('[ImportBOQ] Headers:', headers);
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
        const idxCode = getIndex('boqCode', 'BOQ Code');
        const idxDesc = getIndex('description', 'Description');
        const idxLongDesc = getIndex('longDescription', 'Detailed Description');
        const idxUom = getIndex('uom', 'UOM');
        const idxQty = getIndex('qty', 'Total Quantity');
        const idxRate = getIndex('rate', 'Rate');
        const idxParentCode = getIndex('parentBoqCode', 'Parent BOQ Code');
        const idxEpsId = getIndex('epsId', 'EPS Node ID');
        const idxEpsName = getIndex('epsName', 'EPS Name');
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
        const allEps = await this.epsRepo.find({
            select: ['id', 'name', 'parentId'],
        });
        const batchMain = [];
        const batchSub = [];
        const itemCodeMap = new Map();
        const existingItems = await this.boqItemRepo.find({
            where: { projectId },
            select: ['id', 'boqCode'],
        });
        existingItems.forEach((i) => itemCodeMap.set(i.boqCode, i));
        let processedCount = 0;
        for (const row of dataRows) {
            if (row.length === 0)
                continue;
            const code = String(row[idxCode] || '').trim();
            if (!code)
                continue;
            const parentCode = idxParentCode !== -1 ? String(row[idxParentCode] || '').trim() : '';
            const desc = String(row[idxDesc] || '');
            const uom = String(row[idxUom] || 'nos');
            const qty = Number(row[idxQty] || 0);
            const rate = Number(row[idxRate] || 0);
            const longDesc = idxLongDesc !== -1 ? String(row[idxLongDesc] || '') : null;
            if (parentCode) {
                batchSub.push({
                    parentCode,
                    data: {
                        description: desc,
                        uom,
                        qty,
                        rate,
                        amount: qty * rate,
                    },
                });
            }
            else {
                let epsId = 0;
                if (hierarchyMapping && hierarchyIndices.length > 0) {
                    const pathValues = hierarchyIndices
                        .map((idx) => row[idx])
                        .filter((v) => v);
                    epsId = await this.resolveEpsPath(projectId, pathValues, allEps);
                }
                if (!epsId) {
                    const directId = Number(row[idxEpsId]);
                    if (!isNaN(directId) && directId > 0)
                        epsId = directId;
                }
                if (!epsId) {
                }
                if (!epsId && defaultEpsId)
                    epsId = defaultEpsId;
                const boq = this.boqItemRepo.create({
                    projectId,
                    boqCode: code,
                    description: desc,
                    longDescription: longDesc || undefined,
                    uom,
                    qtyMode: boq_item_entity_1.BoqQtyMode.MANUAL,
                    qty,
                    rate,
                    amount: qty * rate,
                    status: 'IMPORTED',
                    epsNode: epsId ? { id: epsId } : null,
                    epsNodeId: epsId || null,
                    customAttributes: { source: 'Excel Import' },
                });
                batchMain.push(boq);
            }
            processedCount++;
        }
        if (batchMain.length > 0) {
            console.log(`[Import] Saving ${batchMain.length} Main Items...`);
            await this.boqItemRepo.save(batchMain);
            const refreshed = await this.boqItemRepo.find({
                where: { projectId },
                select: ['id', 'boqCode'],
            });
            refreshed.forEach((i) => itemCodeMap.set(i.boqCode, i));
        }
        if (batchSub.length > 0) {
            console.log(`[Import] Saving ${batchSub.length} Sub Items...`);
            const subItemsToSave = [];
            for (const sub of batchSub) {
                const parent = itemCodeMap.get(sub.parentCode);
                if (parent) {
                    const s = this.boqSubItemRepo.create({
                        ...sub.data,
                        boqItem: parent,
                    });
                    subItemsToSave.push(s);
                }
                else {
                    console.warn(`[Import] Orphan SubItem skipped. Parent Code '${sub.parentCode}' not found.`);
                }
            }
            if (subItemsToSave.length > 0) {
                await this.boqSubItemRepo.save(subItemsToSave);
            }
        }
        return processedCount;
    }
    async resolveEpsPath(rootId, pathValues, allNodes) {
        const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (pathValues.length === 0)
            return 0;
        let parentId = null;
        const projectNode = allNodes.find((n) => n.id === rootId);
        if (projectNode) {
            parentId = projectNode.id;
        }
        else {
        }
        let resolvedNode = null;
        for (const valRaw of pathValues) {
            const val = String(valRaw || '').trim();
            if (!val)
                break;
            const normVal = normalize(val);
            const candidates = allNodes.filter((n) => n.parentId === parentId);
            let match = candidates.find((n) => normalize(n.name) === normVal);
            if (!match)
                match = candidates.find((n) => normalize(n.name).includes(normVal) ||
                    normVal.includes(normalize(n.name)));
            if (match) {
                resolvedNode = match;
                parentId = match.id;
            }
            else {
                return resolvedNode ? resolvedNode.id : 0;
            }
        }
        return resolvedNode ? resolvedNode.id : 0;
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