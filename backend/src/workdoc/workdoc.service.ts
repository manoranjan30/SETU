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
import { WorkOrderBoqMap } from './entities/work-order-boq-map.entity';
import { TempUser } from '../temp-user/entities/temp-user.entity';
import { WoActivityPlan } from '../planning/entities/wo-activity-plan.entity';
import {
  WorkOrderItemNodeType,
  WorkOrderItemScopeMode,
} from './entities/work-order-item.entity';

interface BoqSelectionItem {
  boqItemId: number;
  boqSubItemId?: number;
  measurementElementId?: number;
  allocatedQty: number;
  qty?: number;
  rate: number;
  woRefText?: string;
  issueScopeMode?: WorkOrderItemScopeMode | string;
  issuedScopeSummary?: string;
  pendingScopeSummary?: string;
  creepScopeSummary?: string;
  scopeCreepReason?: string;
  issuedScopeComponents?: string[];
  pendingScopeComponents?: string[];
  creepScopeComponents?: string[];
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

type WorkOrderNodeCache = Map<string, WorkOrderItem>;

interface NormalizedScopePayload {
  issueScopeMode: WorkOrderItemScopeMode;
  issuedScopeSummary: string | null;
  pendingScopeSummary: string | null;
  creepScopeSummary: string | null;
  scopeCreepReason: string | null;
  issuedScopeComponents: string[] | null;
  pendingScopeComponents: string[] | null;
  creepScopeComponents: string[] | null;
  hasPendingScope: boolean;
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

  private normalizeScopePayload(
    input?: Partial<BoqSelectionItem>,
  ): NormalizedScopePayload {
    const rawMode = String(
      input?.issueScopeMode || WorkOrderItemScopeMode.FULL_SCOPE,
    ).toUpperCase();
    const issueScopeMode =
      rawMode === WorkOrderItemScopeMode.SPLIT_SCOPE ||
      rawMode === WorkOrderItemScopeMode.CREEP_SCOPE
        ? (rawMode as WorkOrderItemScopeMode)
        : WorkOrderItemScopeMode.FULL_SCOPE;

    const normalizeSummary = (value?: string) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : null;
    };
    const normalizeComponents = (value?: string[]) => {
      const list = (value || [])
        .map((entry) => String(entry || '').trim())
        .filter(Boolean);
      return list.length ? list : null;
    };

    const issuedScopeSummary =
      normalizeSummary(input?.issuedScopeSummary) ||
      (issueScopeMode === WorkOrderItemScopeMode.FULL_SCOPE
        ? 'Full BOQ scope'
        : null);
    const pendingScopeSummary = normalizeSummary(input?.pendingScopeSummary);
    const creepScopeSummary = normalizeSummary(input?.creepScopeSummary);
    const scopeCreepReason = normalizeSummary(input?.scopeCreepReason);

    const issuedScopeComponents = normalizeComponents(
      input?.issuedScopeComponents,
    );
    const pendingScopeComponents = normalizeComponents(
      input?.pendingScopeComponents,
    );
    const creepScopeComponents = normalizeComponents(
      input?.creepScopeComponents,
    );

    if (
      issueScopeMode === WorkOrderItemScopeMode.SPLIT_SCOPE &&
      !pendingScopeSummary &&
      !pendingScopeComponents?.length
    ) {
      throw new BadRequestException(
        'Split scope items must include the balance scope pending for other vendors.',
      );
    }

    if (
      issueScopeMode === WorkOrderItemScopeMode.CREEP_SCOPE &&
      !scopeCreepReason &&
      !creepScopeSummary &&
      !creepScopeComponents?.length
    ) {
      throw new BadRequestException(
        'Scope creep items must include a creep reason or creep scope description.',
      );
    }

    return {
      issueScopeMode,
      issuedScopeSummary,
      pendingScopeSummary,
      creepScopeSummary,
      scopeCreepReason,
      issuedScopeComponents,
      pendingScopeComponents,
      creepScopeComponents,
      hasPendingScope:
        issueScopeMode === WorkOrderItemScopeMode.SPLIT_SCOPE ||
        issueScopeMode === WorkOrderItemScopeMode.CREEP_SCOPE,
    };
  }

