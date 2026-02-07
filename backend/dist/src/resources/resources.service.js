"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourcesService = void 0;
const common_1 = require("@nestjs/common");
const stream_1 = require("stream");
const csv = require('csv-parser');
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const resource_master_entity_1 = require("./entities/resource-master.entity");
const analysis_template_entity_1 = require("./entities/analysis-template.entity");
const analysis_coefficient_entity_1 = require("./entities/analysis-coefficient.entity");
const boq_item_entity_1 = require("../boq/entities/boq-item.entity");
let ResourcesService = class ResourcesService {
    resourceRepo;
    templateRepo;
    coefficientRepo;
    boqItemRepo;
    constructor(resourceRepo, templateRepo, coefficientRepo, boqItemRepo) {
        this.resourceRepo = resourceRepo;
        this.templateRepo = templateRepo;
        this.coefficientRepo = coefficientRepo;
        this.boqItemRepo = boqItemRepo;
    }
    async generateNextResourceCode() {
        const last = await this.resourceRepo.findOne({
            where: {},
            order: { id: 'DESC' },
        });
        const nextId = last ? last.id + 1 : 1;
        return `RES-${nextId.toString().padStart(3, '0')}`;
    }
    async generateNextTemplateCode() {
        const last = await this.templateRepo.findOne({
            where: {},
            order: { id: 'DESC' },
        });
        const nextId = last ? last.id + 1 : 1;
        return `ANA-${nextId.toString().padStart(3, '0')}`;
    }
    async findAllResources() {
        return this.resourceRepo.find({ order: { resourceName: 'ASC' } });
    }
    async createResource(data) {
        if (!data.resourceCode) {
            data.resourceCode = await this.generateNextResourceCode();
        }
        const resource = this.resourceRepo.create(data);
        return this.resourceRepo.save(resource);
    }
    async updateResource(id, data) {
        await this.resourceRepo.update(id, data);
        return this.resourceRepo.findOne({ where: { id } });
    }
    async deleteResource(id) {
        return this.resourceRepo.delete(id);
    }
    async findAllTemplates() {
        return this.templateRepo.find({
            relations: ['coefficients', 'coefficients.resource'],
            order: { templateCode: 'ASC' },
        });
    }
    async findTemplateById(id) {
        const template = await this.templateRepo.findOne({
            where: { id },
            relations: ['coefficients', 'coefficients.resource'],
        });
        if (!template)
            throw new common_1.NotFoundException('Template not found');
        return template;
    }
    async createTemplate(data) {
        if (!data.templateCode) {
            data.templateCode = await this.generateNextTemplateCode();
        }
        const template = this.templateRepo.create(data);
        return this.templateRepo.save(template);
    }
    async updateTemplate(id, data) {
        const { coefficients, ...info } = data;
        await this.templateRepo.update(id, info);
        if (coefficients) {
            await this.coefficientRepo.delete({ templateId: id });
            const newCoeffs = coefficients.map((c) => this.coefficientRepo.create({ ...c, templateId: id }));
            await this.coefficientRepo.save(newCoeffs);
        }
        return this.findTemplateById(id);
    }
    async deleteTemplate(id) {
        return this.templateRepo.delete(id);
    }
    async suggestMappings(items) {
        const templates = await this.findAllTemplates();
        const suggestions = [];
        const templateTokens = templates.map((t) => ({
            id: t.id,
            name: t.templateCode + ' ' + t.description,
            tokens: this.tokenize(t.templateCode + ' ' + t.description),
            obj: t,
        }));
        for (const item of items) {
            const itemTokens = this.tokenize(item.description);
            let bestMatch = null;
            let bestScore = 0;
            for (const t of templateTokens) {
                const score = this.calculateJaccardIndex(itemTokens, t.tokens);
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = t;
                }
            }
            if (bestScore > 0.1 && bestMatch) {
                suggestions.push({
                    boqItemId: item.boqItemId,
                    suggestedTemplateId: bestMatch.id,
                    templateName: bestMatch.obj.description,
                    confidence: Math.round(bestScore * 100),
                    reasoning: `Keyword overlap: ${bestScore.toFixed(2)}`,
                });
            }
        }
        return suggestions;
    }
    tokenize(text) {
        if (!text)
            return new Set();
        return new Set(text
            .toLowerCase()
            .split(/[\s,.-]+/)
            .map((w) => w.trim())
            .filter((w) => w.length > 2)
            .filter((w) => ![
            'the',
            'and',
            'for',
            'with',
            'providing',
            'fixing',
            'supplying',
        ].includes(w)));
    }
    calculateJaccardIndex(setA, setB) {
        if (setA.size === 0 || setB.size === 0)
            return 0;
        let intersection = 0;
        setA.forEach((token) => {
            if (setB.has(token))
                intersection++;
        });
        const union = setA.size + setB.size - intersection;
        return intersection / union;
    }
    async calculateProjectResources(projectId) {
        const measurements = (await this.coefficientRepo.manager
            .getRepository('MeasurementElement')
            .find({
            where: { projectId: projectId },
            relations: [
                'analysisTemplate',
                'analysisTemplate.coefficients',
                'analysisTemplate.coefficients.resource',
                'boqItem',
            ],
        }));
        const resourceMap = new Map();
        const boqMap = new Map();
        const typeTotals = {
            [resource_master_entity_1.ResourceType.MATERIAL]: 0,
            [resource_master_entity_1.ResourceType.LABOR]: 0,
            [resource_master_entity_1.ResourceType.PLANT]: 0,
            [resource_master_entity_1.ResourceType.SUBCONTRACT]: 0,
            [resource_master_entity_1.ResourceType.OTHER]: 0,
        };
        for (const m of measurements) {
            if (!m.analysisTemplateId || !m.analysisTemplate)
                continue;
            const mQty = Number(m.qty || 0);
            const template = m.analysisTemplate;
            const boqItem = m.boqItem;
            if (template.coefficients) {
                for (const coeff of template.coefficients) {
                    const resource = coeff.resource;
                    const requiredQty = mQty * coeff.coefficient;
                    const amount = requiredQty * (resource.standardRate || 0);
                    const rType = resource.resourceType || resource_master_entity_1.ResourceType.MATERIAL;
                    if (!resourceMap.has(resource.id)) {
                        resourceMap.set(resource.id, {
                            resourceCode: resource.resourceCode,
                            resourceName: resource.resourceName,
                            uom: resource.uom,
                            totalQty: 0,
                            standardRate: resource.standardRate || 0,
                            totalAmount: 0,
                            type: rType,
                        });
                    }
                    const resEntry = resourceMap.get(resource.id);
                    resEntry.totalQty += requiredQty;
                    resEntry.totalAmount += amount;
                    if (typeTotals.hasOwnProperty(rType)) {
                        typeTotals[rType] += amount;
                    }
                    if (boqItem) {
                        if (!boqMap.has(boqItem.id)) {
                            boqMap.set(boqItem.id, {
                                id: boqItem.id,
                                boqCode: boqItem.boqCode,
                                description: boqItem.description,
                                totalAmount: 0,
                                resources: new Map(),
                            });
                        }
                        const boqEntry = boqMap.get(boqItem.id);
                        boqEntry.totalAmount += amount;
                        if (!boqEntry.resources.has(resource.id)) {
                            boqEntry.resources.set(resource.id, {
                                resourceCode: resource.resourceCode,
                                resourceName: resource.resourceName,
                                uom: resource.uom,
                                totalQty: 0,
                                standardRate: resource.standardRate || 0,
                                totalAmount: 0,
                                type: rType,
                            });
                        }
                        const bResEntry = boqEntry.resources.get(resource.id);
                        bResEntry.totalQty += requiredQty;
                        bResEntry.totalAmount += amount;
                    }
                }
            }
        }
        const boqBreakdown = Array.from(boqMap.values())
            .map((b) => ({
            ...b,
            resources: Array.from(b.resources.values()),
        }))
            .sort((a, b) => b.totalAmount - a.totalAmount);
        return {
            aggregated: Array.from(resourceMap.values()),
            boqBreakdown: boqBreakdown,
            typeTotals: typeTotals,
        };
    }
    async getResourceTemplate() {
        const headers = [
            'Resource Code (Optional)',
            'Resource Name*',
            'UOM*',
            'Type (MATERIAL/LABOR/PLANT/OTHER)*',
            'Standard Rate',
            'Category',
            'Specification',
        ];
        const example = [
            '',
            'Example Cement',
            'Bag',
            'MATERIAL',
            '450',
            'Civil',
            'Grade 53 OPC',
        ];
        return [headers.join(','), example.join(',')].join('\n');
    }
    mapResourceType(raw) {
        const val = raw?.trim().toUpperCase() || '';
        if (['LABOR', 'LABOUR', 'MANPOWER', 'WORKFORCE', 'PERSONNEL'].includes(val)) {
            return resource_master_entity_1.ResourceType.LABOR;
        }
        if (['PLANT', 'EQUIPMENT', 'MACHINERY', 'VEHICLE', 'TOOLS'].includes(val)) {
            return resource_master_entity_1.ResourceType.PLANT;
        }
        if (['SUBCONTRACT', 'VENDOR', 'CONTRACTOR'].includes(val)) {
            return resource_master_entity_1.ResourceType.SUBCONTRACT;
        }
        if (['MATERIAL', 'MAT', 'SUPPLY', 'GOODS'].includes(val)) {
            return resource_master_entity_1.ResourceType.MATERIAL;
        }
        if (Object.values(resource_master_entity_1.ResourceType).includes(val)) {
            return val;
        }
        return resource_master_entity_1.ResourceType.MATERIAL;
    }
    async importResources(file, mapping) {
        if (!file || !file.buffer)
            throw new Error('File empty');
        const stream = stream_1.Readable.from(file.buffer);
        const results = [];
        const errors = [];
        return new Promise((resolve, reject) => {
            stream
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', async () => {
                let imported = 0;
                for (const row of results) {
                    try {
                        const name = (row[mapping.resourceName || 'Resource Name*'] || '').trim();
                        const uom = (row[mapping.uom || 'UOM*'] || '').trim();
                        if (!name || !uom) {
                            errors.push({ row, error: 'Missing Name or UOM' });
                            continue;
                        }
                        const existing = await this.resourceRepo.findOne({
                            where: { resourceName: name, uom: uom },
                        });
                        if (existing) {
                            continue;
                        }
                        const rawType = row[mapping.resourceType || 'Type (MATERIAL/LABOR/PLANT/OTHER)*'] || '';
                        const resourceData = {
                            resourceName: name,
                            uom: uom,
                            resourceCode: row[mapping.resourceCode || 'Resource Code (Optional)'] ||
                                undefined,
                            resourceType: this.mapResourceType(rawType),
                            standardRate: parseFloat(row[mapping.standardRate || 'Standard Rate'] || '0'),
                            category: row[mapping.category || 'Category'] || null,
                            specification: row[mapping.specification || 'Specification'] || null,
                        };
                        await this.createResource(resourceData);
                        imported++;
                    }
                    catch (err) {
                        errors.push({ row, error: err.message });
                    }
                }
                resolve({ imported, errors });
            })
                .on('error', reject);
        });
    }
};
exports.ResourcesService = ResourcesService;
exports.ResourcesService = ResourcesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(resource_master_entity_1.ResourceMaster)),
    __param(1, (0, typeorm_1.InjectRepository)(analysis_template_entity_1.AnalysisTemplate)),
    __param(2, (0, typeorm_1.InjectRepository)(analysis_coefficient_entity_1.AnalysisCoefficient)),
    __param(3, (0, typeorm_1.InjectRepository)(boq_item_entity_1.BoqItem)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], ResourcesService);
//# sourceMappingURL=resources.service.js.map