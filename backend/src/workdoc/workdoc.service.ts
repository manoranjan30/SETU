import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
const FormData = require('form-data');
const pdf = require('pdf-parse');
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path'; // Standard node path

// Entities
import { WorkOrder } from './entities/work-order.entity';
import { WorkOrderItem } from './entities/work-order-item.entity';
import { Vendor } from './entities/vendor.entity';
import { WorkOrderBoqMap } from './entities/work-order-boq-map.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';
import { WorkDocTemplate } from './entities/work-doc-template.entity';

export interface ExtractedItem {
  code: string;
  description: string;
  qty: number;
  uom: string;
  rate: number;
  amount: number;
  longText: string;
}

@Injectable()
export class WorkDocService {
  constructor(
    @InjectRepository(WorkOrder)
    private woRepo: Repository<WorkOrder>,
    @InjectRepository(WorkOrderItem)
    private woItemRepo: Repository<WorkOrderItem>,
    @InjectRepository(Vendor)
    private vendorRepo: Repository<Vendor>,
    @InjectRepository(WorkOrderBoqMap)
    private mapRepo: Repository<WorkOrderBoqMap>,
    @InjectRepository(BoqItem)
    private boqItemRepo: Repository<BoqItem>,
    @InjectRepository(WorkDocTemplate)
    private templateRepo: Repository<WorkDocTemplate>,
    private readonly httpService: HttpService,
  ) {}

  // --- Vendors ---
  async getAllVendors() {
    return this.vendorRepo.find({ order: { name: 'ASC' } });
  }

  async createVendor(data: Partial<Vendor>) {
    const existing = await this.vendorRepo.findOne({
      where: { vendorCode: data.vendorCode },
    });
    if (existing)
      throw new BadRequestException(
        `Vendor code ${data.vendorCode} already exists`,
      );
    const vendor = this.vendorRepo.create(data);
    return this.vendorRepo.save(vendor);
  }

  // --- Templates ---
  async getAllTemplates() {
    return this.templateRepo.find({ order: { name: 'ASC' } });
  }

  async createTemplate(data: Partial<WorkDocTemplate>) {
    const template = this.templateRepo.create(data);
    return this.templateRepo.save(template);
  }

  async updateTemplate(id: number, data: Partial<WorkDocTemplate>) {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    Object.assign(template, data);
    return this.templateRepo.save(template);
  }

  async deleteTemplate(id: number) {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    return this.templateRepo.remove(template);
  }

  // --- Work Orders ---
  async getProjectWorkOrders(projectId: number) {
    return this.woRepo.find({
      where: { projectId },
      relations: ['vendor', 'items'],
      order: { woDate: 'DESC' },
    });
  }

  async createWorkOrder(data: Partial<WorkOrder>) {
    const wo = this.woRepo.create(data);
    return this.woRepo.save(wo);
  }

  async deleteWorkOrder(woId: number) {
    const wo = await this.woRepo.findOne({ where: { id: woId } });
    if (!wo) throw new NotFoundException('Work Order not found');
    return this.woRepo.remove(wo);
  }

  async getWorkOrderDetails(woId: number) {
    const wo = await this.woRepo.findOne({
      where: { id: woId },
      relations: ['vendor', 'items'],
    });
    if (!wo) throw new NotFoundException('Work Order not found');
    return wo;
  }

  // --- Mapping ---
  async mapItem(
    woItemId: number,
    boqItemId: number,
    conversionFactor: number = 1,
  ) {
    const woItem = await this.woItemRepo.findOne({ where: { id: woItemId } });
    if (!woItem) throw new NotFoundException('Work Order Item not found');

    const boqItem = await this.boqItemRepo.findOne({
      where: { id: boqItemId },
    });
    if (!boqItem) throw new NotFoundException('BOQ Item not found');

    const mapping = this.mapRepo.create({
      workOrderItem: woItem,
      boqItem: boqItem,
      conversionFactor,
    });

    return this.mapRepo.save(mapping);
  }