  private getDefaultRateForSelection(
    boqItem: BoqItem,
    subItem: BoqSubItem | null,
    measurement: MeasurementElement,
    overrideRate?: number,
  ): number {
    if (Number(overrideRate || 0) > 0) {
      return Number(overrideRate);
    }
    if (subItem?.rateSource === 'MEASUREMENT') {
      return Number(measurement.rate || 0);
    }
    return Number(subItem?.rate || boqItem.rate || 0);
  }

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
    const mappings = await this.dataSource.getRepository(WorkOrderBoqMap).find({
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
      const repo = queryRunner.manager.getRepository(WorkOrderBoqMap);

      // Clear existing
      await repo.delete({ workOrderItem: { id: woItemId } });

      // Add new
      for (const m of mappings) {
        const mapEntry = repo.create({
          workOrderItem: { id: woItemId } as WorkOrderItem,
          boqItem: m.boqItemId ? ({ id: m.boqItemId } as BoqItem) : null,
          boqSubItem: m.boqSubItemId
            ? ({ id: m.boqSubItemId } as BoqSubItem)
            : null,
          conversionFactor: m.factor || 1,
        } as Partial<WorkOrderBoqMap>);
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
      const workOrder = await queryRunner.manager.findOne(WorkOrder, {
        where: { id: woId },
      });
      if (!workOrder) throw new NotFoundException('Work Order not found');

      for (const itemData of items) {
        const item = await queryRunner.manager.findOne(WorkOrderItem, {
          where: { id: itemData.id },
        });
        if (item) {
          const nextQty = Number(itemData.allocatedQty);
          if (
            item.nodeType === WorkOrderItemNodeType.MEASUREMENT &&
            nextQty > 0 &&
            item.measurementElementId
          ) {
            const remainingAllowed = await this.getSelectionRemainingQtyForUpdate(
              workOrder.projectId,
              item,
            );
            if (nextQty > remainingAllowed + 0.0001) {
              throw new BadRequestException(
                `Allocated qty for "${item.description}" exceeds BOQ balance. Allowed: ${remainingAllowed}, Requested: ${nextQty}`,
              );
            }
          }

          const scopePayload = this.normalizeScopePayload(itemData);

          item.rate = Number(itemData.rate);
          item.allocatedQty = nextQty;
          item.amount = item.allocatedQty * item.rate;
          item.issueScopeMode = scopePayload.issueScopeMode;
          item.issuedScopeSummary = scopePayload.issuedScopeSummary;
          item.pendingScopeSummary = scopePayload.pendingScopeSummary;
          item.creepScopeSummary = scopePayload.creepScopeSummary;
          item.scopeCreepReason = scopePayload.scopeCreepReason;
          item.issuedScopeComponents = scopePayload.issuedScopeComponents;
          item.pendingScopeComponents = scopePayload.pendingScopeComponents;
          item.creepScopeComponents = scopePayload.creepScopeComponents;
          item.hasPendingScope = scopePayload.hasPendingScope;
          item.originalBoqQty =
            item.originalBoqQty ?? Number(item.boqQty || item.allocatedQty || 0);
          item.originalBoqRate =
            item.originalBoqRate ?? Number(item.rate || itemData.rate || 0);
          await queryRunner.manager.save(item);
        }
      }

      const newTotal = await this.recalculateWorkOrderHierarchy(
        queryRunner.manager,
        woId,
      );

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
    const allocationRows = allWoItems.filter(
      (wi) => wi.nodeType === WorkOrderItemNodeType.MEASUREMENT,
    );

    const calculateAvailable = (
      total: number,
      boqId: number,
      subId?: number,
      measureId?: number,
    ) => {
      let allocated = 0;
      if (measureId) {
        // Measurement level allocation
        allocated = allocationRows
          .filter((wi) => wi.measurementElementId === measureId)
          .reduce((sum, wi) => sum + Number(wi.allocatedQty || 0), 0);
      } else if (subId) {
        // Sub-Item level allocation from measurement leaves only
        allocated = allocationRows
          .filter((wi) => wi.boqSubItemId === subId)
          .reduce((sum, wi) => sum + Number(wi.allocatedQty || 0), 0);
      } else {
        // Item level allocation from measurement leaves only
        allocated = allocationRows
          .filter((wi) => wi.boqItemId === boqId)
          .reduce((sum, wi) => sum + Number(wi.allocatedQty || 0), 0);
      }
      return {
        allocatedToWo: allocated,
        availableQty: Math.max(0, Number(total || 0) - allocated),
      };
    };

    const getScopePending = (
      boqId: number,
      subId?: number,
      measureId?: number,
    ) =>
      allWoItems.some((wi) => {
        if (!wi.hasPendingScope) return false;
        if (measureId) return wi.measurementElementId === measureId;
        if (subId) return wi.boqSubItemId === subId;
        return wi.boqItemId === boqId;
      });

    const tree = boqItems.map((item) => {
      const { allocatedToWo, availableQty } = calculateAvailable(
        item.qty,
        item.id,
      );
      const hasPendingScope = getScopePending(item.id);

      const subItems = (item.subItems || []).map((sub) => {
        const { allocatedToWo: subAlloc, availableQty: subAvail } =
          calculateAvailable(sub.qty, item.id, sub.id);
        const subPendingScope = getScopePending(item.id, sub.id);

        const measurements = (sub.measurements || []).map((m) => {
          const { allocatedToWo: mAlloc, availableQty: mAvail } =
            calculateAvailable(m.qty, item.id, sub.id, m.id);
          return {
            ...m,
            allocatedToWo: mAlloc,
            availableQty: mAvail,
            hasPendingScope: getScopePending(item.id, sub.id, m.id),
            eligibleForAdd:
              mAvail > 0 || getScopePending(item.id, sub.id, m.id),
          };
        });

        return {
          ...sub,
          measurements,
          allocatedToWo: subAlloc,
          availableQty: subAvail,
          hasPendingScope: subPendingScope,
          eligibleForAdd:
            subAvail > 0 ||
            subPendingScope ||
            measurements.some((measurement) => measurement.eligibleForAdd),
        };
      });

      return {
        ...item,
        subItems,
        allocatedToWo,
        availableQty,
        hasPendingScope,
        eligibleForAdd:
          availableQty > 0 ||
          hasPendingScope ||
          subItems.some((sub) => sub.eligibleForAdd),
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
      .andWhere('woItem.nodeType = :nodeType', {
        nodeType: WorkOrderItemNodeType.MEASUREMENT,
      })
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
      .andWhere('woItem.nodeType = :nodeType', {
        nodeType: WorkOrderItemNodeType.MEASUREMENT,
      })
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
      .andWhere('woItem.nodeType = :nodeType', {
        nodeType: WorkOrderItemNodeType.MEASUREMENT,
      })
      .andWhere('wo.projectId = :projectId', { projectId })
      .andWhere('wo.status IN (:...statuses)', {
        statuses: ['ACTIVE', 'IN_PROGRESS'],
      })
      .select('COALESCE(SUM(woItem.allocatedQty), 0)', 'total')
      .getRawOne();

    return Number(result?.total || 0);
  }

  private async getSelectionRemainingQtyForUpdate(
    projectId: number,
    item: WorkOrderItem,
  ): Promise<number> {
    if (item.measurementElementId) {
      const measurement = await this.measurementRepo.findOne({
        where: { id: item.measurementElementId },
      });
      if (!measurement) return Number(item.allocatedQty || 0);
      const allocated = await this.getMeasurementAllocatedQty(
        item.measurementElementId,
        projectId,
      );
      return Math.max(
        0,
        Number(measurement.qty || 0) - allocated + Number(item.allocatedQty || 0),
      );
    }

    if (item.boqSubItemId) {
      const subItem = await this.boqSubItemRepo.findOne({
        where: { id: item.boqSubItemId },
      });
      if (!subItem) return Number(item.allocatedQty || 0);
      const allocated = await this.getBoqSubItemAllocatedQty(
        item.boqSubItemId,
        projectId,
      );
      return Math.max(
        0,
        Number(subItem.qty || 0) - allocated + Number(item.allocatedQty || 0),
      );
    }

    if (item.boqItemId) {
      const boqItem = await this.boqItemRepo.findOne({
        where: { id: item.boqItemId },
      });
      if (!boqItem) return Number(item.allocatedQty || 0);
      const allocated = await this.getBoqAllocatedQty(item.boqItemId, projectId);
      return Math.max(
        0,
        Number(boqItem.qty || 0) - allocated + Number(item.allocatedQty || 0),
      );
    }

    return Number(item.allocatedQty || 0);
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
      const nodeCache: WorkOrderNodeCache = new Map();

      for (const sel of items) {
        const materialized = await this.materializeWoSelection(
          queryRunner.manager,
          savedWo,
          projectId,
          sel,
          nodeCache,
        );
        createdItems.push(...materialized.createdItems);
        totalAmount += materialized.leafAmount;
      }

      // 3. Update total amount
      const recalculatedTotal = await this.recalculateWorkOrderHierarchy(
        queryRunner.manager,
        savedWo.id,
      );
      savedWo.totalAmount = recalculatedTotal;
      await queryRunner.manager.save(savedWo);

      await queryRunner.commitTransaction();

      return {
        id: savedWo.id,
        woNumber: savedWo.woNumber,
        message: 'Work Order created from BOQ successfully',
        itemCount: createdItems.length,
        totalAmount: recalculatedTotal,
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
      const nodeCache: WorkOrderNodeCache = new Map();

      for (const sel of items) {
        const materialized = await this.materializeWoSelection(
          queryRunner.manager,
          wo,
          projectId,
          sel,
          nodeCache,
        );
      }

      const totalAmount = await this.recalculateWorkOrderHierarchy(
        queryRunner.manager,
        wo.id,
      );
      wo.totalAmount = totalAmount;
      await queryRunner.manager.save(wo);

      await queryRunner.commitTransaction();
      return { success: true, itemsAdded: items.length, totalAmount };
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

  async getPendingVendorBoard(projectId: number) {
    const boqTree = await this.getBoqTreeForWoCreation(projectId);
    const activeLeafItems = await this.woItemRepo.find({
      where: {
        workOrder: {
          projectId,
          status: In(['ACTIVE', 'IN_PROGRESS']),
        },
        nodeType: WorkOrderItemNodeType.MEASUREMENT,
      },
      relations: ['workOrder', 'workOrder.vendor'],
      order: { updatedAt: 'DESC' },
    });

    const pendingRows: any[] = [];

    for (const item of boqTree) {
      for (const sub of item.subItems || []) {
        const measurements = (sub.measurements || []).length
          ? sub.measurements
          : [];
        if (measurements.length > 0) {
          for (const measurement of measurements) {
            if (Number(measurement.availableQty || 0) > 0) {
              pendingRows.push({
                id: `qty-${measurement.id}`,
                workOrderId: null,
                workOrderRef: 'BOQ Balance',
                vendorName: 'Unassigned',
                materialCode: item.boqCode,
                description: `${item.description} / ${sub.description} / ${measurement.elementName}`,
                quantity: Number(measurement.availableQty || 0),
                rate: Number(measurement.rate || sub.rate || item.rate || 0),
                amount:
                  Number(measurement.availableQty || 0) *
                  Number(measurement.rate || sub.rate || item.rate || 0),
                mappingStatus: 'PENDING',
                pendingType: 'QTY_PENDING',
                issuedScopeSummary: null,
                pendingScopeSummary: 'Quantity not yet issued to any work order',
                creepScopeSummary: null,
                sourceWoNumber: null,
              });
            }
          }
        } else if (Number(sub.availableQty || 0) > 0) {
          pendingRows.push({
            id: `qty-sub-${sub.id}`,
            workOrderId: null,
            workOrderRef: 'BOQ Balance',
            vendorName: 'Unassigned',
            materialCode: item.boqCode,
            description: `${item.description} / ${sub.description}`,
            quantity: Number(sub.availableQty || 0),
            rate: Number(sub.rate || item.rate || 0),
            amount:
              Number(sub.availableQty || 0) * Number(sub.rate || item.rate || 0),
            mappingStatus: 'PENDING',
            pendingType: 'QTY_PENDING',
            issuedScopeSummary: null,
            pendingScopeSummary: 'Quantity not yet issued to any work order',
            creepScopeSummary: null,
            sourceWoNumber: null,
          });
        }
      }
    }

    for (const leaf of activeLeafItems) {
      if (leaf.hasPendingScope) {
        pendingRows.push({
          id: `scope-${leaf.id}`,
          workOrderId: leaf.workOrder?.id || null,
          workOrderRef: leaf.workOrder?.woNumber || 'Work Order',
          vendorName: leaf.workOrder?.vendor?.name || 'Assigned Vendor',
          materialCode: leaf.materialCode,
          description: leaf.description,
          quantity: Number(leaf.allocatedQty || 0),
          rate: Number(leaf.rate || 0),
          amount: Number(leaf.amount || 0),
          mappingStatus: leaf.vendorOnboardStatus || 'PENDING',
          pendingType:
            leaf.issueScopeMode === WorkOrderItemScopeMode.CREEP_SCOPE
              ? 'CREEP_PENDING'
              : 'SCOPE_PENDING',
          issuedScopeSummary: leaf.issuedScopeSummary,
          pendingScopeSummary: leaf.pendingScopeSummary,
          creepScopeSummary: leaf.creepScopeSummary,
          scopeCreepReason: leaf.scopeCreepReason,
          sourceWoNumber: leaf.workOrder?.woNumber || null,
        });
      }
    }

    return pendingRows;
  }

  private async materializeWoSelection(
    manager: DataSource['manager'],
    workOrder: WorkOrder,
    projectId: number,
    sel: BoqSelectionItem,
    nodeCache: WorkOrderNodeCache,
  ): Promise<{ createdItems: WorkOrderItem[]; leafAmount: number }> {
    const requestedQty = Number(sel.allocatedQty || sel.qty || 0);
    if (!Number.isFinite(requestedQty) || requestedQty <= 0) {
      return { createdItems: [], leafAmount: 0 };
    }

    const boqItem = await this.boqItemRepo.findOne({
      where: { id: sel.boqItemId },
      relations: ['subItems', 'subItems.measurements'],
    });
    if (!boqItem) {
      throw new BadRequestException(`BOQ Item ID ${sel.boqItemId} not found`);
    }

    const selectionMeasurements = await this.resolveSelectionMeasurements(
      projectId,
      boqItem,
      sel,
      requestedQty,
    );

    if (!selectionMeasurements.length) {
      throw new BadRequestException(
        `Selected BOQ scope "${boqItem.description}" does not contain executable measurement rows.`,
      );
    }

    const scopePayload = this.normalizeScopePayload(sel);
    const createdItems: WorkOrderItem[] = [];
    let leafAmount = 0;

    const itemNode = await this.ensureWoNode(
      manager,
      workOrder,
      nodeCache,
      {
        nodeType: WorkOrderItemNodeType.ITEM,
        boqItemId: boqItem.id,
        boqSubItemId: null,
        measurementElementId: null,
        parentWorkOrderItemId: null,
        level: 0,
        description: boqItem.description,
        materialCode: boqItem.boqCode,
        uom: boqItem.uom || 'NOS',
        boqQty: Number(boqItem.qty || 0),
        originalBoqQty: Number(boqItem.qty || 0),
        originalBoqRate: Number(boqItem.rate || 0),
        deltaAllocatedQty: 0,
        rate: 0,
        deltaAmount: 0,
        woRefText: sel.woRefText || null,
        scope: scopePayload,
      },
    );
    createdItems.push(itemNode);

    const groupedBySubItem = new Map<number | null, typeof selectionMeasurements>();
    for (const measurement of selectionMeasurements) {
      const key = measurement.subItem?.id || null;
      const current = groupedBySubItem.get(key) || [];
      current.push(measurement);
      groupedBySubItem.set(key, current);
    }

    for (const [subItemId, measurementRows] of groupedBySubItem.entries()) {
      const subItem = measurementRows[0]?.subItem || null;
      let parentNode = itemNode;

      if (subItemId && subItem) {
        parentNode = await this.ensureWoNode(
          manager,
          workOrder,
          nodeCache,
          {
            nodeType: WorkOrderItemNodeType.SUB_ITEM,
            boqItemId: boqItem.id,
            boqSubItemId: subItem.id,
            measurementElementId: null,
            parentWorkOrderItemId: itemNode.id,
            level: 1,
            description: subItem.description,
            materialCode: boqItem.boqCode,
            uom: subItem.uom || boqItem.uom || 'NOS',
            boqQty: Number(subItem.qty || 0),
            originalBoqQty: Number(subItem.qty || 0),
            originalBoqRate: Number(subItem.rate || boqItem.rate || 0),
            deltaAllocatedQty: 0,
            rate: Number(subItem.rate || 0),
            deltaAmount: 0,
            woRefText: sel.woRefText || null,
            scope: scopePayload,
          },
        );
        createdItems.push(parentNode);
      }

      for (const measurementRow of measurementRows) {
        const measurementRate =
          this.getDefaultRateForSelection(
            boqItem,
            subItem,
            measurementRow.measurement,
            sel.rate,
          );
        const rate = measurementRate;
        const amount = Number(measurementRow.allocatedQty) * rate;
        const measurementNode = await this.ensureWoNode(
          manager,
          workOrder,
          nodeCache,
          {
            nodeType: WorkOrderItemNodeType.MEASUREMENT,
            boqItemId: boqItem.id,
            boqSubItemId: subItem?.id || null,
            measurementElementId: measurementRow.measurement.id,
            parentWorkOrderItemId: parentNode.id,
            level: 2,
            description: measurementRow.measurement.elementName,
            materialCode: boqItem.boqCode,
            uom: measurementRow.measurement.uom || subItem?.uom || boqItem.uom || 'NOS',
            boqQty: Number(measurementRow.measurement.qty || 0),
            originalBoqQty: Number(measurementRow.measurement.qty || 0),
            originalBoqRate: this.getDefaultRateForSelection(
              boqItem,
              subItem,
              measurementRow.measurement,
            ),
            deltaAllocatedQty: Number(measurementRow.allocatedQty),
            rate,
            deltaAmount: amount,
            woRefText: sel.woRefText || null,
            scope: scopePayload,
          },
        );
        createdItems.push(measurementNode);
        leafAmount += amount;
      }

      if (subItemId && subItem) {
        await this.ensureWoNode(
          manager,
          workOrder,
          nodeCache,
          {
            nodeType: WorkOrderItemNodeType.SUB_ITEM,
            boqItemId: boqItem.id,
            boqSubItemId: subItem.id,
            measurementElementId: null,
            parentWorkOrderItemId: itemNode.id,
            level: 1,
            description: subItem.description,
            materialCode: boqItem.boqCode,
            uom: subItem.uom || boqItem.uom || 'NOS',
            boqQty: Number(subItem.qty || 0),
            originalBoqQty: Number(subItem.qty || 0),
            originalBoqRate: Number(subItem.rate || boqItem.rate || 0),
            deltaAllocatedQty: measurementRows.reduce(
              (sum, row) => sum + Number(row.allocatedQty || 0),
              0,
            ),
            rate: Number(sel.rate || 0) || Number(subItem.rate || 0),
            deltaAmount: measurementRows.reduce((sum, row) => {
              const rowRate =
                Number(sel.rate || 0) ||
                (subItem.rateSource === 'MEASUREMENT'
                  ? Number(row.measurement.rate || 0)
                  : Number(subItem.rate || 0));
              return sum + Number(row.allocatedQty || 0) * rowRate;
            }, 0),
            woRefText: sel.woRefText || null,
            scope: scopePayload,
          },
        );
      }
    }

    await this.ensureWoNode(
      manager,
      workOrder,
      nodeCache,
      {
        nodeType: WorkOrderItemNodeType.ITEM,
        boqItemId: boqItem.id,
        boqSubItemId: null,
        measurementElementId: null,
        parentWorkOrderItemId: null,
        level: 0,
        description: boqItem.description,
        materialCode: boqItem.boqCode,
        uom: boqItem.uom || 'NOS',
        boqQty: Number(boqItem.qty || 0),
        originalBoqQty: Number(boqItem.qty || 0),
        originalBoqRate: Number(boqItem.rate || 0),
        deltaAllocatedQty: selectionMeasurements.reduce(
          (sum, row) => sum + Number(row.allocatedQty || 0),
          0,
        ),
        rate: 0,
        deltaAmount: leafAmount,
        woRefText: sel.woRefText || null,
        scope: scopePayload,
      },
    );

    return { createdItems, leafAmount };
  }

  private async resolveSelectionMeasurements(
    projectId: number,
    boqItem: BoqItem,
    sel: BoqSelectionItem,
    requestedQty: number,
  ): Promise<
    Array<{
      measurement: MeasurementElement;
      subItem: BoqSubItem | null;
      availableQty: number;
      allocatedQty: number;
    }>
  > {
    let measurementRows: Array<{
      measurement: MeasurementElement;
      subItem: BoqSubItem | null;
      availableQty: number;
    }> = [];

    if (sel.measurementElementId) {
      const measurement = await this.measurementRepo.findOne({
        where: { id: sel.measurementElementId },
        relations: ['boqSubItem'],
      });
      if (!measurement) {
        throw new BadRequestException(
          `Measurement ID ${sel.measurementElementId} not found`,
        );
      }
      const allocated = await this.getMeasurementAllocatedQty(
        measurement.id,
        projectId,
      );
      measurementRows = [
        {
          measurement,
          subItem: measurement.boqSubItem || null,
          availableQty: Math.max(0, Number(measurement.qty || 0) - allocated),
        },
      ];
    } else if (sel.boqSubItemId) {
      const subItem = await this.boqSubItemRepo.findOne({
        where: { id: sel.boqSubItemId },
        relations: ['measurements'],
      });
      if (!subItem) {
        throw new BadRequestException(
          `Sub-Item ID ${sel.boqSubItemId} not found`,
        );
      }
      for (const measurement of subItem.measurements || []) {
        const allocated = await this.getMeasurementAllocatedQty(
          measurement.id,
          projectId,
        );
        measurementRows.push({
          measurement,
          subItem,
          availableQty: Math.max(0, Number(measurement.qty || 0) - allocated),
        });
      }
    } else {
      for (const subItem of boqItem.subItems || []) {
        for (const measurement of subItem.measurements || []) {
          const allocated = await this.getMeasurementAllocatedQty(
            measurement.id,
            projectId,
          );
          measurementRows.push({
            measurement,
            subItem,
            availableQty: Math.max(0, Number(measurement.qty || 0) - allocated),
          });
        }
      }
    }

    measurementRows = measurementRows.filter((row) => row.availableQty > 0);
    const totalAvailable = measurementRows.reduce(
      (sum, row) => sum + Number(row.availableQty || 0),
      0,
    );

    if (requestedQty > totalAvailable + 0.0001) {
      throw new BadRequestException(
        `Insufficient balance for "${boqItem.description}". Available: ${totalAvailable}, Requested: ${requestedQty}`,
      );
    }

    let distributed = 0;
    return measurementRows.map((row, index) => {
      const isLast = index === measurementRows.length - 1;
      const proportional = totalAvailable
        ? Number(
            (
              (requestedQty * Number(row.availableQty || 0)) /
              totalAvailable
            ).toFixed(3),
          )
        : 0;
      const allocatedQty = isLast
        ? Number((requestedQty - distributed).toFixed(3))
        : proportional;
      distributed += allocatedQty;
      return {
        ...row,
        allocatedQty: Math.max(0, allocatedQty),
      };
    });
  }

  private async ensureWoNode(
    manager: DataSource['manager'],
    workOrder: WorkOrder,
    nodeCache: WorkOrderNodeCache,
    data: {
      nodeType: WorkOrderItemNodeType;
      boqItemId: number | null;
      boqSubItemId: number | null;
      measurementElementId: number | null;
      parentWorkOrderItemId: number | null;
      level: number;
      description: string;
      materialCode: string | null;
      uom: string;
      boqQty: number;
      originalBoqQty: number;
      originalBoqRate: number;
      deltaAllocatedQty: number;
      rate: number;
      deltaAmount: number;
      woRefText: string | null;
      scope: NormalizedScopePayload;
    },
  ): Promise<WorkOrderItem> {
    const cacheKey = [
      workOrder.id,
      data.nodeType,
      data.boqItemId ?? 'null',
      data.boqSubItemId ?? 'null',
      data.measurementElementId ?? 'null',
      data.parentWorkOrderItemId ?? 'root',
    ].join(':');

    let existing: WorkOrderItem | undefined = nodeCache.get(cacheKey);
    if (!existing) {
      existing =
        (await this.woItemRepo.findOne({
        where: {
          workOrder: { id: workOrder.id },
          nodeType: data.nodeType,
          boqItemId: data.boqItemId as any,
          boqSubItemId: data.boqSubItemId as any,
          measurementElementId: data.measurementElementId as any,
          parentWorkOrderItemId: data.parentWorkOrderItemId as any,
        },
      })) || undefined;
    }

    if (!existing) {
      existing = manager.create(WorkOrderItem, {
        workOrder,
        boqItemId: data.boqItemId,
        boqSubItemId: data.boqSubItemId,
        measurementElementId: data.measurementElementId,
        nodeType: data.nodeType,
        parentWorkOrderItemId: data.parentWorkOrderItemId,
        level: data.level,
        description: data.description,
        materialCode: data.materialCode || null,
        uom: data.uom || 'NOS',
        isParent: data.nodeType !== WorkOrderItemNodeType.MEASUREMENT,
        boqQty: data.boqQty,
        originalBoqQty: data.originalBoqQty,
        originalBoqRate: data.originalBoqRate,
        allocatedQty: 0,
        rate: data.rate || 0,
        amount: 0,
        issueScopeMode: data.scope.issueScopeMode,
        issuedScopeSummary: data.scope.issuedScopeSummary,
        pendingScopeSummary: data.scope.pendingScopeSummary,
        creepScopeSummary: data.scope.creepScopeSummary,
        scopeCreepReason: data.scope.scopeCreepReason,
        issuedScopeComponents: data.scope.issuedScopeComponents,
        pendingScopeComponents: data.scope.pendingScopeComponents,
        creepScopeComponents: data.scope.creepScopeComponents,
        hasPendingScope: data.scope.hasPendingScope,
        vendorOnboardStatus: 'PENDING',
        woRefText: data.woRefText || null,
        status: 'ACTIVE',
      } as Partial<WorkOrderItem>);
    }

    existing.allocatedQty =
      Number(existing.allocatedQty || 0) + Number(data.deltaAllocatedQty || 0);
    if (data.rate > 0 && data.nodeType !== WorkOrderItemNodeType.ITEM) {
      existing.rate = data.rate;
    }
    existing.issueScopeMode = data.scope.issueScopeMode;
    existing.issuedScopeSummary = data.scope.issuedScopeSummary;
    existing.pendingScopeSummary = data.scope.pendingScopeSummary;
    existing.creepScopeSummary = data.scope.creepScopeSummary;
    existing.scopeCreepReason = data.scope.scopeCreepReason;
    existing.issuedScopeComponents = data.scope.issuedScopeComponents;
    existing.pendingScopeComponents = data.scope.pendingScopeComponents;
    existing.creepScopeComponents = data.scope.creepScopeComponents;
    existing.hasPendingScope = data.scope.hasPendingScope;
    existing.originalBoqQty = data.originalBoqQty;
    existing.originalBoqRate = data.originalBoqRate;
    existing.amount =
      Number(existing.amount || 0) + Number(data.deltaAmount || 0);

    const saved = await manager.save(WorkOrderItem, existing);
    nodeCache.set(cacheKey, saved);
    return saved;
  }

  private async recalculateWorkOrderHierarchy(
    manager: DataSource['manager'],
    woId: number,
  ): Promise<number> {
    const items = await manager.find(WorkOrderItem, {
      where: { workOrder: { id: woId } as any },
      order: { level: 'DESC', id: 'ASC' },
    });

    const byId = new Map<number, WorkOrderItem>();
    const childrenByParentId = new Map<number, WorkOrderItem[]>();
    items.forEach((item) => {
      byId.set(item.id, item);
      if (item.parentWorkOrderItemId) {
        const bucket = childrenByParentId.get(item.parentWorkOrderItemId) || [];
        bucket.push(item);
        childrenByParentId.set(item.parentWorkOrderItemId, bucket);
      }
    });

    let totalAmount = 0;

    for (const item of items) {
      const children = childrenByParentId.get(item.id) || [];
      if (children.length > 0) {
        const rolledQty = children.reduce(
          (sum, child) => sum + Number(child.allocatedQty || 0),
          0,
        );
        const rolledAmount = children.reduce(
          (sum, child) => sum + Number(child.amount || 0),
          0,
        );

        item.allocatedQty = Number(rolledQty.toFixed(3));
        item.amount = Number(rolledAmount.toFixed(2));
        item.rate =
          item.allocatedQty > 0
            ? Number((item.amount / item.allocatedQty).toFixed(2))
            : 0;
        item.isParent = true;
      } else {
        item.amount = Number(
          (Number(item.allocatedQty || 0) * Number(item.rate || 0)).toFixed(2),
        );
        totalAmount += Number(item.amount || 0);
      }

      await manager.save(WorkOrderItem, item);
      byId.set(item.id, item);
    }

    await manager.update(WorkOrder, woId, {
      totalAmount: Number(totalAmount.toFixed(2)),
    });

    return Number(totalAmount.toFixed(2));
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
        nodeType: item.nodeType,
        parentWorkOrderItemId: item.parentWorkOrderItemId,
        isExecutableLeaf: item.nodeType === WorkOrderItemNodeType.MEASUREMENT,
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
