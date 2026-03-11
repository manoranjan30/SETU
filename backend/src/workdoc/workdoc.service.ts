import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';

import { WorkOrder } from './entities/work-order.entity';
import { WorkOrderItem } from './entities/work-order-item.entity';
import { Vendor } from './entities/vendor.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';
import { BoqSubItem } from '../boq/entities/boq-sub-item.entity';
import { MeasurementElement } from '../boq/entities/measurement-element.entity';
import { WorkDocTemplate } from './entities/work-doc-template.entity';
import { TempUser } from '../temp-user/entities/temp-user.entity';
import { WoActivityPlan } from '../planning/entities/wo-activity-plan.entity';

interface BoqSelectionItem {
  boqItemId: number;
  boqSubItemId?: number;
  measurementElementId?: number;
  allocatedQty: number;
  rate: number;
  woRefText?: string;
}

interface CreateWoFromBoqDto {
  vendorId: number;
  woNumber: string;
  woDate?: string;
  validityStart?: string;
  validityEnd?: string;
  scopeOfWork?: string;
  woRefText?: string;
  woRefNumber?: string;
  woRefDate?: string;
  items: BoqSelectionItem[];
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
    @InjectRepository(BoqItem)
    private boqItemRepo: Repository<BoqItem>,
    @InjectRepository(BoqSubItem)
    private boqSubItemRepo: Repository<BoqSubItem>,
    @InjectRepository(MeasurementElement)
    private measurementRepo: Repository<MeasurementElement>,
    @InjectRepository(WorkDocTemplate)
    private templateRepo: Repository<WorkDocTemplate>,
    @InjectRepository(TempUser)
    private tempUserRepo: Repository<TempUser>,
    @InjectRepository(WoActivityPlan)
    private planRepo: Repository<WoActivityPlan>,
    private readonly httpService: HttpService,
    private dataSource: DataSource,
  ) {}

  // ===========================
  // Vendors CRUD
  // ===========================

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
    return this.vendorRepo.findOne({ where: { vendorCode: code } }) || null;
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
        message: `Cannot delete vendor. ${workOrders.length} work order(s) are assigned.`,
      };
    }

    await this.vendorRepo.remove(vendor);
    return { success: true, message: 'Vendor deleted successfully' };
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

  // ===========================
  // Templates CRUD
  // ===========================

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

  // ===========================
  // Work Orders CRUD
  // ===========================

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
    const wo = await this.woRepo.findOne({
      where: { id: woId },
      relations: ['items'],
    });
    if (!wo) throw new NotFoundException('Work Order not found');

    const hasProgress = wo.items?.some(
      (item) => Number(item.executedQuantity || 0) > 0,
    );
    if (hasProgress) {
      throw new BadRequestException(
        `Cannot delete Work Order ${wo.woNumber} because it already has execution progress recorded.`,
      );
    }
    return this.woRepo.remove(wo);
  }

  async getWorkOrderDetails(woId: number) {
    const wo = await this.woRepo.findOne({
      where: { id: woId },
      relations: [
        'vendor',
        'items',
        'items.boqItem',
        'items.boqSubItem',
        'items.measurementElement',
      ],
    });
    if (!wo) throw new NotFoundException('Work order not found');
    return wo;
  }

  async updateWorkOrderStatus(
    woId: number,
    status: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'CANCELLED' | 'INACTIVE',
  ) {
    const wo = await this.woRepo.findOneBy({ id: woId });
    if (!wo) throw new NotFoundException('Work order not found');

    wo.status = status;
    await this.woRepo.save(wo);

    if (
      status === 'CLOSED' ||
      status === 'CANCELLED' ||
      status === 'INACTIVE'
    ) {
      await this.tempUserRepo.update(
        { workOrder: { id: woId }, status: 'ACTIVE' },
        {
          status: 'EXPIRED',
          suspendedAt: new Date(),
          suspensionReason: `Work Order ${status}`,
        },
      );
    }
    return wo;
  }

  async updateWorkOrder(woId: number, updateDto: any) {
    const wo = await this.woRepo.findOne({ where: { id: woId } });
    if (!wo) throw new NotFoundException('Work order not found');

    if (updateDto.orderType !== undefined) wo.orderType = updateDto.orderType;
    if (updateDto.woNumber !== undefined) wo.woNumber = updateDto.woNumber;
    if (updateDto.woDate !== undefined) wo.woDate = updateDto.woDate;
    if (updateDto.orderAmendNo !== undefined)
      wo.orderAmendNo = updateDto.orderAmendNo;
    if (updateDto.projectCode !== undefined)
      wo.projectCode = updateDto.projectCode;
    if (updateDto.scopeOfWork !== undefined)
      wo.scopeOfWork = updateDto.scopeOfWork;

    return this.woRepo.save(wo);
  }

  async getWorkOrderLinkageData(projectId: number, woId: number) {
    // 1. Get BOQ Tree
    const boqTree = await this.getBoqTreeForWoCreation(projectId);

    // 2. Get existing mappings for this specific Work Order
    const mappings = await this.dataSource
      .getRepository('WorkOrderBoqMap')
      .find({
        where: { workOrderItem: { workOrder: { id: woId } } },
        relations: ['workOrderItem', 'boqItem', 'boqSubItem'],
      });

    return {
      boqTree,
      mappings,
    };
  }

  async saveWorkOrderItemMappings(woItemId: number, mappings: any[]) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const repo = queryRunner.manager.getRepository('WorkOrderBoqMap');

      // Clear existing
      await repo.delete({ workOrderItem: { id: woItemId } });

      // Add new
      for (const m of mappings) {
        const mapEntry = repo.create({
          workOrderItem: { id: woItemId },
          boqItem: m.boqItemId ? { id: m.boqItemId } : null,
          boqSubItem: m.boqSubItemId ? { id: m.boqSubItemId } : null,
          conversionFactor: m.factor || 1,
        });
        await repo.save(mapEntry);
      }

      await queryRunner.commitTransaction();
      return { success: true };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async updateWorkOrderItems(woId: number, items: any[]) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let newTotal = 0;
      for (const itemData of items) {
        const item = await queryRunner.manager.findOne(WorkOrderItem, {
          where: { id: itemData.id },
        });
        if (item) {
          item.allocatedQty = Number(itemData.allocatedQty);
          item.rate = Number(itemData.rate);
          item.amount = item.allocatedQty * item.rate;
          await queryRunner.manager.save(item);
          newTotal += item.amount;
        }
      }

      // Update WO total
      await queryRunner.manager.update(WorkOrder, woId, {
        totalAmount: newTotal,
      });

      await queryRunner.commitTransaction();
      return { success: true, totalAmount: newTotal };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // =============================================
  // BOQ → WO Creation (NEW core functionality)
  // =============================================

  async getBoqTreeForWoCreation(projectId: number) {
    const boqItems = await this.boqItemRepo.find({
      where: { projectId },
      relations: ['subItems', 'subItems.measurements'],
      order: { boqCode: 'ASC' },
    });

    // 1. Get ALL allocations for this project to avoid multiple queries
    const allWoItems = await this.woItemRepo.find({
      where: {
        workOrder: {
          projectId,
          status: In(['ACTIVE', 'IN_PROGRESS']),
        },
      },
    });

    const calculateAvailable = (
      total: number,
      boqId: number,
      subId?: number,
      measureId?: number,
    ) => {
      let allocated = 0;
      if (measureId) {
        // Measurement level allocation
        allocated = allWoItems
          .filter((wi) => wi.measurementElementId === measureId)
          .reduce((sum, wi) => sum + Number(wi.allocatedQty || 0), 0);
      } else if (subId) {
        // Sub-Item level allocation (direct + any measurements under it)
        allocated = allWoItems
          .filter((wi) => wi.boqSubItemId === subId)
          .reduce((sum, wi) => sum + Number(wi.allocatedQty || 0), 0);
      } else {
        // Item level allocation (direct + any sub-items/measurements under it)
        allocated = allWoItems
          .filter((wi) => wi.boqItemId === boqId)
          .reduce((sum, wi) => sum + Number(wi.allocatedQty || 0), 0);
      }
      return {
        allocatedToWo: allocated,
        availableQty: Math.max(0, Number(total || 0) - allocated),
      };
    };

    const tree = boqItems.map((item) => {
      const { allocatedToWo, availableQty } = calculateAvailable(
        item.qty,
        item.id,
      );

      const subItems = (item.subItems || []).map((sub) => {
        const { allocatedToWo: subAlloc, availableQty: subAvail } =
          calculateAvailable(sub.qty, item.id, sub.id);

        const measurements = (sub.measurements || []).map((m) => {
          const { allocatedToWo: mAlloc, availableQty: mAvail } =
            calculateAvailable(m.qty, item.id, sub.id, m.id);
          return {
            ...m,
            allocatedToWo: mAlloc,
            availableQty: mAvail,
          };
        });

        return {
          ...sub,
          measurements,
          allocatedToWo: subAlloc,
          availableQty: subAvail,
        };
      });

      return {
        ...item,
        subItems,
        allocatedToWo,
        availableQty,
      };
    });

    return tree;
  }

  async getBoqAllocatedQty(
    boqItemId: number,
    projectId: number,
  ): Promise<number> {
    const result = await this.woItemRepo
      .createQueryBuilder('woItem')
      .innerJoin('woItem.workOrder', 'wo')
      .where('woItem.boqItemId = :boqItemId', { boqItemId })
      .andWhere('wo.projectId = :projectId', { projectId })
      .andWhere('wo.status IN (:...statuses)', {
        statuses: ['ACTIVE', 'IN_PROGRESS'],
      })
      .select('COALESCE(SUM(woItem.allocatedQty), 0)', 'total')
      .getRawOne();

    return Number(result?.total || 0);
  }

  async getBoqSubItemAllocatedQty(
    boqSubItemId: number,
    projectId: number,
  ): Promise<number> {
    const result = await this.woItemRepo
      .createQueryBuilder('woItem')
      .innerJoin('woItem.workOrder', 'wo')
      .where('woItem.boqSubItemId = :boqSubItemId', { boqSubItemId })
      .andWhere('wo.projectId = :projectId', { projectId })
      .andWhere('wo.status IN (:...statuses)', {
        statuses: ['ACTIVE', 'IN_PROGRESS'],
      })
      .select('COALESCE(SUM(woItem.allocatedQty), 0)', 'total')
      .getRawOne();

    return Number(result?.total || 0);
  }

  async getMeasurementAllocatedQty(
    measurementElementId: number,
    projectId: number,
  ): Promise<number> {
    const result = await this.woItemRepo
      .createQueryBuilder('woItem')
      .innerJoin('woItem.workOrder', 'wo')
      .where('woItem.measurementElementId = :measurementElementId', {
        measurementElementId,
      })
      .andWhere('wo.projectId = :projectId', { projectId })
      .andWhere('wo.status IN (:...statuses)', {
        statuses: ['ACTIVE', 'IN_PROGRESS'],
      })
      .select('COALESCE(SUM(woItem.allocatedQty), 0)', 'total')
      .getRawOne();

    return Number(result?.total || 0);
  }

  async createWoFromBoq(projectId: number, body: any) {
    // 0. Extract Data (Handling both legacy and new 'confirm' format)
    const vendorId = body.vendorId;
    const vendorCode = body.vendor?.code;
    const items = body.items || [];

    // Header can be nested or top-level
    const header = body.header || body;

    let vendor;
    if (vendorId) {
      vendor = await this.vendorRepo.findOneBy({ id: vendorId });
    } else if (vendorCode) {
      vendor = await this.vendorRepo.findOneBy({ vendorCode });
    }

    if (!vendor) throw new NotFoundException('Vendor not found');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create Work Order
      const wo = queryRunner.manager.create(WorkOrder, {
        projectId,
        woNumber: header.woNumber || `WO-${Date.now()}`,
        vendor,
        woDate:
          header.date || header.woDate
            ? new Date(header.date || header.woDate)
            : new Date(),
        orderValidityStart:
          header.orderValidityStart || header.validityStart
            ? new Date(header.orderValidityStart || header.validityStart)
            : undefined,
        orderValidityEnd:
          header.orderValidityEnd || header.validityEnd
            ? new Date(header.orderValidityEnd || header.validityEnd)
            : undefined,
        scopeOfWork: header.scopeOfWork,
        woRefText: header.woRefText,
        woRefNumber: header.woRefNumber,
        woRefDate: header.woRefDate ? new Date(header.woRefDate) : undefined,
        source: 'BOQ_DERIVED',
        status: 'ACTIVE',
        totalAmount: 0,
      } as Partial<WorkOrder>);

      const savedWo = await queryRunner.manager.save(wo);

      // 2. Process BOQ items selection
      let totalAmount = 0;
      const createdItems: WorkOrderItem[] = [];

      for (const sel of items) {
        // Normalize quantity (support 'allocatedQty' from BOQ and 'qty' from manual/generic)
        const currentAllocatedQty = Number(sel.allocatedQty || sel.qty || 0);
        if (currentAllocatedQty <= 0) continue;

        let available = 0;
        let originalQty = 0;
        let materialCode = sel.code || `ITEM-${Date.now()}`;
        let description = sel.description;
        let uom = sel.uom || 'NOS';
        let level = 0;

        // If it's a BOQ-linked item, perform validation
        if (sel.boqItemId) {
          const boqItem = await this.boqItemRepo.findOne({
            where: { id: sel.boqItemId },
            relations: ['subItems'],
          });

          if (boqItem) {
            materialCode = boqItem.boqCode;
            description = boqItem.description;
            uom = boqItem.uom || uom;

            if (sel.measurementElementId) {
              const m = await this.measurementRepo.findOneBy({
                id: sel.measurementElementId,
              });
              if (m) {
                const allocated = await this.getMeasurementAllocatedQty(
                  m.id,
                  projectId,
                );
                available = Number(m.qty || 0) - allocated;
                originalQty = Number(m.qty || 0);
                description = m.elementName;
                level = 2;
              }
            } else if (sel.boqSubItemId) {
              const s = await this.boqSubItemRepo.findOneBy({
                id: sel.boqSubItemId,
              });
              if (s) {
                const allocated = await this.getBoqSubItemAllocatedQty(
                  s.id,
                  projectId,
                );
                available = Number(s.qty || 0) - allocated;
                originalQty = Number(s.qty || 0);
                description = s.description;
                level = 1;
              }
            } else {
              const allocated = await this.getBoqAllocatedQty(
                boqItem.id,
                projectId,
              );
              available = Number(boqItem.qty || 0) - allocated;
              originalQty = Number(boqItem.qty || 0);
              level = 0;
            }

            if (currentAllocatedQty > available) {
              throw new BadRequestException(
                `Insufficient balance for "${description}". Available: ${available}, Requested: ${currentAllocatedQty}`,
              );
            }
          }
        }

        const woItem = queryRunner.manager.create(WorkOrderItem, {
          workOrder: savedWo,
          boqItemId: sel.boqItemId || null,
          boqSubItemId: sel.boqSubItemId || null,
          measurementElementId: sel.measurementElementId || null,
          level: sel.level !== undefined ? sel.level : level,
          description: sel.description || description,
          materialCode: sel.code || materialCode,
          uom: sel.uom || uom || 'NOS',
          serialNumber: sel.serialNumber || null,
          parentSerialNumber: sel.parentSerialNumber || null,
          isParent: !!sel.isParent,
          boqQty: originalQty,
          allocatedQty: currentAllocatedQty,
          rate: Number(sel.rate || 0),
          amount: currentAllocatedQty * Number(sel.rate || 0),
          woRefText: sel.woRefText || null,
          status: 'ACTIVE',
        } as Partial<WorkOrderItem>);

        const savedItem = await queryRunner.manager.save(woItem);
        createdItems.push(savedItem);
        totalAmount += currentAllocatedQty * Number(sel.rate || 0);
      }

      // 3. Update total amount
      savedWo.totalAmount = totalAmount;
      await queryRunner.manager.save(savedWo);

      await queryRunner.commitTransaction();

      return {
        id: savedWo.id,
        woNumber: savedWo.woNumber,
        message: 'Work Order created from BOQ successfully',
        itemCount: createdItems.length,
        totalAmount,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async addBoqItemsToWo(woId: number, items: BoqSelectionItem[]) {
    const wo = await this.woRepo.findOne({
      where: { id: woId },
      relations: ['vendor'],
    });
    if (!wo) throw new NotFoundException('Work Order not found');

    const projectId = wo.projectId;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let addedAmount = 0;

      for (const sel of items) {
        // Validate BOQ item exists
        const boqItem = await this.boqItemRepo.findOne({
          where: { id: sel.boqItemId },
          relations: ['subItems'],
        });
        if (!boqItem)
          throw new BadRequestException(
            `BOQ Item ID ${sel.boqItemId} not found`,
          );

        // Determine level and check available qty
        let available = 0;
        let originalQty = 0;
        const materialCode = boqItem.boqCode;
        let description = boqItem.description;
        const uom = boqItem.uom;
        let level = 0;

        if (sel.measurementElementId) {
          const m = await this.measurementRepo.findOneBy({
            id: sel.measurementElementId,
          });
          if (!m)
            throw new BadRequestException(
              `Measurement ID ${sel.measurementElementId} not found`,
            );
          const allocated = await this.getMeasurementAllocatedQty(
            m.id,
            projectId,
          );
          available = Number(m.qty || 0) - allocated;
          originalQty = Number(m.qty || 0);
          description = m.elementName;
          level = 2;
        } else if (sel.boqSubItemId) {
          const s = await this.boqSubItemRepo.findOneBy({
            id: sel.boqSubItemId,
          });
          if (!s)
            throw new BadRequestException(
              `Sub-Item ID ${sel.boqSubItemId} not found`,
            );
          const allocated = await this.getBoqSubItemAllocatedQty(
            s.id,
            projectId,
          );
          available = Number(s.qty || 0) - allocated;
          originalQty = Number(s.qty || 0);
          description = s.description;
          level = 1;
        } else {
          const allocated = await this.getBoqAllocatedQty(
            boqItem.id,
            projectId,
          );
          available = Number(boqItem.qty || 0) - allocated;
          originalQty = Number(boqItem.qty || 0);
          level = 0;
        }

        if (sel.allocatedQty > available) {
          throw new BadRequestException(
            `Insufficient balance for "${description}". Available: ${available}, Requested: ${sel.allocatedQty}`,
          );
        }

        const woItem = queryRunner.manager.create(WorkOrderItem, {
          workOrder: wo,
          boqItemId: sel.boqItemId,
          boqSubItemId: sel.boqSubItemId || null,
          measurementElementId: sel.measurementElementId || null,
          level,
          description,
          materialCode,
          uom: uom || 'NOS',
          boqQty: originalQty,
          allocatedQty: sel.allocatedQty,
          rate: sel.rate,
          amount: sel.allocatedQty * sel.rate,
          woRefText: sel.woRefText || null,
          status: 'ACTIVE',
        } as Partial<WorkOrderItem>);

        await queryRunner.manager.save(woItem);
        addedAmount += sel.allocatedQty * sel.rate;
      }

      // Update WO total
      wo.totalAmount = Number(wo.totalAmount || 0) + addedAmount;
      await queryRunner.manager.save(wo);

      await queryRunner.commitTransaction();
      return { success: true, itemsAdded: items.length, addedAmount };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getAvailableBoqQty(projectId: number) {
    return this.getBoqTreeForWoCreation(projectId);
  }

  // ===========================
  // Vendor Discovery for Progress
  // ===========================

  async getVendorsForActivity(activityId: number) {
    const vendors = await this.woItemRepo
      .createQueryBuilder('woItem')
      .leftJoinAndSelect('woItem.workOrder', 'workOrder')
      .leftJoinAndSelect('workOrder.vendor', 'vendor')
      .innerJoin(
        WoActivityPlan,
        'wap',
        'wap.work_order_item_id = woItem.id AND wap.activity_id = :activityId',
        { activityId },
      )
      .where('workOrder.status IN (:...statuses)', {
        statuses: ['ACTIVE', 'IN_PROGRESS'],
      })
      .getMany();

    const result = new Map<number, any>();

    for (const item of vendors) {
      const vendor = item.workOrder.vendor;
      if (!vendor || result.has(vendor.id)) {
        if (vendor && result.has(vendor.id)) {
          const entry = result.get(vendor.id);
          entry.totalWoItems++;
          entry.totalQuantity += Number(item.allocatedQty || 0);
          const balance =
            Number(item.allocatedQty || 0) - Number(item.executedQuantity || 0);
          entry.totalBalanceQty += balance > 0 ? balance : 0;
        }
        continue;
      }

      const balance =
        Number(item.allocatedQty || 0) - Number(item.executedQuantity || 0);
      result.set(vendor.id, {
        vendorId: vendor.id,
        vendorName: vendor.name,
        vendorCode: vendor.vendorCode,
        totalWoItems: 1,
        totalQuantity: Number(item.allocatedQty || 0),
        totalBalanceQty: balance > 0 ? balance : 0,
      });
    }

    return Array.from(result.values());
  }

  // ===========================
  // WO Item Progress Execution
  // ===========================

  async executeVendorProgress(
    woItemId: number,
    qty: number,
    activityId: number,
    userId?: string,
  ) {
    const woItem = await this.woItemRepo.findOne({
      where: { id: woItemId },
      relations: ['workOrder'],
    });
    if (!woItem) throw new NotFoundException('Work Order Item not found');

    const currentExecuted = Number(woItem.executedQuantity || 0);
    const balance = Number(woItem.allocatedQty) - currentExecuted;

    if (qty > balance) {
      throw new BadRequestException(
        `Insufficient WO Balance. Available: ${balance}, Requested: ${qty}`,
      );
    }

    // Update WO Item Progress
    woItem.executedQuantity = currentExecuted + qty;
    await this.woItemRepo.save(woItem);

    // Update BOQ Item consumed qty (BOQ tracks cumulative across all WOs)
    if (woItem.boqItemId) {
      const boqItem = await this.boqItemRepo.findOneBy({
        id: woItem.boqItemId,
      });
      if (boqItem) {
        boqItem.consumedQty = Number(boqItem.consumedQty || 0) + qty;
        await this.boqItemRepo.save(boqItem);
      }
    }

    return {
      success: true,
      newExecutedQty: woItem.executedQuantity,
      woRate: Number(woItem.rate),
      actualValue: qty * Number(woItem.rate),
    };
  }

  // ===========================
  // WO Items for Activity (grouped by vendor)
  // ===========================

  async getWoItemsForMapper(projectId: number) {
    // 1. Fetch all WO items with full relations
    const items = await this.woItemRepo
      .createQueryBuilder('woItem')
      .leftJoinAndSelect('woItem.workOrder', 'workOrder')
      .leftJoinAndSelect('workOrder.vendor', 'vendor')
      .leftJoinAndSelect('woItem.boqItem', 'boqItem')
      .leftJoinAndSelect('woItem.boqSubItem', 'boqSubItem')
      .leftJoinAndSelect('woItem.measurementElement', 'measurementElement')
      .where('workOrder.projectId = :projectId', { projectId })
      .andWhere('workOrder.status IN (:...statuses)', {
        statuses: ['ACTIVE', 'IN_PROGRESS'],
      })
      .getMany();

    // 2. Fetch linked activity plans for this project
    const plans = await this.planRepo.find({
      where: { projectId },
      relations: ['activity'],
    });
    // Map: workOrderItemId -> activity name(s)
    const woItemActivityMap = new Map<number, string[]>();
    for (const plan of plans) {
      const arr = woItemActivityMap.get(plan.workOrderItemId) || [];
      arr.push(plan.activity?.activityName || `Activity #${plan.activityId}`);
      woItemActivityMap.set(plan.workOrderItemId, arr);
    }

    // 3. Build hierarchical tree: Vendor → WO → BOQ Main → Sub → Measurement
    const vendorMap = new Map<number, any>();

    for (const item of items) {
      const vendor = item.workOrder?.vendor;
      const vendorId = vendor?.id || 0;
      const vendorName = vendor?.name || 'Unknown Vendor';

      if (!vendorMap.has(vendorId)) {
        vendorMap.set(vendorId, {
          vendorId,
          vendorName,
          workOrders: new Map<number, any>(),
        });
      }
      const vendorNode = vendorMap.get(vendorId);

      const wo = item.workOrder;
      const woId = wo.id;
      if (!vendorNode.workOrders.has(woId)) {
        vendorNode.workOrders.set(woId, {
          workOrderId: woId,
          woNumber: wo.woNumber,
          boqItems: new Map<number, any>(),
        });
      }
      const woNode = vendorNode.workOrders.get(woId);

      // Determine BOQ Main
      const boqItem = item.boqItem;
      const boqItemId = boqItem?.id || 0;
      if (!woNode.boqItems.has(boqItemId)) {
        woNode.boqItems.set(boqItemId, {
          boqItemId,
          boqCode: boqItem?.boqCode || '',
          description: boqItem?.description || 'Manual Item',
          uom: boqItem?.uom || 'N/A',
          subItems: new Map<number, any>(),
          directWoItems: [], // WO items that are at main level (no sub/meas)
        });
      }
      const boqNode = woNode.boqItems.get(boqItemId);

      const linkedActivities = woItemActivityMap.get(item.id) || [];
      const mappingStatus = linkedActivities.length > 0 ? 'MAPPED' : 'UNMAPPED';

      const woItemFlat = {
        workOrderItemId: item.id,
        description: item.description,
        qty: Number(item.allocatedQty),
        uom: item.uom || boqItem?.uom || 'N/A',
        rate: Number(item.rate),
        amount: Number(item.amount),
        mappingStatus,
        linkedActivities: linkedActivities.join(', '),
      };

      // Place into correct hierarchy level
      if (item.measurementElementId && item.boqSubItemId) {
        // Measurement under a Sub-Item
        const subId = item.boqSubItemId;
        if (!boqNode.subItems.has(subId)) {
          boqNode.subItems.set(subId, {
            boqSubItemId: subId,
            description: item.boqSubItem?.description || 'Sub Item',
            measurements: [],
          });
        }
        boqNode.subItems.get(subId).measurements.push(woItemFlat);
      } else if (item.boqSubItemId) {
        // Sub-Item level
        const subId = item.boqSubItemId;
        if (!boqNode.subItems.has(subId)) {
          boqNode.subItems.set(subId, {
            boqSubItemId: subId,
            description: item.boqSubItem?.description || 'Sub Item',
            measurements: [],
          });
        }
        // Store as a direct sub-item WO entry (the sub itself has a WO item)
        boqNode.subItems.get(subId).woItem = woItemFlat;
      } else {
        // Main item level
        boqNode.directWoItems.push(woItemFlat);
      }
    }

    // 4. Serialize Maps into arrays for JSON
    const result: any[] = [];
    for (const [, vendorNode] of vendorMap) {
      const vendorObj: any = {
        vendorId: vendorNode.vendorId,
        vendorName: vendorNode.vendorName,
        workOrders: [],
      };
      for (const [, woNode] of vendorNode.workOrders) {
        const woObj: any = {
          workOrderId: woNode.workOrderId,
          woNumber: woNode.woNumber,
          boqItems: [],
        };
        for (const [, boqNode] of woNode.boqItems) {
          const boqObj: any = {
            boqItemId: boqNode.boqItemId,
            boqCode: boqNode.boqCode,
            description: boqNode.description,
            uom: boqNode.uom,
            directWoItems: boqNode.directWoItems,
            subItems: [],
          };
          for (const [, subNode] of boqNode.subItems) {
            boqObj.subItems.push({
              boqSubItemId: subNode.boqSubItemId,
              description: subNode.description,
              woItem: subNode.woItem || null,
              measurements: subNode.measurements,
            });
          }
          woObj.boqItems.push(boqObj);
        }
        vendorObj.workOrders.push(woObj);
      }
      result.push(vendorObj);
    }

    return result;
  }

  async getWoItemsForActivity(activityId: number, vendorId?: number) {
    let query = this.woItemRepo
      .createQueryBuilder('woItem')
      .leftJoinAndSelect('woItem.workOrder', 'workOrder')
      .leftJoinAndSelect('workOrder.vendor', 'vendor')
      .leftJoinAndSelect('woItem.boqItem', 'boqItem')
      .innerJoin(
        WoActivityPlan,
        'wap',
        'wap.work_order_item_id = woItem.id AND wap.activity_id = :activityId',
        { activityId },
      )
      .where('workOrder.status IN (:...statuses)', {
        statuses: ['ACTIVE', 'IN_PROGRESS'],
      });

    if (vendorId) {
      query = query.andWhere('vendor.id = :vendorId', { vendorId });
    }

    return query.getMany();
  }
}
