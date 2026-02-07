import { Injectable, NotFoundException } from '@nestjs/common';
import { Readable } from 'stream';
const csv = require('csv-parser');
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ResourceMaster,
  ResourceType,
} from './entities/resource-master.entity';
import { AnalysisTemplate } from './entities/analysis-template.entity';
import { AnalysisCoefficient } from './entities/analysis-coefficient.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';

@Injectable()
export class ResourcesService {
  constructor(
    @InjectRepository(ResourceMaster)
    private resourceRepo: Repository<ResourceMaster>,
    @InjectRepository(AnalysisTemplate)
    private templateRepo: Repository<AnalysisTemplate>,
    @InjectRepository(AnalysisCoefficient)
    private coefficientRepo: Repository<AnalysisCoefficient>,
    @InjectRepository(BoqItem)
    private boqItemRepo: Repository<BoqItem>,
  ) {}

  // --- Code Generation ---
  private async generateNextResourceCode(): Promise<string> {
    const last = await this.resourceRepo.findOne({
      where: {},
      order: { id: 'DESC' },
    });
    const nextId = last ? last.id + 1 : 1;
    return `RES-${nextId.toString().padStart(3, '0')}`;
  }

  private async generateNextTemplateCode(): Promise<string> {
    const last = await this.templateRepo.findOne({
      where: {},
      order: { id: 'DESC' },
    });
    const nextId = last ? last.id + 1 : 1;
    return `ANA-${nextId.toString().padStart(3, '0')}`;
  }

  // --- Resources ---
  async findAllResources() {
    return this.resourceRepo.find({ order: { resourceName: 'ASC' } });
  }

  async createResource(data: Partial<ResourceMaster>) {
    if (!data.resourceCode) {
      data.resourceCode = await this.generateNextResourceCode();
    }
    const resource = this.resourceRepo.create(data);
    return this.resourceRepo.save(resource);
  }

  async updateResource(id: number, data: Partial<ResourceMaster>) {
    await this.resourceRepo.update(id, data);
    return this.resourceRepo.findOne({ where: { id } });
  }

  async deleteResource(id: number) {
    return this.resourceRepo.delete(id);
  }

  // --- Templates ---
  async findAllTemplates() {
    return this.templateRepo.find({
      relations: ['coefficients', 'coefficients.resource'],
      order: { templateCode: 'ASC' },
    });
  }

  async findTemplateById(id: number) {
    const template = await this.templateRepo.findOne({
      where: { id },
      relations: ['coefficients', 'coefficients.resource'],
    });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async createTemplate(data: Partial<AnalysisTemplate>) {
    // If coefficients provided, handle them
    if (!data.templateCode) {
      data.templateCode = await this.generateNextTemplateCode();
    }
    const template = this.templateRepo.create(data);
    return this.templateRepo.save(template);
  }

  async updateTemplate(id: number, data: Partial<AnalysisTemplate>) {
    // Handle coefficient updates separately or use deep save
    const { coefficients, ...info } = data;
    await this.templateRepo.update(id, info);

    if (coefficients) {
      // Simple replace strategy for now: remove all old, add all new
      // In a real app we might diff them
      await this.coefficientRepo.delete({ templateId: id });
      const newCoeffs = coefficients.map((c) =>
        this.coefficientRepo.create({ ...c, templateId: id }),
      );
      await this.coefficientRepo.save(newCoeffs);
    }

    return this.findTemplateById(id);
  }

  async deleteTemplate(id: number) {
    return this.templateRepo.delete(id);
  }

  // --- Auto-Mapping Logic ---

  async suggestMappings(items: { boqItemId: number; description: string }[]) {
    const templates = await this.findAllTemplates();
    const suggestions: any[] = []; // Explicit type

    // Pre-tokenize templates
    const templateTokens = templates.map((t) => ({
      id: t.id,
      name: t.templateCode + ' ' + t.description, // Combine code and desc for better matching
      tokens: this.tokenize(t.templateCode + ' ' + t.description),
      obj: t,
    }));

    for (const item of items) {
      const itemTokens = this.tokenize(item.description);
      let bestMatch: {
        id: number;
        name: string;
        tokens: Set<string>;
        obj: AnalysisTemplate;
      } | null = null;
      let bestScore = 0;

      for (const t of templateTokens) {
        const score = this.calculateJaccardIndex(itemTokens, t.tokens);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = t;
        }
      }

      // Threshold: 0.1 (Low threshold to get some results, can be tuned)
      if (bestScore > 0.1 && bestMatch) {
        suggestions.push({
          boqItemId: item.boqItemId,
          suggestedTemplateId: bestMatch.id,
          templateName: bestMatch.obj.description,
          confidence: Math.round(bestScore * 100), // percentage
          reasoning: `Keyword overlap: ${bestScore.toFixed(2)}`,
        });
      }
    }

    return suggestions;
  }

  private tokenize(text: string): Set<string> {
    if (!text) return new Set();
    return new Set(
      text
        .toLowerCase()
        .split(/[\s,.-]+/) // Split by space, comma, dot, dash
        .map((w) => w.trim())
        .filter((w) => w.length > 2) // Filter out short words
        .filter(
          (w) =>
            ![
              'the',
              'and',
              'for',
              'with',
              'providing',
              'fixing',
              'supplying',
            ].includes(w),
        ), // Stop words
    );
  }

