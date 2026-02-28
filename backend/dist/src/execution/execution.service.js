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
var ExecutionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const measurement_element_entity_1 = require("../boq/entities/measurement-element.entity");
const measurement_progress_entity_1 = require("../boq/entities/measurement-progress.entity");
const boq_item_entity_1 = require("../boq/entities/boq-item.entity");
const activity_entity_1 = require("../wbs/entities/activity.entity");
const boq_activity_plan_entity_1 = require("../planning/entities/boq-activity-plan.entity");
const boq_service_1 = require("../boq/boq.service");
let ExecutionService = ExecutionService_1 = class ExecutionService {
    dataSource;
    boqService;
    activityRepo;
    planRepo;
    boqRepo;
    progressRepo;
    measurementRepo;
    logger = new common_1.Logger(ExecutionService_1.name);
    constructor(dataSource, boqService, activityRepo, planRepo, boqRepo, progressRepo, measurementRepo) {
        this.dataSource = dataSource;
        this.boqService = boqService;
        this.activityRepo = activityRepo;
        this.planRepo = planRepo;
        this.boqRepo = boqRepo;
        this.progressRepo = progressRepo;
        this.measurementRepo = measurementRepo;
    }
    async batchSaveMeasurements(projectId, entries, userId, autoApprove = false) {
        return await this.dataSource.transaction(async (manager) => {
            const results = [];
            for (const entry of entries) {
                const boqItem = await manager.findOne(boq_item_entity_1.BoqItem, {
                    where: { id: entry.boqItemId },
                });
                if (!boqItem) {
                    this.logger.warn(`BoqItem ${entry.boqItemId} not found for measurement entry`);
                    continue;
                }
                const epsNodeId = entry.wbsNodeId || boqItem.epsNodeId || projectId;
                const microSuffix = entry.microActivityId
                    ? `-MICRO-${entry.microActivityId}`
                    : '';
                let siteMeas = await manager.findOne(measurement_element_entity_1.MeasurementElement, {
                    where: {
                        boqItemId: entry.boqItemId,
                        activityId: entry.activityId || null,
                        microActivityId: entry.microActivityId || null,
                        elementId: `SITE-EXEC-${entry.boqItemId}-${entry.activityId || 'GENERIC'}-${epsNodeId}-${entry.planId || 'NOPLAN'}${microSuffix}`,
                    },
                });
                if (!siteMeas) {
                    const epsNodeId = entry.wbsNodeId || boqItem.epsNodeId || projectId;
                    siteMeas = manager.create(measurement_element_entity_1.MeasurementElement, {
                        projectId,
                        boqItemId: entry.boqItemId,
                        epsNodeId: epsNodeId,
                        activityId: entry.activityId || null,
                        microActivityId: entry.microActivityId || null,
                        elementName: entry.microActivityId
                            ? 'Micro Execution'
                            : 'Site Execution',
                        qty: 0,
                        elementId: `SITE-EXEC-${entry.boqItemId}-${entry.activityId || 'GENERIC'}-${epsNodeId}-${entry.planId || 'NOPLAN'}${microSuffix}`,
                    });
                    siteMeas = await manager.save(measurement_element_entity_1.MeasurementElement, siteMeas);
                }
                const status = autoApprove ? 'APPROVED' : 'PENDING';
                const progress = new measurement_progress_entity_1.MeasurementProgress();
                progress.measurementElement = siteMeas;
                progress.executedQty = entry.executedQty;
                progress.date = new Date(entry.date);
                progress.updatedBy = userId.toString();
                progress.status = status;
                progress.reviewedBy = autoApprove ? userId.toString() : null;
                progress.reviewedAt = autoApprove ? new Date() : null;
                await manager.save(measurement_progress_entity_1.MeasurementProgress, progress);
                results.push(progress);
                if (status === 'APPROVED') {
                    await this.recomputeAggregates(siteMeas.id, manager);
                    await this.syncSchedule(entry.boqItemId, manager, entry.activityId);
                }
            }
            return results;
        });
    }
    async syncSchedule(boqItemId, manager, triggerActivityId) {
        const plans = await manager.find(boq_activity_plan_entity_1.BoqActivityPlan, {
            where: { boqItemId },
            relations: ['activity'],
        });
        if (!plans || plans.length === 0)
            return;
        const activityIds = [...new Set(plans.map((p) => p.activityId))];
        for (const actId of activityIds) {
            await this.recalculateActivityProgress(actId, manager);
        }
    }
    async recomputeAggregates(meId, manager) {
        const { total } = await manager
            .createQueryBuilder(measurement_progress_entity_1.MeasurementProgress, 'p')
            .where('p.measurementElementId = :meId', { meId })
            .andWhere('p.status = :status', { status: 'APPROVED' })
            .select('COALESCE(SUM(p.executedQty), 0)', 'total')
            .getRawOne();
        await manager.update(measurement_element_entity_1.MeasurementElement, meId, { executedQty: Number(total) });
        const me = await manager.findOne(measurement_element_entity_1.MeasurementElement, { where: { id: meId } });
        if (me?.boqItemId) {
            const { boqTotal } = await manager
                .createQueryBuilder(measurement_element_entity_1.MeasurementElement, 'me')
                .where('me.boqItemId = :boqId', { boqId: me.boqItemId })
                .select('COALESCE(SUM(me.executedQty), 0)', 'boqTotal')
                .getRawOne();
            await manager.update(boq_item_entity_1.BoqItem, me.boqItemId, { consumedQty: Number(boqTotal) });
        }
    }
    async recalculateActivityProgress(activityId, manager) {
        const activity = await manager.findOne(activity_entity_1.Activity, {
            where: { id: activityId },
        });
        if (!activity)
            return;
        const allLinks = await manager.find(boq_activity_plan_entity_1.BoqActivityPlan, {
            where: { activityId },
            relations: ['boqItem'],
        });
        let totalWeightedProgress = 0;
        let totalActivityPlanned = 0;
        let totalBudgetedValue = 0;
        let totalActualValue = 0;
        let allLinksComplete = true;
        for (const link of allLinks) {
            const item = link.boqItem;
            const rate = Number(item.rate || 0);
            const plannedQty = Number(link.plannedQuantity);
            totalActivityPlanned += plannedQty;
            totalBudgetedValue += plannedQty * rate;
            const specificMeas = await manager.find(measurement_element_entity_1.MeasurementElement, {
                where: { boqItemId: item.id, activityId: activityId },
            });
            const specificConsumed = specificMeas.reduce((sum, m) => sum + Number(m.executedQty), 0);
            totalActualValue += specificConsumed * rate;
            totalWeightedProgress += Math.min(plannedQty, specificConsumed);
            if (specificConsumed < plannedQty) {
                allLinksComplete = false;
            }
        }
        if (totalActivityPlanned === 0)
            return;
        const percentComplete = (totalWeightedProgress / totalActivityPlanned) * 100;
        const finalPercent = Math.min(100, Math.max(0, percentComplete));
        const oldStatus = activity.status;
        activity.percentComplete = Number(finalPercent.toFixed(2));
        activity.budgetedValue = Number(totalBudgetedValue.toFixed(2));
        activity.actualValue = Number(totalActualValue.toFixed(2));
        const today = new Date();
        if (activity.percentComplete > 0 && !activity.startDateActual) {
            activity.startDateActual = today;
            if (activity.status === activity_entity_1.ActivityStatus.NOT_STARTED) {
                activity.status = activity_entity_1.ActivityStatus.IN_PROGRESS;
            }
        }
        if (finalPercent >= 100 && allLinksComplete) {
            if (!activity.finishDateActual) {
                activity.finishDateActual = today;
            }
            activity.status = activity_entity_1.ActivityStatus.COMPLETED;
            activity.percentComplete = 100;
        }
        if ((activity.percentComplete < 100 || !allLinksComplete) &&
            activity.status === activity_entity_1.ActivityStatus.COMPLETED) {
            activity.status = activity_entity_1.ActivityStatus.IN_PROGRESS;
            activity.finishDateActual = null;
        }
        if (!activity.finishDateActual &&
            activity.status === activity_entity_1.ActivityStatus.COMPLETED) {
            activity.status = activity_entity_1.ActivityStatus.IN_PROGRESS;
        }
        await manager.save(activity_entity_1.Activity, activity);
        this.logger.log(`[ScheduleSync] ${activity.activityCode}: ${activity.percentComplete}% (${activity.status}) - AllLinksComplete: ${allLinksComplete}`);
        const activeVersion = await manager.findOne('ScheduleVersion', {
            where: {
                projectId: activity.projectId,
                isActive: true,
                versionType: 'WORKING',
            },
        });
        if (activeVersion) {
            const av = await manager.findOne('ActivityVersion', {
                where: { versionId: activeVersion.id, activityId: activity.id },
            });
            if (av) {
                let changed = false;
                if (activity.startDateActual) {
                    av.startDate = activity.startDateActual;
                    changed = true;
                }
                if (activity.finishDateActual) {
                    av.finishDate = activity.finishDateActual;
                    av.percentComplete = 100;
                    changed = true;
                }
                if (changed) {
                    await manager.save('ActivityVersion', av);
                    this.logger.log(`Synced ActivityVersion ${av.id} dates to Actuals`);
                }
            }
        }
    }
    async getProjectProgressLogs(projectId) {
        this.logger.log(`Fetching progress logs for project: ${projectId}`);
        const debugElements = await this.measurementRepo.find({
            where: { elementName: 'Site Execution' },
            take: 5,
        });
        this.logger.debug(`Sample Site Execution Elements: ${JSON.stringify(debugElements.map((e) => ({ id: e.id, projectId: e.projectId, activityId: e.activityId })))}`);
        const logs = await this.progressRepo
            .createQueryBuilder('progress')
            .innerJoinAndSelect('progress.measurementElement', 'me')
            .leftJoinAndSelect('me.boqItem', 'boq')
            .leftJoinAndSelect('me.activity', 'act')
            .where('me.projectId = :projectId', { projectId })
            .andWhere('progress.status = :status', { status: 'APPROVED' })
            .orderBy('progress.loggedOn', 'DESC')
            .getMany();
        this.logger.log(`Found ${logs.length} APPROVED progress logs for project ${projectId}`);
        return logs;
    }
    async updateProgressLog(logId, newQty, userId) {
        return await this.dataSource.transaction(async (manager) => {
            const progress = await manager.findOne(measurement_progress_entity_1.MeasurementProgress, {
                where: { id: logId },
                relations: ['measurementElement', 'measurementElement.boqItem'],
            });
            if (!progress)
                throw new Error('Progress log not found');
            const me = progress.measurementElement;
            const boqItem = me.boqItem;
            const diff = Number(newQty) - Number(progress.executedQty);
            progress.executedQty = newQty;
            progress.updatedBy = userId.toString();
            await manager.save(progress);
            await this.recomputeAggregates(me.id, manager);
            if (boqItem) {
                await this.syncSchedule(boqItem.id, manager, me.activityId);
            }
            return progress;
        });
    }
    async deleteProgressLog(logId) {
        return await this.dataSource.transaction(async (manager) => {
            const progress = await manager.findOne(measurement_progress_entity_1.MeasurementProgress, {
                where: { id: logId },
                relations: ['measurementElement', 'measurementElement.boqItem'],
            });
            if (!progress)
                throw new Error('Progress log not found');
            const me = progress.measurementElement;
            const boqItem = me.boqItem;
            const qtyToRemove = Number(progress.executedQty);
            await manager.remove(progress);
            if (progress.status === 'APPROVED') {
                await this.recomputeAggregates(me.id, manager);
                if (boqItem) {
                    await this.syncSchedule(boqItem.id, manager, me.activityId);
                }
            }
            return { success: true };
        });
    }
    async getPendingProgressLogs(projectId) {
        return await this.progressRepo
            .createQueryBuilder('progress')
            .innerJoinAndSelect('progress.measurementElement', 'me')
            .leftJoinAndSelect('me.boqItem', 'boq')
            .leftJoinAndSelect('me.activity', 'act')
            .leftJoinAndSelect('me.epsNode', 'loc')
            .where('me.projectId = :projectId', { projectId })
            .andWhere('progress.status = :status', { status: 'PENDING' })
            .orderBy('progress.loggedOn', 'DESC')
            .getMany();
    }
    async approveProgress(logIds, userId) {
        return await this.dataSource.transaction(async (manager) => {
            const logs = await manager.find(measurement_progress_entity_1.MeasurementProgress, {
                where: {
                    id: (0, typeorm_2.In)(logIds),
                    status: 'PENDING',
                },
                relations: ['measurementElement', 'measurementElement.boqItem'],
            });
            if (!logs.length)
                return {
                    success: true,
                    count: 0,
                    message: 'No pending logs found to approve',
                };
            for (const progress of logs) {
                progress.status = 'APPROVED';
                progress.reviewedBy = userId.toString();
                progress.reviewedAt = new Date();
                await manager.save(measurement_progress_entity_1.MeasurementProgress, progress);
                const me = progress.measurementElement;
                if (!me)
                    continue;
                const boqItem = me.boqItem;
                await this.recomputeAggregates(me.id, manager);
                if (boqItem) {
                    await this.syncSchedule(boqItem.id, manager, me.activityId);
                }
            }
            this.logger.log(`Approved ${logs.length} progress entries`);
            return { success: true, count: logs.length };
        });
    }
    async rejectProgress(logIds, userId, reason) {
        const result = await this.dataSource.manager.update(measurement_progress_entity_1.MeasurementProgress, { id: (0, typeorm_2.In)(logIds), status: 'PENDING' }, {
            status: 'REJECTED',
            reviewedBy: userId.toString(),
            reviewedAt: new Date(),
            rejectionReason: reason,
        });
        return { success: true, affected: result.affected };
    }
};
exports.ExecutionService = ExecutionService;
exports.ExecutionService = ExecutionService = ExecutionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, typeorm_1.InjectRepository)(activity_entity_1.Activity)),
    __param(3, (0, typeorm_1.InjectRepository)(boq_activity_plan_entity_1.BoqActivityPlan)),
    __param(4, (0, typeorm_1.InjectRepository)(boq_item_entity_1.BoqItem)),
    __param(5, (0, typeorm_1.InjectRepository)(measurement_progress_entity_1.MeasurementProgress)),
    __param(6, (0, typeorm_1.InjectRepository)(measurement_element_entity_1.MeasurementElement)),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        boq_service_1.BoqService,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], ExecutionService);
//# sourceMappingURL=execution.service.js.map