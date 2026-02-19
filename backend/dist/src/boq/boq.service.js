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
exports.BoqService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const boq_element_entity_1 = require("./entities/boq-element.entity");
const boq_item_entity_1 = require("./entities/boq-item.entity");
const boq_sub_item_entity_1 = require("./entities/boq-sub-item.entity");
const measurement_element_entity_1 = require("./entities/measurement-element.entity");
const measurement_progress_entity_1 = require("./entities/measurement-progress.entity");
const typeorm_3 = require("typeorm");
const eps_entity_1 = require("../eps/eps.entity");
const audit_service_1 = require("../audit/audit.service");
const planning_service_1 = require("../planning/planning.service");
const workdoc_service_1 = require("../workdoc/workdoc.service");
const common_2 = require("@nestjs/common");
let BoqService = class BoqService {
    boqRepo;
    boqItemRepo;
    boqSubItemRepo;
    measurementRepo;
    progressRepo;
    epsRepo;
    dataSource;
    auditService;
    planningService;
    workDocService;
    constructor(boqRepo, boqItemRepo, boqSubItemRepo, measurementRepo, progressRepo, epsRepo, dataSource, auditService, planningService, workDocService) {
        this.boqRepo = boqRepo;
        this.boqItemRepo = boqItemRepo;
        this.boqSubItemRepo = boqSubItemRepo;
        this.measurementRepo = measurementRepo;
        this.progressRepo = progressRepo;
        this.epsRepo = epsRepo;
        this.dataSource = dataSource;
        this.auditService = auditService;
        this.planningService = planningService;
        this.workDocService = workDocService;
    }
    async create(dto) {
        const boq = this.boqRepo.create(dto);
        boq.epsNode = { id: dto.epsNodeId };
        return await this.boqRepo.save(boq);
    }
    async createBoqItem(data, userId = 0) {
        if (data.epsNodeId) {
            data.epsNode = { id: data.epsNodeId };
        }
        const item = this.boqItemRepo.create(data);
        const saved = await this.boqItemRepo.save(item);
        await this.auditService.log(userId, 'CREATE', 'BOQ_ITEM', saved.id, {
            code: saved.boqCode,
            name: saved.description,
            qty: saved.qty,
        });
        return saved;
    }
    async getProjectBoq(projectId) {
        try {
            return await this.boqItemRepo.find({
                where: { projectId },
                relations: ['epsNode', 'subItems', 'subItems.measurements'],
                order: { boqCode: 'ASC' },
            });
        }
        catch (e) {
            console.error(e);
            return [];
        }
    }
    async createSubItem(data) {
        const subItem = this.boqSubItemRepo.create(data);
        const saved = await this.boqSubItemRepo.save(subItem);
        await this.aggregateToBoqItem(saved.boqItemId);
        return saved;
    }
    async updateSubItem(id, data) {
        await this.boqSubItemRepo.update(id, data);
        const updated = await this.boqSubItemRepo.findOneBy({ id });
        if (updated) {
            if (data.qty !== undefined || data.rate !== undefined) {
                updated.amount = Number(updated.qty) * Number(updated.rate);
                await this.boqSubItemRepo.save(updated);
            }
            await this.aggregateToBoqItem(updated.boqItemId);
        }
        return updated;
    }
    async addMeasurement(data) {
        if (!data.elementId) {
            data.elementId = `MAN-${Date.now()}`;
        }
        const measurement = this.measurementRepo.create(data);
        const saved = await this.measurementRepo.save(measurement);
        if (saved.boqSubItemId) {
            await this.recalculateSubItem(saved.boqSubItemId);
        }
        else if (saved.boqItemId) {
            await this.rollupQuantity(saved.boqItemId);
        }
        return saved;
    }
    async addProgress(data) {
        return await this.dataSource.transaction(async (manager) => {
            const savedProgress = await manager.save(measurement_progress_entity_1.MeasurementProgress, manager.create(measurement_progress_entity_1.MeasurementProgress, data));
            const measurement = await manager.findOne(measurement_element_entity_1.MeasurementElement, {
                where: { id: data.measurementElementId },
                relations: ['boqItem', 'boqSubItem'],
            });
            if (!measurement)
                throw new common_1.NotFoundException('Measurement not found');
            measurement.executedQty =
                Number(measurement.executedQty || 0) + Number(data.executedQty);
            await manager.save(measurement_element_entity_1.MeasurementElement, measurement);
            if (measurement.boqItem) {
                const boqItem = measurement.boqItem;
                boqItem.consumedQty =
                    Number(boqItem.consumedQty || 0) + Number(data.executedQty);
                await manager.save(boq_item_entity_1.BoqItem, boqItem);
            }
            if (measurement.boqSubItem) {
                const subItem = measurement.boqSubItem;
                subItem.executedQty =
                    Number(subItem.executedQty || 0) + Number(data.executedQty);
                await manager.save(boq_sub_item_entity_1.BoqSubItem, subItem);
            }
            if (measurement.boqItemId) {
                await this.planningService.updateActivitiesByBoqItem(measurement.boqItemId);
            }
            if (measurement.boqItemId || measurement.boqSubItemId) {
                await this.workDocService.syncWorkOrderProgress();
            }
            return savedProgress;
        });
    }
    async rollupQuantity(boqItemId) {
        const boqItem = await this.boqItemRepo.findOne({
            where: { id: boqItemId },
        });
        if (!boqItem)
            return;
        if (boqItem.qtyMode === boq_item_entity_1.BoqQtyMode.DERIVED) {
            const { sum } = await this.measurementRepo
                .createQueryBuilder('m')
                .select('SUM(m.qty)', 'sum')
                .where('m.boqItemId = :id', { id: boqItemId })
                .getRawOne();
            boqItem.qty = Number(sum || 0);
            if (boqItem.qty > 0 && Number(boqItem.amount) > 0) {
                if (Number(boqItem.rate) === 0) {
                    boqItem.rate = Number(boqItem.amount) / boqItem.qty;
                }
                else {
                    boqItem.amount = boqItem.qty * boqItem.rate;
                }
            }
            else {
                boqItem.amount = boqItem.qty * boqItem.rate;
            }
            await this.boqItemRepo.save(boqItem);
            await this.planningService.updateActivitiesByBoqItem(boqItemId);
        }
    }
    async recalculateSubItem(subItemId) {
        const subItem = await this.boqSubItemRepo.findOne({
            where: { id: subItemId },
            relations: ['boqItem'],
        });
        if (!subItem)
            return;
        const { sum } = await this.measurementRepo
            .createQueryBuilder('m')
            .select('SUM(m.qty)', 'sum')
            .where('m.boqSubItemId = :id', { id: subItemId })
            .getRawOne();
        subItem.qty = Number(sum || 0);
        subItem.amount = subItem.qty * subItem.rate;
        await this.boqSubItemRepo.save(subItem);
        if (subItem.boqItemId) {
            await this.aggregateToBoqItem(subItem.boqItemId);
        }
    }
    async aggregateToBoqItem(boqItemId) {
        const boqItem = await this.boqItemRepo.findOne({
            where: { id: boqItemId },
        });
        if (!boqItem) {
            console.error(`[BoqService] BoqItem ${boqItemId} not found during rollup`);
            return;
        }
        const { totalQty, totalAmount } = await this.boqSubItemRepo
            .createQueryBuilder('s')
            .select('SUM(s.qty)', 'totalQty')
            .addSelect('SUM(s.amount)', 'totalAmount')
            .where('s.boqItemId = :id', { id: boqItemId })
            .getRawOne();
        console.log(`[BoqService] DB Rollup Result: Qty=${totalQty}, Amt=${totalAmount}`);
        boqItem.qty = Number(totalQty || 0);
        boqItem.amount = Number(totalAmount || 0);
        if (boqItem.qty > 0 && boqItem.amount > 0) {
            boqItem.rate = boqItem.amount / boqItem.qty;
        }
        await this.boqItemRepo.save(boqItem);
        await this.planningService.updateActivitiesByBoqItem(boqItemId);
        console.log(`[BoqService] Saved BoqItem ${boqItemId}. New Amount: ${boqItem.amount}`);
    }
    async findByProject(projectId) {
        return await this.boqRepo.find({
            where: { projectId },
            relations: ['epsNode'],
            order: { boqCode: 'ASC' },
        });
    }
    async findByEpsNode(epsNodeId) {
        let allNodes = [];
        try {
            allNodes = await this.epsRepo.find({
                select: ['id', 'parentId', 'name'],
            });
            console.log(`[BoqService] Fetched ${allNodes.length} EPS nodes for tree recursion. Checking for EPS ${epsNodeId}`);
        }
        catch (e) {
            console.error('[BoqService] Failed to fetch EpsNodes for recursion. Fallback to single node.', e);
            return await this.boqItemRepo.find({
                where: { epsNode: { id: epsNodeId } },
                order: { boqCode: 'ASC' },
            });
        }
        const descendantIds = new Set();
        descendantIds.add(Number(epsNodeId));
        let foundNew = true;
        let loops = 0;
        while (foundNew && loops < 50) {
            foundNew = false;
            loops++;
            for (const node of allNodes) {
                if (!node.parentId)
                    continue;
                if (!descendantIds.has(node.id) && descendantIds.has(node.parentId)) {
                    descendantIds.add(node.id);
                    foundNew = true;
                }
            }
        }
        const ids = Array.from(descendantIds);
        console.log(`[BoqService] EPS ${epsNodeId} -> Found ${ids.length} descendant nodes (Loops: ${loops}). IDs: ${ids.join(',')}`);
        if (ids.length === 0)
            return [];
        return await this.boqItemRepo.find({
            where: { epsNode: { id: (0, typeorm_2.In)(ids) } },
            relations: ['epsNode', 'subItems', 'subItems.measurements'],
            order: { boqCode: 'ASC' },
        });
    }
    async updateConsumedQuantity(id, delta) {
        await this.boqRepo.increment({ id }, 'consumedQuantity', delta);
    }
    async updateBoqItem(id, data, userId = 0) {
        const item = await this.boqItemRepo.findOneBy({ id });
        if (!item)
            throw new common_1.NotFoundException('BOQ Item not found');
        if (data.qty !== undefined && item.qtyMode === boq_item_entity_1.BoqQtyMode.DERIVED) {
            if (data.qty !== item.qty) {
                throw new Error('Cannot manually update Quantity when Mode is DERIVED. Update Measurements instead.');
            }
        }
        const oldData = {
            qty: item.qty,
            rate: item.rate,
            amount: item.amount,
            mode: item.qtyMode,
        };
        Object.assign(item, data);
        item.amount = Number(item.qty) * Number(item.rate);
        const saved = await this.boqItemRepo.save(item);
        await this.planningService.updateActivitiesByBoqItem(saved.id);
        await this.auditService.log(userId, 'UPDATE', 'BOQ_ITEM', id, {
            changes: data,
            previous: oldData,
            new: { qty: saved.qty, amount: saved.amount },
        });
        return saved;
    }
    async deleteBoqItem(id, userId = 0) {
        const item = await this.boqItemRepo.findOneBy({ id });
        if (!item)
            throw new common_1.NotFoundException('BOQ Item not found');
        await this.auditService.log(userId, 'DELETE', 'BOQ_ITEM', id, {
            code: item.boqCode,
            name: item.description,
        });
        await this.boqItemRepo.remove(item);
    }
    async deleteMeasurements(ids) {
        if (!ids || ids.length === 0)
            return;
        const measurements = await this.measurementRepo.find({
            where: { id: (0, typeorm_2.In)(ids) },
            select: ['id', 'boqSubItemId', 'boqItemId'],
        });
        const subItemsToUpdate = new Set();
        const mainItemsToUpdate = new Set();
        measurements.forEach((m) => {
            if (m.boqSubItemId)
                subItemsToUpdate.add(m.boqSubItemId);
            if (m.boqItemId)
                mainItemsToUpdate.add(m.boqItemId);
        });
        await this.measurementRepo.delete(ids);
        for (const subId of subItemsToUpdate) {
            await this.recalculateSubItem(subId);
        }
        for (const mainId of mainItemsToUpdate) {
            await this.rollupQuantity(mainId);
        }
    }
    async updateMeasurement(id, data) {
        const measurement = await this.measurementRepo.findOneBy({ id });
        if (!measurement)
            throw new common_1.NotFoundException('Measurement not found');
        Object.assign(measurement, data);
        return await this.measurementRepo.save(measurement);
    }
    async bulkUpdateMeasurements(ids, data) {
        if (!ids || ids.length === 0)
            return;
        await this.measurementRepo.update({ id: (0, typeorm_2.In)(ids) }, data);
    }
};
exports.BoqService = BoqService;
exports.BoqService = BoqService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(boq_element_entity_1.BoqElement)),
    __param(1, (0, typeorm_1.InjectRepository)(boq_item_entity_1.BoqItem)),
    __param(2, (0, typeorm_1.InjectRepository)(boq_sub_item_entity_1.BoqSubItem)),
    __param(3, (0, typeorm_1.InjectRepository)(measurement_element_entity_1.MeasurementElement)),
    __param(4, (0, typeorm_1.InjectRepository)(measurement_progress_entity_1.MeasurementProgress)),
    __param(5, (0, typeorm_1.InjectRepository)(eps_entity_1.EpsNode)),
    __param(8, (0, common_2.Inject)((0, common_2.forwardRef)(() => planning_service_1.PlanningService))),
    __param(9, (0, common_2.Inject)((0, common_2.forwardRef)(() => workdoc_service_1.WorkDocService))),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_3.DataSource,
        audit_service_1.AuditService,
        planning_service_1.PlanningService,
        workdoc_service_1.WorkDocService])
], BoqService);
//# sourceMappingURL=boq.service.js.map