  private calculateJaccardIndex(setA: Set<string>, setB: Set<string>): number {
    if (setA.size === 0 || setB.size === 0) return 0;
    let intersection = 0;
    setA.forEach((token) => {
      if (setB.has(token)) intersection++;
    });
    const union = setA.size + setB.size - intersection;
    return intersection / union;
  }

  // --- Calculation Engine ---

  async calculateProjectResources(projectId: number) {
    // Fetch all MeasurementElements with their templates and associated BOQ Main Item
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
      })) as any[];

    const resourceMap = new Map<
      number,
      {
        resourceCode: string;
        resourceName: string;
        uom: string;
        totalQty: number;
        standardRate: number;
        totalAmount: number;
        type: string;
      }
    >();

    const boqMap = new Map<
      number,
      {
        id: number;
        boqCode: string;
        description: string;
        totalAmount: number;
        resources: Map<
          number,
          {
            resourceCode: string;
            resourceName: string;
            uom: string;
            totalQty: number;
            standardRate: number;
            totalAmount: number;
            type: string;
          }
        >;
      }
    >();

    const typeTotals = {
      [ResourceType.MATERIAL]: 0,
      [ResourceType.LABOR]: 0,
      [ResourceType.PLANT]: 0,
      [ResourceType.SUBCONTRACT]: 0,
      [ResourceType.OTHER]: 0,
    };

    for (const m of measurements) {
      if (!m.analysisTemplateId || !m.analysisTemplate) continue;

      const mQty = Number(m.qty || 0);
      const template = m.analysisTemplate;
      const boqItem = m.boqItem;

      if (template.coefficients) {
        for (const coeff of template.coefficients) {
          const resource = coeff.resource;
          const requiredQty = mQty * coeff.coefficient;
          const amount = requiredQty * (resource.standardRate || 0);
          const rType = resource.resourceType || ResourceType.MATERIAL;

          // 1. Aggregated Resource Total
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
          const resEntry = resourceMap.get(resource.id)!;
          resEntry.totalQty += requiredQty;
          resEntry.totalAmount += amount;

          // 2. Resource Type Totals
          if (typeTotals.hasOwnProperty(rType)) {
            typeTotals[rType] += amount;
          }

          // 3. BOQ Item Breakdown (Nested)
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
            const boqEntry = boqMap.get(boqItem.id)!;
            boqEntry.totalAmount += amount;

            // Add resource to BOQ entry
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
            const bResEntry = boqEntry.resources.get(resource.id)!;
            bResEntry.totalQty += requiredQty;
            bResEntry.totalAmount += amount;
          }
        }
      }
    }

    // Convert BOQ Map items to arrays for frontend
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

  // --- Template & Import ---

  async getResourceTemplate(): Promise<string> {
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

  private mapResourceType(raw: string): ResourceType {
    const val = raw?.trim().toUpperCase() || '';

    // LABOR Aliases
    if (
      ['LABOR', 'LABOUR', 'MANPOWER', 'WORKFORCE', 'PERSONNEL'].includes(val)
    ) {
      return ResourceType.LABOR;
    }

    // PLANT Aliases
    if (['PLANT', 'EQUIPMENT', 'MACHINERY', 'VEHICLE', 'TOOLS'].includes(val)) {
      return ResourceType.PLANT;
    }

    // SUBCONTRACT Aliases
    if (['SUBCONTRACT', 'VENDOR', 'CONTRACTOR'].includes(val)) {
      return ResourceType.SUBCONTRACT;
    }

    // MATERIAL Aliases
    if (['MATERIAL', 'MAT', 'SUPPLY', 'GOODS'].includes(val)) {
      return ResourceType.MATERIAL;
    }

    // Default / Exact Match
    if (Object.values(ResourceType).includes(val as ResourceType)) {
      return val as ResourceType;
    }

    return ResourceType.MATERIAL; // Final fallback
  }

  async importResources(
    file: any,
    mapping: any,
  ): Promise<{ imported: number; errors: any[] }> {
    if (!file || !file.buffer) throw new Error('File empty');

    const stream = Readable.from(file.buffer);
    const results: any[] = [];
    const errors: any[] = [];

    return new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
          let imported = 0;
          for (const row of results) {
            try {
              const name = (
                row[mapping.resourceName || 'Resource Name*'] || ''
              ).trim();
              const uom = (row[mapping.uom || 'UOM*'] || '').trim();
              if (!name || !uom) {
                errors.push({ row, error: 'Missing Name or UOM' });
                continue;
              }

              // DUPLICATE CHECK
              const existing = await this.resourceRepo.findOne({
                where: { resourceName: name, uom: uom },
              });
              if (existing) {
                // Skip duplicates as requested
                continue;
              }

              const rawType =
                row[
                  mapping.resourceType || 'Type (MATERIAL/LABOR/PLANT/OTHER)*'
                ] || '';
              const resourceData: Partial<ResourceMaster> = {
                resourceName: name,
                uom: uom,
                resourceCode:
                  row[mapping.resourceCode || 'Resource Code (Optional)'] ||
                  undefined,
                resourceType: this.mapResourceType(rawType),
                standardRate: parseFloat(
                  row[mapping.standardRate || 'Standard Rate'] || '0',
                ),
                category: row[mapping.category || 'Category'] || null,
                specification:
                  row[mapping.specification || 'Specification'] || null,
              };

              await this.createResource(resourceData);
              imported++;
            } catch (err) {
              errors.push({ row, error: err.message });
            }
          }
          resolve({ imported, errors });
        })
        .on('error', reject);
    });
  }
}