  // --- PDF Processing ---
  async analyzeWorkOrderPdf(
    projectId: number,
    file: Express.Multer.File,
    templateId?: number,
    test: boolean = false,
    volatileConfig?: string,
  ) {
    let config: any = null;

    // 1. Resolve Config
    if (test && volatileConfig) {
      try {
        config = JSON.parse(volatileConfig);
      } catch (e) {
        console.error('Invalid volatile config JSON', e);
      }
    } else if (templateId) {
      const template = await this.templateRepo.findOne({
        where: { id: templateId },
      });
      if (!template) throw new NotFoundException('Template not found');
      config = template.config;
    }

    // 2. Check for Coordinate Template (Python Tool)
    if (config && config.coordinateTemplate) {
      try {
        // Call Python Microservice
        // Assume Python tool is at http://localhost:8000
        const pythonUrl = process.env.PDF_TOOL_URL || 'http://localhost:8002';

        const formData = new FormData();
        formData.append('file', fs.createReadStream(file.path));
        // Ensure coordinateTemplate is a string
        const templateStr =
          typeof config.coordinateTemplate === 'string'
            ? config.coordinateTemplate
            : JSON.stringify(config.coordinateTemplate);
        formData.append('template_json', templateStr);

        const response: any = await firstValueFrom(
          this.httpService.post(
            `${pythonUrl}/extract/from_template`,
            formData,
            {
              headers: {
                ...formData.getHeaders(),
              },
            },
          ),
        );

        const extractedData = response.data;

        // Map result to expected format if needed, but Python tool returns structured data
        // { vendor: {...}, header: {...}, items: [...] }
        // So we can return it directly

        return {
          projectId,
          ...extractedData,
          pdfPath: file.path,
          originalFileName: file.originalname,
          templateId,
          rawText: 'Coordinate Extraction Used',
        };
      } catch (error) {
        console.error(
          'Python PDF Tool Error:',
          error.response?.data || error.message,
        );
        throw new BadRequestException(
          'Coordinate Extraction Failed: ' +
            (error.response?.data?.detail || error.message),
        );
      }
    }

    // 3. Fallback to Legacy Regex (pdf-parse)
    const dataBuffer = fs.readFileSync(file.path);

    try {
      const data = await pdf(dataBuffer);
      const text = data.text;

      let extractedData: any;

      if (config) {
        extractedData = this.parseWithTemplate(text, config);
      } else {
        // Default simple regex extraction
        const vendorInfo = this.extractVendor(text);
        const woInfo = this.extractWorkOrderHeader(text);
        const items = this.extractLineItems(text);
        extractedData = { vendor: vendorInfo, header: woInfo, items };
      }

      return {
        projectId,
        ...extractedData,
        pdfPath: file.path,
        originalFileName: file.originalname,
        templateId,
        rawText: text, // Include full text for regex testing UI
      };
    } catch (error) {
      console.error('PDF Parse Error:', error);
      throw new BadRequestException('Failed to parse PDF: ' + error.message);
    }
  }

  async saveConfirmedWorkOrder(projectId: number, data: any) {
    const {
      vendor: vendorInfo,
      header: woInfo,
      items,
      pdfPath,
      originalFileName,
    } = data;

    // 1. Find or Create Vendor
    let vendor = await this.vendorRepo.findOne({
      where: { vendorCode: vendorInfo.code },
    });
    if (!vendor) {
      vendor = this.vendorRepo.create({
        vendorCode: vendorInfo.code,
        name: vendorInfo.name || `Unknown Vendor (${vendorInfo.code})`,
        address: vendorInfo.address,
      });
      await this.vendorRepo.save(vendor);
    }

    // 2. Create Work Order
    const workOrder = this.woRepo.create({
      projectId,
      woNumber: woInfo.woNumber || `TEMP-${Date.now()}`,
      woDate: woInfo.date ? new Date(woInfo.date) : new Date(),
      vendor: vendor,
      status: 'DRAFT',
      pdfPath,
      originalFileName,
      totalAmount: items.reduce(
        (sum: number, item: any) => sum + Number(item.amount || 0),
        0,
      ),
    });

    const savedWo = await this.woRepo.save(workOrder);
    const woEntity = Array.isArray(savedWo) ? savedWo[0] : savedWo;

    // 3. Create Items
    const workOrderItems = items.map((item: any) =>
      this.woItemRepo.create({
        workOrder: woEntity,
        materialCode: item.code,
        shortText: item.description,
        quantity: Number(item.qty || 0),
        uom: item.uom,
        rate: Number(item.rate || 0),
        amount: Number(item.amount || 0),
        longText: item.longText,
      }),
    );

    await this.woItemRepo.save(workOrderItems);

    return {
      id: woEntity.id,
      message: 'Work Order imported successfully',
    };
  }

