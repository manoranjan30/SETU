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
import { Repository, DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path'; // Standard node path
import * as XLSX from 'xlsx';

// Entities
import { WorkOrder } from './entities/work-order.entity';
import { WorkOrderItem } from './entities/work-order-item.entity';
import { Vendor } from './entities/vendor.entity';
import { WorkOrderBoqMap } from './entities/work-order-boq-map.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';
import { BoqSubItem } from '../boq/entities/boq-sub-item.entity';
import { WorkDocTemplate } from './entities/work-doc-template.entity';
import { TempUser } from '../temp-user/entities/temp-user.entity';

export interface ExcelItem {
  serialNumber: string;
  parentSerialNumber: string | null;
  level: number;
  isParent: boolean;
  materialCode: string;
  shortText: string;
  longText: string;
  uom: string;
  quantity: number;
  rate: number;
  amount: number;
  calculatedAmount: number;
}

export interface ColumnMapping {
  serialNumber?: number;
  sapItemNumber?: number;
  shortDescription?: number;
  detailDescription?: number;
  uom?: number;
  quantity?: number;
  rate?: number;
  amount?: number;
}

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
    @InjectRepository(BoqSubItem)
    private boqSubItemRepo: Repository<BoqSubItem>,
    @InjectRepository(WorkDocTemplate)
    private templateRepo: Repository<WorkDocTemplate>,
    @InjectRepository(TempUser)
    private tempUserRepo: Repository<TempUser>,
    private readonly httpService: HttpService,
    private dataSource: DataSource,
  ) { }

  // --- Vendors ---
  async getAllVendors(search?: string) {
    if (search) {
      return this.vendorRepo
        .createQueryBuilder('v')
        .where('v.vendorCode ILIKE :search OR v.name ILIKE :search', {
          search: `%${search}%`,
        })
        .orderBy('v.name', 'ASC')
        .getMany();
    }
    return this.vendorRepo.find({ order: { name: 'ASC' } });
  }

  async getVendorByCode(code: string) {
    const vendor = await this.vendorRepo.findOne({
      where: { vendorCode: code },
    });
    return vendor || null;
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

  async updateVendor(id: number, data: Partial<Vendor>) {
    const vendor = await this.vendorRepo.findOne({ where: { id } });
    if (!vendor) throw new NotFoundException('Vendor not found');

    // Don't allow changing vendorCode to an existing one
    if (data.vendorCode && data.vendorCode !== vendor.vendorCode) {
      const existing = await this.vendorRepo.findOne({
        where: { vendorCode: data.vendorCode },
      });
      if (existing) {
        throw new BadRequestException(
          `Vendor code ${data.vendorCode} already exists`,
        );
      }
    }

    Object.assign(vendor, data);
    return this.vendorRepo.save(vendor);
  }

  async deleteVendor(id: number) {
    const vendor = await this.vendorRepo.findOne({ where: { id } });
    if (!vendor) throw new NotFoundException('Vendor not found');

    // Check for associated work orders
    const workOrders = await this.woRepo.find({
      where: { vendor: { id } },
      select: ['id', 'woNumber', 'projectId'],
    });

    if (workOrders.length > 0) {
      return {
        success: false,
        hasWorkOrders: true,
        workOrderCount: workOrders.length,
        workOrders: workOrders.map((wo) => ({
          id: wo.id,
          woNumber: wo.woNumber,
          projectId: wo.projectId,
        })),
        message: `Cannot delete vendor. ${workOrders.length} work order(s) are assigned to this vendor. Please delete the work orders first.`,
      };
    }

    await this.vendorRepo.remove(vendor);
    return {
      success: true,
      message: 'Vendor deleted successfully',
    };
  }

  async getVendorWorkOrders(vendorId: number) {
    const vendor = await this.vendorRepo.findOne({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundException('Vendor not found');

    return this.woRepo.find({
      where: { vendor: { id: vendorId } },
      order: { woDate: 'DESC' },
      select: [
        'id',
        'woNumber',
        'woDate',
        'projectId',
        'status',
        'totalAmount',
      ],
    });
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
    if (!wo) throw new NotFoundException('Work order not found');
    return wo;
  }

  async updateWorkOrderStatus(woId: number, status: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'CANCELLED') {
    const wo = await this.woRepo.findOneBy({ id: woId });
    if (!wo) throw new NotFoundException('Work order not found');

    wo.status = status;
    await this.woRepo.save(wo);

    if (status === 'CLOSED' || status === 'CANCELLED') {
      await this.tempUserRepo.update(
        { workOrder: { id: woId }, status: 'ACTIVE' },
        { status: 'EXPIRED', suspendedAt: new Date(), suspensionReason: `Work Order ${status}` }
      );
    }
    return wo;
  }

  // --- Mapping / Linkage ---
  async getLinkageData(projectId: number, woId?: number) {
    // 1. Fetch BOQ Tree (Item -> SubItems)
    const boqTree = await this.boqItemRepo.find({
      where: { projectId },
      relations: ['subItems'],
      order: { boqCode: 'ASC' },
    });

    // 2. Fetch existing mappings for this project/WO
    let mappings: WorkOrderBoqMap[] = [];
    if (woId) {
      mappings = await this.mapRepo.find({
        where: { workOrderItem: { workOrder: { id: woId } } },
        relations: ['workOrderItem', 'boqItem', 'boqSubItem'],
      });
    }

    return { boqTree, mappings };
  }

  async updateMapping(
    woItemId: number,
    mappings: { boqItemId?: number; boqSubItemId?: number; factor: number }[],
  ) {
    const woItem = await this.woItemRepo.findOne({
      where: { id: woItemId },
      relations: ['workOrder'],
    });
    if (!woItem) throw new NotFoundException('Work Order Item not found');

    // Remove existing mappings for this WO Item
    await this.mapRepo.delete({ workOrderItem: { id: woItemId } });

    // Create new mappings
    const entities = mappings.map((m) =>
      this.mapRepo.create({
        workOrderItem: woItem,
        boqItem: m.boqItemId ? ({ id: m.boqItemId } as any) : null,
        boqSubItem: m.boqSubItemId ? ({ id: m.boqSubItemId } as any) : null,
        conversionFactor: m.factor || 1,
      }),
    );

    await this.mapRepo.save(entities);

    // Sync progress immediately after re-mapping
    await this.syncWorkOrderProgress(woItemId);

    return { success: true };
  }

  async syncWorkOrderProgress(woItemId?: number) {
    const itemsToSync = woItemId
      ? await this.woItemRepo.find({ where: { id: woItemId } })
      : await this.woItemRepo.find();

    for (const item of itemsToSync) {
      const maps = await this.mapRepo.find({
        where: { workOrderItem: { id: item.id } },
        relations: ['boqItem', 'boqSubItem'],
      });

      let totalExecuted = 0;
      for (const map of maps) {
        if (map.boqSubItem) {
          // Accurate Floor/Sub-Item progress
          const subItem = await this.boqSubItemRepo.findOneBy({
            id: map.boqSubItemId,
          });
          totalExecuted += (subItem?.executedQty || 0) * map.conversionFactor;
        } else if (map.boqItem) {
          // Summary level progress
          const boqItem = await this.boqItemRepo.findOneBy({
            id: map.boqItemId,
          });
          totalExecuted += (boqItem?.consumedQty || 0) * map.conversionFactor;
        }
      }

      item.executedQuantity = totalExecuted;
      await this.woItemRepo.save(item);
    }
  }

  async getPendingVendorBoard(projectId: number) {
    // Fetch all unmapped items (boqItemId IS NULL)
    // Or items mapped but needing review? Usually 'PENDING' mappingStatus

    const items = await this.woItemRepo
      .createQueryBuilder('woItem')
      .innerJoinAndSelect('woItem.workOrder', 'wo')
      .leftJoinAndSelect('wo.vendor', 'vendor')
      .where('wo.projectId = :projectId', { projectId })
      .andWhere('wo.status != :status', { status: 'DRAFT' })
      .andWhere(
        '(woItem.boqItemId IS NULL OR woItem.mappingStatus = :mappingStatus)',
        { mappingStatus: 'PENDING' },
      )
      .orderBy('wo.date', 'DESC')
      .getMany();

    // Group or transform for frontend
    return items.map((item) => ({
      id: item.id,
      workOrderId: item.workOrder.id,
      workOrderRef: item.workOrder.woNumber,
      vendorName: item.workOrder.vendor?.name || 'Unknown',
      materialCode: item.materialCode,
      description: item.shortText,
      quantity: Number(item.quantity),
      rate: Number(item.rate),
      amount: Number(item.amount),
      mappingStatus: item.mappingStatus || 'PENDING',
      suggestedBoqId: null, // Frontend can fetch suggestion on hover or bulk
    }));
  }

  async getGlobalMappingRegistry(projectId: number) {
    // 1. Get all BOQ Items and Sub-Items
    const boqItems = await this.boqItemRepo.find({
      where: { projectId },
      relations: ['subItems'],
      order: { boqCode: 'ASC' },
    });

    // 2. Get all mappings for this project with full relations
    const allMappings = await this.mapRepo.find({
      where: { workOrderItem: { workOrder: { projectId } } },
      relations: [
        'workOrderItem',
        'workOrderItem.workOrder',
        'workOrderItem.workOrder.vendor',
        'boqItem',
        'boqSubItem',
      ],
    });

    // 3. Map items to their assigned vendors/WOs
    const registry = boqItems.map((item) => {
      const itemMappings = allMappings.filter((m) => m.boqItemId === item.id);

      const subItemsWithAssigned = item.subItems.map((si) => {
        const subMappings = allMappings.filter((m) => m.boqSubItemId === si.id);
        const assignments = subMappings.map((m) => ({
          woId: m.workOrderItem.workOrder.id,
          woNumber: m.workOrderItem.workOrder.woNumber,
          vendorName: m.workOrderItem.workOrder.vendor.name,
          vendorCode: m.workOrderItem.workOrder.vendor.vendorCode,
          woItemId: m.workOrderItem.id,
          woShortText: m.workOrderItem.shortText,
          factor: m.conversionFactor,
        }));

        return {
          ...si,
          assignments,
          status: assignments.length > 0 ? 'ASSIGNED' : 'PENDING',
        };
      });

      const itemAssignments = itemMappings.map((m) => ({
        woId: m.workOrderItem.workOrder.id,
        woNumber: m.workOrderItem.workOrder.woNumber,
        vendorName: m.workOrderItem.workOrder.vendor.name,
        vendorCode: m.workOrderItem.workOrder.vendor.vendorCode,
        woItemId: m.workOrderItem.id,
        woShortText: m.workOrderItem.shortText,
        factor: m.conversionFactor,
      }));

      // A main item is considered "PARTIAL" if some sub-items are PENDING
      // "ASSIGNED" if all are assigned or if the main item itself is assigned
      // "PENDING" if none are assigned
      const hasSubAssignments = subItemsWithAssigned.some(
        (si) => si.status === 'ASSIGNED',
      );
      const allSubAssigned =
        subItemsWithAssigned.length > 0 &&
        subItemsWithAssigned.every((si) => si.status === 'ASSIGNED');
      const mainAssigned = itemAssignments.length > 0;

      let status = 'PENDING';
      if (mainAssigned || allSubAssigned) {
        status = 'ASSIGNED';
      } else if (hasSubAssignments) {
        status = 'PARTIAL';
      }

      return {
        ...item,
        subItems: subItemsWithAssigned,
        assignments: itemAssignments,
        status,
      };
    });

    return registry;
  }

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

    const saved = await this.mapRepo.save(mapping);
    await this.syncWorkOrderProgress(woItemId);
    return saved;
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

    // 1. Find or Create Vendor with all fields
    let vendor = await this.vendorRepo.findOne({
      where: { vendorCode: vendorInfo.code },
    });
    if (!vendor) {
      vendor = this.vendorRepo.create({
        vendorCode: vendorInfo.code,
        name: vendorInfo.name || `Unknown Vendor (${vendorInfo.code})`,
        address: vendorInfo.address,
        gstin: vendorInfo.gstin,
        pan: vendorInfo.pan,
        state: vendorInfo.state,
        mobileNumber: vendorInfo.mobileNumber,
        telNo: vendorInfo.telNo,
        faxNo: vendorInfo.faxNo,
        contactEmail: vendorInfo.email,
        uamNo: vendorInfo.uamNo,
        kindAttention: vendorInfo.kindAttention,
      });
      await this.vendorRepo.save(vendor);
    } else {
      // Update vendor with any new info if provided
      let hasUpdates = false;
      if (vendorInfo.gstin && !vendor.gstin) {
        vendor.gstin = vendorInfo.gstin;
        hasUpdates = true;
      }
      if (vendorInfo.pan && !vendor.pan) {
        vendor.pan = vendorInfo.pan;
        hasUpdates = true;
      }
      if (vendorInfo.state && !vendor.state) {
        vendor.state = vendorInfo.state;
        hasUpdates = true;
      }
      if (vendorInfo.mobileNumber && !vendor.mobileNumber) {
        vendor.mobileNumber = vendorInfo.mobileNumber;
        hasUpdates = true;
      }
      if (vendorInfo.email && !vendor.contactEmail) {
        vendor.contactEmail = vendorInfo.email;
        hasUpdates = true;
      }
      if (hasUpdates) await this.vendorRepo.save(vendor);
    }

    // 2. Create Work Order with all new fields
    const workOrderData: Partial<WorkOrder> = {
      projectId,
      woNumber: woInfo.woNumber || `TEMP-${Date.now()}`,
      orderAmendNo: woInfo.orderAmendNo,
      woDate: woInfo.date ? new Date(woInfo.date) : new Date(),
      orderAmendDate: woInfo.orderAmendDate
        ? new Date(woInfo.orderAmendDate)
        : undefined,
      orderValidityStart: woInfo.orderValidityStart
        ? new Date(woInfo.orderValidityStart)
        : undefined,
      orderValidityEnd: woInfo.orderValidityEnd
        ? new Date(woInfo.orderValidityEnd)
        : undefined,
      orderType: woInfo.orderType,
      projectCode: woInfo.projectCode,
      projectDescription: woInfo.projectDescription,
      invoiceTo: woInfo.invoiceTo,
      scopeOfWork: woInfo.scopeOfWork,
      vendor: vendor,
      status: 'DRAFT',
      pdfPath,
      originalFileName,
      totalAmount: items.reduce(
        (sum: number, item: any) => sum + Number(item.amount || 0),
        0,
      ),
    };
    const workOrder = this.woRepo.create(workOrderData);

    const savedWo = await this.woRepo.save(workOrder);
    const woEntity = Array.isArray(savedWo) ? savedWo[0] : savedWo;

    // 3. Create Items
    const workOrderItems = items.map((item: any) =>
      this.woItemRepo.create({
        workOrder: woEntity,
        serialNumber: item.serialNumber || null,
        parentSerialNumber: item.parentSerialNumber || null,
        level: item.level || 0,
        isParent: item.isParent || false,
        materialCode: item.code,
        shortText: item.description,
        quantity: Number(item.qty || 0),
        uom: item.uom,
        rate: Number(item.rate || 0),
        amount: Number(item.amount || 0),
        calculatedAmount: Number(item.calculatedAmount || item.amount || 0),
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

  // --- Execution / Vendor Discovery ---
  async getVendorsForActivity(activityId: number) {
    // 1. Find BOQ Items linked to this Activity via MeasurementElements
    // We need to look up MeasurementElements where activityId = activityId
    // Then get the distinct BoqItemIds / BoqSubItemIds

    // Note: This requires injecting MeasurementElement repository or using QueryBuilder on BoqItem
    // For now, let's assume we can query via BoqItem if measurements are linked,
    // but the relation is on MeasurementElement.
    // Let's use a raw query or QueryBuilder for efficiency.

    const builder = this.boqItemRepo
      .createQueryBuilder('boqItem')
      .innerJoin('boqItem.measurements', 'measurement')
      .innerJoin('measurement.activity', 'activity')
      .where('activity.id = :activityId', { activityId })
      .select(['boqItem.id', 'boqItem.boqCode', 'boqItem.description']);

    const boqItems = await builder.getMany();
    const boqItemIds = boqItems.map((b) => b.id);

    if (boqItemIds.length === 0) return [];

    // 2. Find Work Orders linked to these BOQ Items OR their Sub-Items
    // The link is now directly on WorkOrderItem via boqItemId (as per new schema)
    // OR via WorkOrderBoqMap (Legacy/Granular) - We are moving to direct link + map

    // Let's find WO Items that map to these BOQ IDs
    const woItems = await this.woItemRepo.find({
      where: [
        // Direct Link (New Architecture)
        // { boqItemId: Any(boqItemIds) } -> TypeORM In(...)
        // We'll filter in memory or loop if list is small, or use find with In
      ],
      relations: ['workOrder', 'workOrder.vendor'],
    });

    // Since we can't easily do "In" without importing In, let's use QueryBuilder again
    const vendors = await this.woItemRepo
      .createQueryBuilder('woItem')
      .leftJoinAndSelect('woItem.workOrder', 'workOrder')
      .leftJoinAndSelect('workOrder.vendor', 'vendor')
      .where('woItem.boqItemId IN (:...ids)', { ids: boqItemIds })
      .andWhere('workOrder.status != :status', { status: 'DRAFT' }) // Only active WOs
      .getMany();

    // 3. Aggregate results by Vendor
    const result = new Map<number, any>();

    for (const item of vendors) {
      const vendor = item.workOrder.vendor;
      if (!result.has(vendor.id)) {
        result.set(vendor.id, {
          vendorId: vendor.id,
          vendorName: vendor.name,
          // Placeholder for aggregation, assuming more properties would be added here
          totalWoItems: 0,
          totalQuantity: 0,
          totalBalanceQty: 0, // Added based on instruction's partial line
        });
      }
      const entry = result.get(vendor.id);
      entry.totalWoItems++;
      entry.totalQuantity += item.quantity;
      const currentExecuted = Number(item.executedQuantity || 0);
      const balance = Number(item.quantity) - currentExecuted;
      entry.totalBalanceQty += balance > 0 ? balance : 0;
    }

    return Array.from(result.values());
  }

  async executeVendorProgress(
    woItemId: number,
    qty: number,
    activityId: number,
    userId?: string,
  ) {
    // 1. Get Work Order Item
    const woItem = await this.woItemRepo.findOne({
      where: { id: woItemId },
      relations: ['workOrder'],
    });
    if (!woItem) throw new NotFoundException('Work Order Item not found');

    // 2. Validate Balance
    const currentExecuted = Number(woItem.executedQuantity || 0);
    const balance = Number(woItem.quantity) - currentExecuted;

    if (qty > balance) {
      throw new BadRequestException(
        `Insufficient WO Balance. Available: ${balance}, Requested: ${qty}`,
      );
    }

    // 3. Update WO Item Progress
    woItem.executedQuantity = currentExecuted + qty;
    await this.woItemRepo.save(woItem);

    // 4. Update BOQ Item Progress (If linked)
    if (woItem.boqItemId) {
      const boqItem = await this.boqItemRepo.findOneBy({
        id: woItem.boqItemId,
      });
      if (boqItem) {
        boqItem.consumedQty = Number(boqItem.consumedQty || 0) + qty;
        await this.boqItemRepo.save(boqItem);
      }
    }

    return { success: true, newExecutedQty: woItem.executedQuantity };
  }

  // --- Excel/CSV Import ---
  async previewExcelFile(file: Express.Multer.File) {
    try {
      const workbook = XLSX.readFile(file.path);
      const sheetNames = workbook.SheetNames;

      // Get first sheet for preview
      const firstSheet = workbook.Sheets[sheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<string[]>(firstSheet, {
        header: 1,
      });

      // Get first 20 rows for preview
      const previewRows = jsonData.slice(0, 20);

      // Detect headers (usually first or second row)
      const potentialHeaders = previewRows.slice(0, 3);

      return {
        success: true,
        sheetNames,
        previewRows,
        potentialHeaders,
        totalRows: jsonData.length,
        fileName: file.originalname,
      };
    } catch (error) {
      console.error('Excel Preview Error:', error);
      throw new BadRequestException('Failed to read Excel file');
    } finally {
      // Clean up temp file
      if (file && file.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch (e) {
          console.warn('Could not delete temp file', e);
        }
      }
    }
  }

  async parseExcelWorkOrder(
    projectId: number,
    file: Express.Multer.File,
    columnMapping: ColumnMapping,
    headerRow: number = 1,
  ) {
    try {
      const workbook = XLSX.readFile(file.path);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, {
        header: 1,
        range: headerRow - 1,
      });

      if (jsonData.length < 2) {
        throw new BadRequestException('Excel file is empty or missing data');
      }

      const rows = jsonData.slice(1);
      const items: ExcelItem[] = [];

      for (const row of rows) {
        if (!row || row.length === 0) continue;

        const serialNum =
          columnMapping.serialNumber !== undefined
            ? String(row[columnMapping.serialNumber] || '').trim()
            : '';
        const sapItem =
          columnMapping.sapItemNumber !== undefined
            ? String(row[columnMapping.sapItemNumber] || '').trim()
            : '';
        const shortDesc =
          columnMapping.shortDescription !== undefined
            ? String(row[columnMapping.shortDescription] || '').trim()
            : '';
        const detailDesc =
          columnMapping.detailDescription !== undefined
            ? String(row[columnMapping.detailDescription] || '').trim()
            : '';
        const uom =
          columnMapping.uom !== undefined
            ? String(row[columnMapping.uom] || '').trim()
            : '';
        const qty =
          columnMapping.quantity !== undefined
            ? this.parseNumber(row[columnMapping.quantity])
            : 0;
        const rate =
          columnMapping.rate !== undefined
            ? this.parseNumber(row[columnMapping.rate])
            : 0;
        const amount =
          columnMapping.amount !== undefined
            ? this.parseNumber(row[columnMapping.amount])
            : qty * rate;

        if (!serialNum && !sapItem && !shortDesc) continue;

        const serialParts = serialNum.split('.');
        const level = Math.max(0, serialParts.length - 1);

        let parentSerial: string | null = null;
        if (level > 0) {
          parentSerial = serialParts.slice(0, -1).join('.');
        }

        items.push({
          serialNumber: serialNum,
          parentSerialNumber: parentSerial,
          level,
          isParent: false,
          materialCode: sapItem,
          shortText: shortDesc,
          longText: detailDesc,
          uom,
          quantity: qty,
          rate,
          amount,
          calculatedAmount: amount,
        });
      }

      this.calculateParentAmounts(items);

      return {
        projectId,
        items,
        filePath: file.path,
        originalFileName: file.originalname,
        totalItems: items.length,
        parentItems: items.filter((i) => i.isParent).length,
        childItems: items.filter((i) => !i.isParent).length,
      };
    } catch (error) {
      console.error('Excel Parse Error:', error);
      throw new BadRequestException(
        'Failed to process Excel file: ' + error.message,
      );
    } finally {
      if (file && file.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch (e) {
          console.warn('Could not delete temp file', e);
        }
      }
    }
  }

  private parseNumber(val: string | number | null | undefined): number {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    const clean = String(val)
      .replace(/,/g, '')
      .replace(/[^\d.-]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }

  private calculateParentAmounts(items: ExcelItem[]) {
    const childrenByParent: Record<string, ExcelItem[]> = {};

    for (const item of items) {
      if (item.parentSerialNumber) {
        if (!childrenByParent[item.parentSerialNumber]) {
          childrenByParent[item.parentSerialNumber] = [];
        }
        childrenByParent[item.parentSerialNumber].push(item);
      }
    }

    for (const item of items) {
      if (childrenByParent[item.serialNumber]) {
        item.isParent = true;
        const children = childrenByParent[item.serialNumber];
        const sumAmount = children.reduce(
          (sum, c) => sum + (c.calculatedAmount || 0),
          0,
        );
        item.calculatedAmount = sumAmount;
        if (!item.amount) item.amount = sumAmount;
      }
    }
  }

  // --- Intelligent Mapping & Fuzzy Logic ---

  /**
   * Find potential BOQ matches for a given search string.
   * Uses simple token-based overlap and Levenshtein distance for ranking.
   */
  async findMatchingBoqItems(
    projectId: number,
    searchText: string,
    limit: number = 5,
  ) {
    if (!searchText) return [];

    // clean search text
    const cleanSearch = searchText
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .trim();
    if (!cleanSearch) return [];

    // 1. Fetch Candidates from DB (filtering by projectId)
    // We fetch a bit more than limit to rank them in memory
    // Optimisation: use SQL LIKE for token matches if dataset is large
    // For now, fetching broader set based on simple LIKE or just fetching active BOQ items

    // Let's try to match by code or description in DB first
    const candidates = await this.boqItemRepo
      .createQueryBuilder('boq')
      .where('boq.projectId = :projectId', { projectId })
      .andWhere(
        '(LOWER(boq.description) LIKE :search OR LOWER(boq.boqCode) LIKE :search)',
        { search: `%${cleanSearch.split(' ')[0]}%` }, // Match at least first word
      )
      .limit(50) // Fetch top 50 candidates
      .getMany();

    // 2. Rank in Memory
    const scored = candidates.map((boq) => {
      let score = 0;
      const cleanDesc = (boq.description || '')
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, '');
      const cleanCode = (boq.boqCode || '').toLowerCase();

      // Exact Code Match
      if (cleanCode === cleanSearch) score += 100;
      else if (cleanCode.includes(cleanSearch)) score += 50;

      // Token Overlap (Jaccard-ish)
      const searchTokens = new Set(cleanSearch.split(' '));
      const descTokens = new Set(cleanDesc.split(' '));
      let overlap = 0;
      searchTokens.forEach((t) => {
        if (descTokens.has(t)) overlap++;
      });

      score += (overlap / searchTokens.size) * 40;

      // Exact substring match
      if (cleanDesc.includes(cleanSearch)) score += 30;

      return { boq, score };
    });

    // 3. Sort and slice
    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.boq);
  }

  /**
   * Auto-map unmapped Work Order items based on exact code or high-confidence description match.
   */
  async autoMapWorkOrder(workOrderId: number) {
    const wo = await this.woRepo.findOne({
      where: { id: workOrderId },
      relations: ['items'],
    });
    if (!wo) throw new NotFoundException('Work Order not found');

    let updatedCount = 0;

    for (const item of wo.items || []) {
      if (item.boqItemId) continue; // Already mapped

      // Strategy 1: Exact Code Match (if material code exists)
      if (item.materialCode) {
        const boqByCode = await this.boqItemRepo.findOne({
          where: {
            projectId: wo.projectId,
            boqCode: item.materialCode,
          },
        });

        if (boqByCode) {
          item.boqItemId = boqByCode.id;
          item.mappingStatus = 'AUTO_CODE';
          await this.woItemRepo.save(item);
          updatedCount++;
          continue;
        }
      }

      // Strategy 2: High Confidence Description Match
      // (Simplified: if we find a very high score match)
      const matches = await this.findMatchingBoqItems(
        wo.projectId,
        item.shortText || item.longText,
        1,
      );
      if (matches.length > 0) {
        // We'd need a threshold here, but for "AUTO" we usually want near-exact.
        // Let's skipping strict auto-map by description for safety unless exact.
        // Or implement if needed. For now, we leave description mapping to manual/suggestion.
      }
    }

    return { success: true, updatedCount };
  }

  /**
   * Bulk link/unlink Work Order Items to BOQ Items
   */
  async bulkMapWorkOrderItems(
    projectId: number,
    mappings: { woItemId: number; boqItemId: number | null }[],
  ) {
    // Determine BOQ IDs to validate
    const boqIds = mappings
      .map((m) => m.boqItemId)
      .filter((id): id is number => id !== null);

    // Validate BOQ Items exist and belong to project (optional check)
    // ...

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const map of mappings) {
        await queryRunner.manager.update(WorkOrderItem, map.woItemId, {
          boqItemId: map.boqItemId as any, // Allow null
          mappingStatus: map.boqItemId ? 'MANUAL' : 'PENDING',
        });
      }
      await queryRunner.commitTransaction();
      return { success: true, count: mappings.length };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