  private extractVendor(text: string) {
    // Regex for Vendor Code (Common SAP pattern: "Vendor: 123456" or just digits)
    const codeMatch =
      text.match(/Vendor\s*[:#]?\s*(\d+)/i) ||
      text.match(/Supplier\s*[:#]?\s*(\d+)/i);
    // Regex for Name (Capture text after found code or specific label)
    const nameMatch = text.match(/Name\s*[:]\s*(.+)/i);

    return {
      code: codeMatch ? codeMatch[1] : `UNK-${Date.now()}`, // Fallback if not found
      name: nameMatch ? nameMatch[1].trim() : undefined,
      address: '', // Hard to parse address reliably without structure
    };
  }

  private extractWorkOrderHeader(text: string) {
    // SAP WO Number: 45000xxxxx
    const woMatch =
      text.match(/Order\s*No\.?\s*[:]?\s*(\d{10})/i) ||
      text.match(/PO\s*No\.?\s*[:]?\s*(\d+)/i);
    const dateMatch = text.match(/Date\s*[:]?\s*(\d{2}[./-]\d{2}[./-]\d{4})/i);

    let date = new Date();
    if (dateMatch) {
      // parse date formatDD.MM.YYYY
      const parts = dateMatch[1].split(/[./-]/);
      if (parts.length === 3) {
        date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`); // ISO
      }
    }

    return {
      woNumber: woMatch ? woMatch[1] : null,
      date: date,
    };
  }

  private extractLineItems(text: string): ExtractedItem[] {
    const items: ExtractedItem[] = [];
    const lines = text.split('\n');

    // Regex for a line item row
    // Expecting: ItemNo (10,20) | Material Code (Digits) | Qty (Decimal) | Unit | Rate | Amount
    // This is tricky. We'll look for lines that contain at least a material code pattern and numbers

    // Strategy: Look for lines with multiple numbers.
    // SAP Item:  10   10001234   Concrete M30   100.000   M3    5000.00    5,00,000.00

    const rowRegex =
      /^\s*(\d+)\s+(\d{6,18})\s+(.+?)\s+([\d,.]+)\s+([a-zA-Z]+)\s+([\d,.]+)\s+([\d,.]+)/;

    for (const line of lines) {
      const match = line.match(rowRegex);
      if (match) {
        const qty = parseFloat(match[4].replace(/,/g, ''));
        const rate = parseFloat(match[6].replace(/,/g, ''));
        const amount = parseFloat(match[7].replace(/,/g, ''));

        items.push({
          code: match[2],
          description: match[3].trim(),
          qty,
          uom: match[5],
          rate,
          amount,
          longText: '',
        });
      }
    }

    return items;
  }

  private parseWithTemplate(text: string, config: any) {
    const vendorVal = this.extractWithRegex(text, config.vendorRegex);
    const vendorInfo = {
      code: vendorVal || 'UNK-' + Date.now(),
      name: 'Vendor ' + (vendorVal || 'Unknown'),
      address: '',
    };

    const woVal = this.extractWithRegex(text, config.woNumberRegex);
    const woInfo = {
      woNumber: woVal || 'TEMP-' + Date.now(),
      date: new Date(), // TODO: Add date regex support
    };

    // Multi-page table extraction logic
    const items: ExtractedItem[] = [];
    const lines = text.split('\n');

    if (config.tableConfig) {
      const { rowRegex, columnMapping } = config.tableConfig;
      // Remove start/end anchors if they exist in strict mode, or ensure we match nicely
      // But relying on user config is best.
      const regex = new RegExp(rowRegex);

      // console.log('Debug: Using Row Regex:', rowRegex);

      for (const line of lines) {
        const match = line.match(regex);
        if (match) {
          items.push({
            code: this.safeGet(match, columnMapping.code, 'N/A'),
            description: this.safeGet(
              match,
              columnMapping.description,
              'No Description',
            ).trim(),
            qty: parseFloat(
              this.safeGet(match, columnMapping.qty, '0').replace(/,/g, ''),
            ),
            uom: this.safeGet(match, columnMapping.uom, 'NOS'),
            rate: parseFloat(
              this.safeGet(match, columnMapping.rate, '0').replace(/,/g, ''),
            ),
            amount: parseFloat(
              this.safeGet(match, columnMapping.amount, '0').replace(/,/g, ''),
            ),
            longText: columnMapping.longText
              ? this.safeGet(match, columnMapping.longText, '')
              : '',
          });
        }
      }
    }

    return { vendor: vendorInfo, header: woInfo, items };
  }

  private safeGet(
    match: RegExpMatchArray,
    index: number,
    defaultVal: string,
  ): string {
    if (index !== undefined && match[index]) return match[index];
    return defaultVal;
  }

  private extractWithRegex(text: string, pattern: string) {
    if (!pattern) return null;
    try {
      const match = text.match(new RegExp(pattern, 'i')); // Case insensitive by default
      if (!match) return null;

      // If it's a simple regex with one capture group, return that
      if (match.length > 1) return match[1];

      // Otherwise return the whole match
      return match[0];
    } catch (e) {
      console.error('Regex error:', e);
      return null;
    }
  }

  // --- Billing / Gap Analysis ---
  async getBillingStatus(woId: number) {
    // TODO: Aggregation logic for billable value
    return { message: 'Not implemented yet' };
  }
}
