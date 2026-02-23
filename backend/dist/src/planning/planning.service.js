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
exports.PlanningService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const boq_activity_plan_entity_1 = require("./entities/boq-activity-plan.entity");
const boq_item_entity_1 = require("../boq/entities/boq-item.entity");
const boq_sub_item_entity_1 = require("../boq/entities/boq-sub-item.entity");
const measurement_element_entity_1 = require("../boq/entities/measurement-element.entity");
const activity_entity_1 = require("../wbs/entities/activity.entity");
const activity_relationship_entity_1 = require("../wbs/entities/activity-relationship.entity");
const recovery_plan_entity_1 = require("./entities/recovery-plan.entity");
const quantity_progress_record_entity_1 = require("./entities/quantity-progress-record.entity");
const wbs_entity_1 = require("../wbs/entities/wbs.entity");
const eps_entity_1 = require("../eps/eps.entity");
const cpm_service_1 = require("../wbs/cpm.service");
const audit_service_1 = require("../audit/audit.service");
let PlanningService = class PlanningService {
    planRepo;
    recoveryRepo;
    boqRepo;
    activityRepo;
    progressRepo;
    subItemRepo;
    measurementRepo;
    wbsRepo;
    epsRepo;
    relRepo;
    cpmService;
    auditService;
    constructor(planRepo, recoveryRepo, boqRepo, activityRepo, progressRepo, subItemRepo, measurementRepo, wbsRepo, epsRepo, relRepo, cpmService, auditService) {
        this.planRepo = planRepo;
        this.recoveryRepo = recoveryRepo;
        this.boqRepo = boqRepo;
        this.activityRepo = activityRepo;
        this.progressRepo = progressRepo;
        this.subItemRepo = subItemRepo;
        this.measurementRepo = measurementRepo;
        this.wbsRepo = wbsRepo;
        this.epsRepo = epsRepo;
        this.relRepo = relRepo;
        this.cpmService = cpmService;
        this.auditService = auditService;
    }
    async unlinkBoq(boqItemId, boqSubItemId, measurementId) {
        const whereClause = { boqItemId };
        if (measurementId) {
            whereClause.measurementId = measurementId;
        }
        else if (boqSubItemId) {
            whereClause.boqSubItemId = boqSubItemId;
            whereClause.measurementId = (0, typeorm_2.IsNull)();
        }
        else {
            whereClause.boqSubItemId = (0, typeorm_2.IsNull)();
            whereClause.measurementId = (0, typeorm_2.IsNull)();
        }
        const affectedPlans = await this.planRepo.find({
            where: whereClause,
            select: ['activityId'],
        });
        const activityIds = [...new Set(affectedPlans.map((p) => p.activityId))];
        const projectId = affectedPlans[0]?.activityId
            ? (await this.activityRepo.findOne({
                where: { id: affectedPlans[0].activityId },
            }))?.projectId
            : null;
        const result = await this.planRepo.delete(whereClause);
        console.log(`[PlanningService] Unlinked Query: ${JSON.stringify(whereClause)} -> Deleted ${result.affected} rows`);
        for (const id of activityIds) {
            await this.updateActivityFinancials(id);
        }
        if (projectId) {
            await this.cpmService.triggerWbsRollup(projectId);
        }
    }
    async distributeBoqToActivity(boqItemId, activityId, quantity, basis = boq_activity_plan_entity_1.PlanningBasis.INITIAL, mappingType = boq_activity_plan_entity_1.MappingType.DIRECT, mappingRules, boqSubItemId, measurementId) {
        const boqItem = await this.boqRepo.findOne({ where: { id: boqItemId } });
        if (!boqItem)
            throw new common_1.NotFoundException('BOQ Item not found');
        const activity = await this.activityRepo.findOne({
            where: { id: activityId },
        });
        if (!activity)
            throw new common_1.NotFoundException('Activity not found');
        if (quantity === -1) {
            if (measurementId) {
                const meas = await this.measurementRepo.findOne({
                    where: { id: measurementId },
                });
                if (!meas)
                    throw new common_1.NotFoundException('Measurement not found');
                quantity = meas.qty || 0;
            }
            else if (boqSubItemId) {
                const sub = await this.subItemRepo.findOne({
                    where: { id: boqSubItemId },
                });
                if (!sub)
                    throw new common_1.NotFoundException('SubItem not found');
                quantity = sub.qty || 0;
            }
            else {
                const existingLinks = await this.planRepo.find({
                    where: { boqItemId },
                });
                const mappedTotal = existingLinks.reduce((sum, l) => sum + Number(l.plannedQuantity), 0);
                const remaining = boqItem.qty - mappedTotal;
                quantity = remaining > 0 ? remaining : 0;
            }
        }
        if (measurementId) {
            const existingOther = await this.planRepo.findOne({
                where: { measurementId },
            });
            if (existingOther && existingOther.activityId !== activityId) {
                throw new common_1.BadRequestException('This measurement is already linked to another activity');
            }
        }
        let plan = await this.planRepo.findOne({
            where: {
                boqItemId,
                activityId,
                planningBasis: basis,
                boqSubItemId: boqSubItemId ? boqSubItemId : (0, typeorm_2.IsNull)(),
                measurementId: measurementId ? measurementId : (0, typeorm_2.IsNull)(),
            },
        });
        if (plan) {
            if (quantity === -1) {
                plan.plannedQuantity = Number(plan.plannedQuantity) + quantity;
            }
            else {
                plan.plannedQuantity = quantity;
            }
            plan.mappingType = mappingType;
            plan.mappingRules = mappingRules;
        }
        else {
            plan = this.planRepo.create({
                projectId: boqItem.projectId,
                boqItemId,
                activityId,
                plannedQuantity: quantity,
                planningBasis: basis,
                mappingType,
                mappingRules,
                boqSubItemId,
                measurementId,
            });
        }
        if (basis === boq_activity_plan_entity_1.PlanningBasis.INITIAL) {
            plan.plannedStart = activity.startDatePlanned;
            plan.plannedFinish = activity.finishDatePlanned;
        }
        const savedPlan = await this.planRepo.save(plan);
        await this.updateActivityFinancials(activityId);
        await this.cpmService.triggerWbsRollup(activity.projectId);
        return savedPlan;
    }
    async getProjectPlanningMatrix(projectId) {
        return this.planRepo.find({
            where: { projectId },
            relations: ['boqItem', 'activity'],
        });
    }
    async getProjectRelationships(projectId) {
        return this.relRepo.find({
            where: { projectId },
            relations: ['predecessor', 'successor'],
        });
    }
    async getUnmappedBoqItems(projectId) {
        const boqItems = await this.boqRepo.find({
            where: { projectId },
            relations: [
                'subItems',
                'subItems.measurements',
                'epsNode',
                'subItems.measurements.epsNode',
            ],
        });
        const allLinks = await this.planRepo
            .createQueryBuilder('plan')
            .leftJoinAndSelect('plan.activity', 'activity')
            .leftJoinAndSelect('activity.wbsNode', 'wbs')
            .leftJoinAndSelect('wbs.parent', 'parent')
            .leftJoinAndSelect('parent.parent', 'grandparent')
            .where('plan.projectId = :projectId', { projectId })
            .where('plan.projectId = :projectId', { projectId })
            .getMany();
        console.log(`[PlanningService] getUnmappedBoqItems Debug: Found ${boqItems.length} BOQ Items and ${allLinks.length} existing Plan Links.`);
        const formatActivityPath = (l) => {
            if (!l.activity)
                return `[ID:${l.activityId}]`;
            const parts = [];
            let current = l.activity.wbsNode;
            let depth = 2;
            while (current && depth > 0) {
                if (current.parent) {
                    parts.unshift(current.parent.wbsName);
                }
                current = current.parent;
                depth--;
            }
            parts.push(l.activity.activityName);
            return parts.join(' > ');
        };
        return boqItems.map((item) => {
            const links = allLinks.filter((l) => l.boqItemId === item.id);
            const mappedTotal = links.reduce((sum, l) => sum + Number(l.plannedQuantity), 0);
            const remaining = item.qty - mappedTotal;
            let status = 'UNMAPPED';
            if (mappedTotal > 0 && remaining > 0.01)
                status = 'PARTIAL';
            if (mappedTotal >= item.qty - 0.01)
                status = 'MAPPED';
            const mappedActivities = [
                ...new Set(links.map((l) => formatActivityPath(l)).filter(Boolean)),
            ].join(', ');
            const enrichedSubItems = item.subItems?.map((sub) => {
                const directSubLinks = links.filter((l) => l.boqSubItemId === sub.id);
                const subMapped = directSubLinks.reduce((sum, l) => sum + Number(l.plannedQuantity), 0);
                const genericLinks = links.filter((l) => !l.boqSubItemId && !l.measurementId);
                const genericTotal = genericLinks.reduce((sum, l) => sum + Number(l.plannedQuantity), 0);
                let subStatus = 'UNMAPPED';
                if (genericTotal >= item.qty - 0.01)
                    subStatus = 'MAPPED';
                else {
                    if (subMapped >= sub.qty - 0.001)
                        subStatus = 'MAPPED';
                    else if (subMapped > 0)
                        subStatus = 'PARTIAL';
                }
                const relevantSubLinks = [...directSubLinks, ...genericLinks];
                const subMappedActivities = [
                    ...new Set(relevantSubLinks.map((l) => formatActivityPath(l)).filter(Boolean)),
                ].join(', ');
                const enrichedMeasurements = sub.measurements?.map((meas) => {
                    const directMeasLinks = links.filter((l) => l.measurementId === meas.id);
                    const measMapped = directMeasLinks.reduce((sum, l) => sum + Number(l.plannedQuantity), 0);
                    let measStatus = 'UNMAPPED';
                    if (subStatus === 'MAPPED')
                        measStatus = 'MAPPED';
                    else {
                        if (measMapped >= meas.qty - 0.001)
                            measStatus = 'MAPPED';
                        else if (measMapped > 0)
                            measStatus = 'PARTIAL';
                    }
                    const linksInheritedFromSub = links.filter((l) => l.boqSubItemId === sub.id && !l.measurementId);
                    const relevantMeasLinks = [
                        ...directMeasLinks,
                        ...linksInheritedFromSub,
                        ...genericLinks,
                    ];
                    const measMappedActivities = [
                        ...new Set(relevantMeasLinks
                            .map((l) => formatActivityPath(l))
                            .filter(Boolean)),
                    ].join(', ');
                    return {
                        ...meas,
                        mappingStatus: measStatus,
                        mappedActivities: measMappedActivities,
                    };
                });
                return {
                    ...sub,
                    mappingStatus: subStatus,
                    measurements: enrichedMeasurements,
                    mappedActivities: subMappedActivities,
                };
            });
            return {
                ...item,
                mappedTotal,
                remaining,
                mappingStatus: status,
                mappedActivities,
                subItems: enrichedSubItems,
            };
        });
    }
    async getActivityAllocations(activityId) {
        return this.planRepo.find({
            where: { activityId },
            relations: ['boqItem'],
        });
    }
    async createRecoveryPlan(data) {
        const plan = this.recoveryRepo.create(data);
        return this.recoveryRepo.save(plan);
    }
    async getRecoveryPlans(projectId) {
        return this.recoveryRepo.find({
            where: { projectId },
            relations: ['activity'],
        });
    }
    async recordProgress(data) {
        const record = this.progressRepo.create({
            ...data,
            measureDate: new Date(),
            status: quantity_progress_record_entity_1.ProgressStatus.APPROVED,
        });
        const savedRecord = await this.progressRepo.save(record);
        await this.recalculateScheduleFromBoq(savedRecord.boqItemId);
        return savedRecord;
    }
    async recalculateScheduleFromBoq(boqItemId) {
        const links = await this.planRepo.find({
            where: { boqItemId },
            relations: ['activity'],
        });
        const affectedActivityIds = [...new Set(links.map((l) => l.activityId))];
        for (const activityId of affectedActivityIds) {
            await this.updateActivityProgress(activityId);
        }
    }
    async updateActivityProgress(activityId) {
        const mappings = await this.planRepo.find({
            where: { activityId, planningBasis: boq_activity_plan_entity_1.PlanningBasis.INITIAL },
            relations: ['boqItem'],
        });
        if (mappings.length === 0)
            return;
        let totalEarnedWeight = 0;
        let totalPlannedWeight = 0;
        let totalBudgetedValue = 0;
        let totalActualValue = 0;
        let allLinksComplete = true;
        for (const mapping of mappings) {
            const item = mapping.boqItem;
            const rate = Number(item.rate || 0);
            const locationIdStr = String(mapping.projectId);
            const progressRecords = await this.progressRepo.find({
                where: {
                    boqItemId: mapping.boqItemId,
                    status: quantity_progress_record_entity_1.ProgressStatus.APPROVED,
                    locationId: locationIdStr,
                },
            });
            const totalMeasured = progressRecords.reduce((sum, r) => sum + Number(r.measuredQty), 0);
            const boqTotal = mapping.boqItem.qty || 1;
            const boqPercentCheck = totalMeasured / boqTotal;
            const boqPercent = Math.min(1, Math.max(0, boqPercentCheck));
            if (totalMeasured < mapping.plannedQuantity) {
                allLinksComplete = false;
            }
            totalBudgetedValue += mapping.plannedQuantity * rate;
            totalActualValue += totalMeasured * rate;
            const earnedPayload = mapping.plannedQuantity * boqPercent;
            totalEarnedWeight += earnedPayload;
            totalPlannedWeight += Number(mapping.plannedQuantity);
        }
        if (totalPlannedWeight === 0)
            return;
        const activityPercent = (totalEarnedWeight / totalPlannedWeight) * 100;
        const finalPercent = parseFloat(activityPercent.toFixed(2));
        const activity = await this.activityRepo.findOne({
            where: { id: activityId },
        });
        if (activity) {
            const oldStatus = activity.status;
            activity.percentComplete = finalPercent;
            activity.budgetedValue = Number(totalBudgetedValue.toFixed(2));
            activity.actualValue = Number(totalActualValue.toFixed(2));
            if (finalPercent > 0 && !activity.startDateActual) {
                console.log(`[Auto - Start] Activity ${activity.id} (${activity.activityCode}) started.Progress: ${finalPercent}% `);
                activity.startDateActual = new Date();
                if (activity.status === activity_entity_1.ActivityStatus.NOT_STARTED) {
                    activity.status = activity_entity_1.ActivityStatus.IN_PROGRESS;
                }
            }
            if (finalPercent >= 100 && allLinksComplete) {
                if (!activity.finishDateActual) {
                    console.log(`[Auto - Finish] Activity ${activity.id} finished.`);
                    activity.finishDateActual = new Date();
                }
                activity.status = activity_entity_1.ActivityStatus.COMPLETED;
            }
            else if (finalPercent > 0 &&
                activity.status === activity_entity_1.ActivityStatus.NOT_STARTED) {
                activity.status = activity_entity_1.ActivityStatus.IN_PROGRESS;
            }
            if ((finalPercent < 100 || !allLinksComplete) &&
                activity.status === activity_entity_1.ActivityStatus.COMPLETED) {
                activity.status = activity_entity_1.ActivityStatus.IN_PROGRESS;
                activity.finishDateActual = null;
            }
            await this.activityRepo.save(activity);
            console.log(`[UpdateActivity] ${activity.activityCode}: ${oldStatus} -> ${activity.status}, %=${finalPercent}, Start = ${activity.startDateActual} - AllLinksComplete: ${allLinksComplete} `);
        }
    }
    async completeActivity(activityId) {
        const activity = await this.activityRepo.findOne({
            where: { id: activityId },
        });
        if (!activity)
            throw new Error('Activity not found');
        activity.status = activity_entity_1.ActivityStatus.COMPLETED;
        activity.finishDateActual = new Date();
        if (!activity.startDateActual) {
            activity.startDateActual = new Date();
        }
        activity.percentComplete = 100;
        return this.activityRepo.save(activity);
    }
    async getPlanningStats(projectId) {
        const boqItems = await this.boqRepo.find({ where: { projectId } });
        const totalBoqItems = boqItems.length;
        const plannedBoqIds = await this.planRepo
            .createQueryBuilder('plan')
            .select('DISTINCT plan.boq_item_id', 'id')
            .where('plan.projectId = :projectId', { projectId })
            .getRawMany();
        const mappedBoqCount = plannedBoqIds.length;
        const activities = await this.activityRepo.find({ where: { projectId } });
        const totalActivities = activities.length;
        const plannedActivityIds = await this.planRepo
            .createQueryBuilder('plan')
            .select('DISTINCT plan.activity_id', 'id')
            .where('plan.projectId = :projectId', { projectId })
            .getRawMany();
        const linkedActivityCount = plannedActivityIds.length;
        return {
            boq: {
                total: totalBoqItems,
                mapped: mappedBoqCount,
                unmapped: totalBoqItems - mappedBoqCount,
                coverage: totalBoqItems
                    ? Math.round((mappedBoqCount / totalBoqItems) * 100)
                    : 0,
            },
            schedule: {
                total: totalActivities,
                linked: linkedActivityCount,
                unlinked: totalActivities - linkedActivityCount,
                coverage: totalActivities
                    ? Math.round((linkedActivityCount / totalActivities) * 100)
                    : 0,
            },
        };
    }
    async getUnlinkedActivities(projectId) {
        return this.activityRepo
            .createQueryBuilder('activity')
            .leftJoin('boq_activity_plan', 'plan', 'plan.activity_id = activity.id')
            .where('activity.projectId = :projectId', { projectId })
            .andWhere('plan.id IS NULL')
            .getMany();
    }
    async getGapAnalysis(projectId) {
        const rows = await this.activityRepo
            .createQueryBuilder('activity')
            .leftJoinAndSelect('activity.wbsNode', 'wbs')
            .leftJoinAndSelect('wbs.parent', 'parent')
            .leftJoinAndSelect('parent.parent', 'grandparent')
            .leftJoinAndSelect('grandparent.parent', 'greatgrandparent')
            .leftJoin('boq_activity_plan', 'plan', 'plan.activity_id = activity.id')
            .select([
            'activity.id',
            'activity.activityName',
            'activity.activityCode',
            'activity.percentComplete',
            'activity.status',
            'wbs.wbsName',
            'parent.wbsName',
            'grandparent.wbsName',
            'greatgrandparent.wbsName',
            'COUNT(plan.id) as link_count',
        ])
            .where('activity.projectId = :projectId', { projectId })
            .groupBy('activity.id, wbs.id, parent.id, grandparent.id, greatgrandparent.id')
            .getRawMany();
        return rows.map((r) => {
            const pathParts = [
                r.greatgrandparent_wbsName,
                r.grandparent_wbsName,
                r.parent_wbsName,
                r.wbs_wbsName,
            ].filter(Boolean);
            const isLinked = Number(r.link_count) > 0;
            const executionStarted = Number(r.activity_percentComplete) > 0;
            let gapStatus = 'OK';
            if (!isLinked && !executionStarted)
                gapStatus = 'MISSING_BOQ';
            if (!isLinked && executionStarted)
                gapStatus = 'CRITICAL_UNLINKED_EXECUTION';
            if (isLinked && !executionStarted)
                gapStatus = 'READY';
            return {
                id: r.activity_id,
                activityName: r.activity_activityName,
                activityCode: r.activity_activityCode,
                wbsPath: pathParts.join(' > '),
                isLinked,
                linkCount: Number(r.link_count),
                percentComplete: Number(r.activity_percentComplete),
                status: r.activity_status,
                gapStatus,
            };
        });
    }
    async distributeActivitiesToEps(activityIds, targetEpsIds, user) {
        try {
            let createdCount = 0;
            let skippedCount = 0;
            const sourceActivities = await this.activityRepo.find({
                where: activityIds.map((id) => ({ id })),
                relations: [
                    'wbsNode',
                    'wbsNode.parent',
                    'wbsNode.parent.parent',
                    'wbsNode.parent.parent.parent',
                ],
            });
            console.log(`Distributing ${sourceActivities.length} activities to ${targetEpsIds.length} targets`);
            const resolvedTargetIds = [];
            for (const targetId of targetEpsIds) {
                const node = await this.epsRepo.findOne({
                    where: { id: targetId },
                    relations: ['children', 'children.children'],
                });
                if (!node)
                    continue;
                const getLeaves = async (n) => {
                    const children = await this.epsRepo.find({
                        where: { parentId: n.id },
                    });
                    if (children.length === 0) {
                        resolvedTargetIds.push(n.id);
                    }
                    else {
                        for (const child of children) {
                            await getLeaves(child);
                        }
                    }
                };
                await getLeaves(node);
            }
            const uniqueTargets = [...new Set(resolvedTargetIds)];
            console.log(`Resolved ${targetEpsIds.length} inputs to ${uniqueTargets.length} leaf targets`);
            for (const targetEpsId of uniqueTargets) {
                for (const sourceAct of sourceActivities) {
                    const existingLink = await this.activityRepo.findOne({
                        where: { masterActivityId: sourceAct.id, projectId: targetEpsId },
                    });
                    if (existingLink) {
                        skippedCount++;
                        continue;
                    }
                    const pathStack = [];
                    let current = sourceAct.wbsNode;
                    while (current) {
                        pathStack.unshift(current);
                        if (!current.parent)
                            break;
                        current = current.parent;
                    }
                    let targetParentId = null;
                    for (const sourceNode of pathStack) {
                        let targetNode = await this.wbsRepo.findOne({
                            where: {
                                projectId: targetEpsId,
                                wbsCode: sourceNode.wbsCode,
                                parentId: targetParentId ? targetParentId : (0, typeorm_2.IsNull)(),
                            },
                        });
                        if (!targetNode) {
                            targetNode = this.wbsRepo.create({
                                projectId: targetEpsId,
                                wbsCode: sourceNode.wbsCode,
                                wbsName: sourceNode.wbsName,
                                parentId: targetParentId,
                                wbsLevel: sourceNode.wbsLevel,
                                sequenceNo: sourceNode.sequenceNo,
                                isControlAccount: sourceNode.isControlAccount,
                                createdBy: user?.username || 'SYSTEM',
                            });
                            targetNode = await this.wbsRepo.save(targetNode);
                        }
                        targetParentId = targetNode.id;
                    }
                    if (targetParentId) {
                        const newActivity = this.activityRepo.create({
                            projectId: targetEpsId,
                            wbsNode: { id: targetParentId },
                            activityCode: sourceAct.activityCode,
                            activityName: sourceAct.activityName,
                            durationPlanned: sourceAct.durationPlanned,
                            startDatePlanned: sourceAct.startDatePlanned,
                            finishDatePlanned: sourceAct.finishDatePlanned,
                            masterActivityId: sourceAct.id,
                            status: activity_entity_1.ActivityStatus.NOT_STARTED,
                            createdBy: user?.username || 'SYSTEM',
                        });
                        const savedActivity = await this.activityRepo.save(newActivity);
                        createdCount++;
                        const sourcePlans = await this.planRepo.find({
                            where: { activityId: sourceAct.id },
                        });
                        if (sourcePlans.length > 0) {
                            const newPlans = [];
                            for (const sp of sourcePlans) {
                                let detailedMeasurements = [];
                                if (sp.boqSubItemId) {
                                    detailedMeasurements = await this.measurementRepo.find({
                                        where: {
                                            boqSubItemId: sp.boqSubItemId,
                                            epsNodeId: targetEpsId,
                                        },
                                    });
                                }
                                else if (sp.boqItemId) {
                                    detailedMeasurements = await this.measurementRepo.find({
                                        where: { boqItemId: sp.boqItemId, epsNodeId: targetEpsId },
                                    });
                                }
                                if (detailedMeasurements.length > 0) {
                                    for (const meas of detailedMeasurements) {
                                        const plan = this.planRepo.create({
                                            activityId: savedActivity.id,
                                            projectId: targetEpsId,
                                            boqItemId: sp.boqItemId,
                                            boqSubItemId: sp.boqSubItemId,
                                            measurementId: meas.id,
                                            planningBasis: sp.planningBasis,
                                            mappingType: boq_activity_plan_entity_1.MappingType.DIRECT,
                                            plannedQuantity: meas.qty,
                                            createdBy: user?.username || 'SYSTEM_DISTRIBUTOR',
                                        });
                                        newPlans.push(plan);
                                    }
                                }
                                else {
                                    const plan = this.planRepo.create({
                                        activityId: savedActivity.id,
                                        projectId: targetEpsId,
                                        boqItemId: sp.boqItemId,
                                        boqSubItemId: sp.boqSubItemId,
                                        planningBasis: sp.planningBasis,
                                        mappingType: sp.mappingType,
                                        plannedQuantity: 0,
                                        createdBy: user?.username || 'SYSTEM',
                                    });
                                    newPlans.push(plan);
                                }
                            }
                            if (newPlans.length > 0) {
                                await this.planRepo.save(newPlans);
                            }
                        }
                    }
                }
            }
            await this.auditService.log(user?.id || 0, 'SCHEDULE', 'DISTRIBUTE_ACTIVITIES', undefined, undefined, {
                activityCount: activityIds.length,
                targetCount: targetEpsIds.length,
                created: createdCount,
            });
            return { created: createdCount, skipped: skippedCount };
        }
        catch (error) {
            console.error('Distribution Error:', error);
            throw error;
        }
    }
    async repairDistributedActivities() {
        const results = {
            brokenFixed: 0,
            linksRefined: 0,
            errors: [],
        };
        try {
            const brokenActivities = await this.activityRepo
                .createQueryBuilder('activity')
                .leftJoin('boq_activity_plan', 'plan', 'plan.activity_id = activity.id')
                .where('activity.masterActivityId IS NOT NULL')
                .andWhere('plan.id IS NULL')
                .getMany();
            console.log(`[Repair] Found ${brokenActivities.length} broken distributed activities.`);
            for (const activity of brokenActivities) {
                const masterPlans = await this.planRepo.find({
                    where: { activityId: activity.masterActivityId },
                });
                if (masterPlans.length > 0) {
                    const newPlans = masterPlans.map((sp) => this.planRepo.create({
                        activityId: activity.id,
                        projectId: activity.projectId,
                        boqItemId: sp.boqItemId,
                        boqSubItemId: sp.boqSubItemId,
                        planningBasis: sp.planningBasis,
                        mappingType: sp.mappingType,
                        plannedQuantity: 0,
                        createdBy: 'REPAIR_SCRIPT',
                    }));
                    await this.planRepo.save(newPlans);
                    results.brokenFixed++;
                }
            }
        }
        catch (err) {
            console.error('[Repair] Step 1 Error:', err);
            results.errors.push({ step: 1, message: err.message });
        }
        try {
            const genericPlans = await this.planRepo
                .createQueryBuilder('plan')
                .innerJoinAndSelect('plan.activity', 'activity')
                .where('plan.measurementId IS NULL')
                .andWhere('plan.boqSubItemId IS NOT NULL')
                .andWhere('activity.masterActivityId IS NOT NULL')
                .getMany();
            console.log(`[Repair] Found ${genericPlans.length} generic plans candidate for refinement.`);
            for (const plan of genericPlans) {
                const locationId = plan.activity.projectId;
                const match = await this.measurementRepo.findOne({
                    where: {
                        boqSubItemId: plan.boqSubItemId,
                        epsNodeId: locationId,
                    },
                });
                if (match) {
                    plan.measurementId = match.id;
                    plan.plannedQuantity = match.qty;
                    plan.mappingType = boq_activity_plan_entity_1.MappingType.DIRECT;
                    await this.planRepo.save(plan);
                    results.linksRefined++;
                    console.log(`[Repair] Upgraded Plan ${plan.id} -> Measurement ${match.id} (Qty: ${match.qty}) for Loc ${locationId}`);
                }
            }
        }
        catch (err) {
            console.error('[Repair] Step 2 Error:', err);
            results.errors.push({ step: 2, message: err.message });
        }
        return results;
    }
    async undistributeActivities(activityIds, targetEpsIds, user) {
        try {
            if (!activityIds.length || !targetEpsIds.length)
                return { deleted: 0 };
            const result = await this.activityRepo
                .createQueryBuilder()
                .delete()
                .from(activity_entity_1.Activity)
                .where('masterActivityId IN (:...activityIds)', { activityIds })
                .andWhere('projectId IN (:...targetEpsIds)', { targetEpsIds })
                .execute();
            await this.auditService.log(user?.id || 0, 'SCHEDULE', 'UNDISTRIBUTE_ACTIVITIES', undefined, undefined, {
                activityCount: activityIds.length,
                targetCount: targetEpsIds.length,
                deleted: result.affected,
            });
            return { deleted: result.affected };
        }
        catch (error) {
            console.error('Undistribution Error:', error);
            throw error;
        }
    }
    async getDistributionMatrix(masterProjectId) {
        const distributions = await this.activityRepo
            .createQueryBuilder('activity')
            .select(['activity.projectId', 'activity.masterActivityId'])
            .innerJoin('activity.masterActivity', 'master', 'master.projectId = :projectId', { projectId: masterProjectId })
            .getRawMany();
        const matrix = {};
        for (const dist of distributions) {
            const masterId = dist.activity_masterActivityId ||
                dist.masterActivity_id ||
                dist.masterActivityId;
            const targetId = dist.activity_projectId;
            if (masterId) {
                if (!matrix[masterId]) {
                    matrix[masterId] = [];
                }
                if (!matrix[masterId].includes(targetId)) {
                    matrix[masterId].push(targetId);
                }
            }
        }
        return matrix;
    }
    async findActivitiesWithBoq(projectId, wbsNodeId) {
        const rootId = wbsNodeId || projectId;
        const getDescendantIds = async (parentId) => {
            const children = await this.epsRepo.find({
                select: ['id'],
                where: { parentId },
            });
            let ids = children.map((c) => c.id);
            for (const child of children) {
                ids = [...ids, ...(await getDescendantIds(child.id))];
            }
            return ids;
        };
        const descendants = await getDescendantIds(rootId);
        const targetIds = [rootId, ...descendants];
        console.log(`[PlanningService] Fetching Activities for Root ${rootId}.Total Target IDs: ${targetIds.length} `);
        if (targetIds.length === 0)
            console.warn('[PlanningService] Warning: No target IDs found!');
        const query = this.activityRepo
            .createQueryBuilder('activity')
            .innerJoin('boq_activity_plan', 'plan', 'plan.activity_id = activity.id')
            .leftJoin('plan.boqItem', 'boqItem')
            .leftJoin('boq_sub_item', 'subItem', 'subItem.id = plan.boqSubItemId')
            .leftJoin('measurement_element', 'meas', 'meas.id = plan.measurement_id')
            .leftJoin('activity.wbsNode', 'activWbs')
            .leftJoin('activWbs.parent', 'parent')
            .leftJoin('parent.parent', 'grandparent')
            .leftJoin('grandparent.parent', 'greatgrandparent')
            .where(new typeorm_2.Brackets((qb) => {
            qb.where('activity.projectId IN (:...ids)', { ids: targetIds })
                .orWhere('boqItem.epsNodeId IN (:...ids)', { ids: targetIds })
                .orWhere('meas.epsNodeId IN (:...ids)', { ids: targetIds });
        }))
            .select([
            'activity.id',
            'activity.activityName',
            'activity.activityCode',
            'activity.startDatePlanned',
            'activity.finishDatePlanned',
            'activity.startDateActual',
            'activity.finishDateActual',
            'activity.percentComplete',
            'activity.status',
            'activWbs.wbsName as wbs_wbsName',
            'activWbs.wbsCode as wbs_wbsCode',
            'parent.wbsName as parent_wbsName',
            'parent.wbsCode as parent_wbsCode',
            'grandparent.wbsName as grandparent_wbsName',
            'greatgrandparent.wbsName as greatgrandparent_wbsName',
            'plan.id',
            'plan.plannedQuantity',
            'plan.boqItemId',
            'boqItem.id',
            'boqItem.description',
            'boqItem.uom',
            'boqItem.qty',
            'boqItem.consumedQty',
            'subItem.description',
            'meas.elementName',
            'meas.length',
            'meas.breadth',
            'meas.depth',
            'meas.qty',
            'meas.executedQty',
            'subItem.qty',
        ]);
        const raw = await query.getRawMany();
        console.log(`[PlanningService] Query returned ${raw.length} raw rows.`);
        if (raw.length > 0) {
            console.log('[PlanningService] Raw Keys:', Object.keys(raw[0]));
        }
        const activityBoqPairs = [];
        for (const r of raw) {
            const activityId = r.activity_id;
            const boqItemId = r.plan_boqItemId || r.boqItem_id;
            const planId = r.plan_id;
            if (activityId && boqItemId && planId) {
                activityBoqPairs.push({ activityId, boqItemId, planId });
            }
        }
        const execMeasMap = new Map();
        if (activityBoqPairs.length > 0) {
            const uniqueBoqIds = [
                ...new Set(activityBoqPairs.map((p) => p.boqItemId)),
            ];
            const siteExecMeas = await this.measurementRepo
                .createQueryBuilder('m')
                .where('m.boqItemId IN (:...boqIds)', { boqIds: uniqueBoqIds })
                .andWhere('m.elementName = :name', { name: 'Site Execution' })
                .getMany();
            console.log(`[PlanningService] Found ${siteExecMeas.length} Site Execution measurements`);
            for (const m of siteExecMeas) {
                const elementId = m.elementId || '';
                const parts = elementId.split('-');
                const extractedPlanId = parts.length >= 6 ? parts[5] : parts.length >= 5 ? parts[4] : null;
                if (extractedPlanId && extractedPlanId !== 'NOPLAN') {
                    const key = `plan - ${extractedPlanId} `;
                    const current = execMeasMap.get(key) || 0;
                    execMeasMap.set(key, current + Number(m.executedQty || 0));
                    console.log(`[PlanningService] Per - Plan Execution: ${key} = ${execMeasMap.get(key)} `);
                }
                else {
                    const legacyKey = `${m.activityId || 'null'} -${m.boqItemId} `;
                    execMeasMap.set(legacyKey, (execMeasMap.get(legacyKey) || 0) + Number(m.executedQty || 0));
                    console.log(`[PlanningService] Legacy Execution: ${legacyKey} = ${execMeasMap.get(legacyKey)} `);
                }
            }
        }
        const groupedMap = new Map();
        for (const r of raw) {
            const activityId = r.activity_id;
            if (!groupedMap.has(activityId)) {
                let status = r.activity_status;
                if (!r.activity_finishDateActual &&
                    status === activity_entity_1.ActivityStatus.COMPLETED) {
                    status = activity_entity_1.ActivityStatus.IN_PROGRESS;
                }
                if (r.activity_finishDateActual) {
                    status = activity_entity_1.ActivityStatus.COMPLETED;
                }
                const wbsCode = r.wbs_wbsCode ||
                    r.wbs_wbscode ||
                    r.activWbs_wbsCode ||
                    r.activWbs_wbs_code ||
                    r.activwbs_wbscode;
                const wbsName = r.wbs_wbsName ||
                    r.wbs_wbsname ||
                    r.activWbs_wbsName ||
                    r.activWbs_wbs_name ||
                    r.activwbs_wbsname;
                const parentName = r.parent_wbsName || r.parent_wbsname || r.parent_wbs_name;
                const grandName = r.grandparent_wbsName ||
                    r.grandparent_wbsname ||
                    r.grandparent_wbs_name;
                const greatName = r.greatgrandparent_wbsName ||
                    r.greatgrandparent_wbsname ||
                    r.greatgrandparent_wbs_name;
                const wbsInfo = wbsCode ? `${wbsCode} - ${wbsName}` : wbsName;
                const pathParts = [greatName, grandName, parentName, wbsInfo].filter(Boolean);
                groupedMap.set(activityId, {
                    id: activityId,
                    activityName: r.activity_activityName,
                    activityCode: r.activityCode || r.activity_activityCode,
                    status: status,
                    percentComplete: r.activity_percentComplete,
                    startDateActual: r.activity_startDateActual,
                    finishDateActual: r.activity_finishDateActual,
                    wbsPath: pathParts.join(' > '),
                    parentWbs: wbsInfo,
                    plans: [],
                });
            }
            if (r.plan_id) {
                let displayDescription = r.boqItem_description;
                if (r.subItem_description) {
                    displayDescription += ` > ${r.subItem_description} `;
                }
                if (r.meas_elementName) {
                    const dims = [];
                    if (Number(r.meas_length))
                        dims.push(`L:${Number(r.meas_length)} `);
                    if (Number(r.meas_breadth))
                        dims.push(`B:${Number(r.meas_breadth)} `);
                    if (Number(r.meas_depth))
                        dims.push(`D:${Number(r.meas_depth)} `);
                    displayDescription += ` > ${r.meas_elementName} (${dims.join(' x ')})`;
                }
                const validBoqItemId = r.plan_boqItemId || r.boqItem_id || r.plan_boq_item_id;
                let finalPlannedQty = parseFloat(r.plan_plannedQuantity);
                if (isNaN(finalPlannedQty)) {
                    finalPlannedQty =
                        parseFloat(r.meas_qty) || parseFloat(r.subItem_qty) || 0;
                }
                const planKey = `plan - ${r.plan_id} `;
                const specificKey = `${activityId} -${validBoqItemId} `;
                const genericKey = `null - ${validBoqItemId} `;
                let executedQty = execMeasMap.get(planKey) ||
                    execMeasMap.get(specificKey) ||
                    execMeasMap.get(genericKey) ||
                    0;
                if (executedQty === 0) {
                    executedQty = parseFloat(r.meas_executedQty) || 0;
                }
                groupedMap.get(activityId).plans.push({
                    planId: r.plan_id,
                    boqItemId: validBoqItemId,
                    description: displayDescription,
                    uom: r.boqItem_uom,
                    plannedQuantity: finalPlannedQty,
                    totalQty: parseFloat(r.boqItem_qty || 0),
                    consumedQty: executedQty,
                });
            }
        }
        return Array.from(groupedMap.values());
    }
    async debugProjectActivities(projectId) {
        const activityCount = await this.activityRepo.count({
            where: { projectId },
        });
        const plans = await this.planRepo.find({
            where: { projectId },
            relations: ['activity', 'measurement'],
        });
        return {
            projectId,
            totalActivities: activityCount,
            totalPlans: plans.length,
            plans: plans.map((p) => ({
                planId: p.id,
                activity: p.activity.activityName,
                plannedQty: p.plannedQuantity,
                measId: p.measurementId,
                subItemId: p.boqSubItemId,
                measQtyFromLink: p.measurement?.qty,
            })),
        };
    }
    async repairDistributedActivitiesV3() {
        const results = {
            brokenFixed: 0,
            linksRefined: 0,
            linksSplit: 0,
            errors: [],
        };
        const getEpsHierarchy = async (rootId) => {
            const ids = [rootId];
            const children = await this.epsRepo.find({ where: { parentId: rootId } });
            for (const child of children) {
                const subIds = await getEpsHierarchy(child.id);
                ids.push(...subIds);
            }
            return ids;
        };
        try {
            const brokenActivities = await this.activityRepo
                .createQueryBuilder('activity')
                .leftJoin('boq_activity_plan', 'plan', 'plan.activity_id = activity.id')
                .where('activity.masterActivityId IS NOT NULL')
                .andWhere('plan.id IS NULL')
                .getMany();
            for (const activity of brokenActivities) {
                const masterPlans = await this.planRepo.find({
                    where: { activityId: activity.masterActivityId },
                });
                if (masterPlans.length > 0) {
                    const newPlans = masterPlans.map((sp) => this.planRepo.create({
                        activityId: activity.id,
                        projectId: activity.projectId,
                        boqItemId: sp.boqItemId,
                        boqSubItemId: sp.boqSubItemId,
                        planningBasis: sp.planningBasis,
                        mappingType: sp.mappingType,
                        plannedQuantity: 0,
                        createdBy: 'REPAIR_SCRIPT_V3',
                    }));
                    await this.planRepo.save(newPlans);
                    results.brokenFixed++;
                }
            }
        }
        catch (err) {
            results.errors.push({ step: 1, message: err.message });
        }
        try {
            const genericPlans = await this.planRepo
                .createQueryBuilder('plan')
                .innerJoinAndSelect('plan.activity', 'activity')
                .where('plan.boqSubItemId IS NOT NULL')
                .andWhere('activity.masterActivityId IS NOT NULL')
                .getMany();
            console.log(`[RepairV3] Found ${genericPlans.length} generic plans candidate for refinement.`);
            for (const plan of genericPlans) {
                const locationId = plan.activity.projectId;
                const targetEpsIds = await getEpsHierarchy(locationId);
                const matches = await this.measurementRepo.find({
                    where: {
                        boqSubItemId: plan.boqSubItemId,
                        epsNodeId: (0, typeorm_2.In)(targetEpsIds),
                    },
                });
                if (matches.length > 0) {
                    const firstMatch = matches[0];
                    plan.measurementId = firstMatch.id;
                    plan.plannedQuantity = firstMatch.qty;
                    plan.mappingType = boq_activity_plan_entity_1.MappingType.DIRECT;
                    await this.planRepo.save(plan);
                    results.linksRefined++;
                    if (matches.length > 1) {
                        const extraPlans = matches.slice(1).map((m) => this.planRepo.create({
                            activityId: plan.activityId,
                            projectId: plan.projectId,
                            boqItemId: plan.boqItemId,
                            boqSubItemId: plan.boqSubItemId,
                            measurementId: m.id,
                            planningBasis: plan.planningBasis,
                            mappingType: boq_activity_plan_entity_1.MappingType.DIRECT,
                            plannedQuantity: m.qty,
                            createdBy: 'REPAIR_SPLIT',
                        }));
                        await this.planRepo.save(extraPlans);
                        results.linksSplit += extraPlans.length;
                    }
                    console.log(`[RepairV3] Plan ${plan.id} refined / split into ${matches.length} measurement links.`);
                }
            }
        }
        catch (err) {
            console.error('[RepairV3] Step 2 Error:', err);
            results.errors.push({ step: 2, message: err.message });
        }
        return results;
    }
    async repairDistributedActivitiesV4() {
        const results = {
            brokenFixed: 0,
            linksRefined: 0,
            linksSplit: 0,
            errors: [],
        };
        const getEpsHierarchy = async (rootId) => {
            const ids = [rootId];
            const children = await this.epsRepo.find({ where: { parentId: rootId } });
            for (const child of children) {
                const subIds = await getEpsHierarchy(child.id);
                ids.push(...subIds);
            }
            return ids;
        };
        try {
            const allDistributedPlans = await this.planRepo
                .createQueryBuilder('plan')
                .innerJoinAndSelect('plan.activity', 'activity')
                .where('plan.boqSubItemId IS NOT NULL')
                .andWhere('activity.masterActivityId IS NOT NULL')
                .getMany();
            console.log(`[RepairV4] Checking ${allDistributedPlans.length} plans for alignment...`);
            const groups = new Map();
            for (const p of allDistributedPlans) {
                const key = `${p.activityId}_${p.boqSubItemId} `;
                if (!groups.has(key))
                    groups.set(key, []);
                groups.get(key).push(p);
            }
            for (const [key, currentPlans] of groups) {
                const sample = currentPlans[0];
                const locationId = sample.activity.projectId;
                const targetEpsIds = await getEpsHierarchy(locationId);
                const matches = await this.measurementRepo.find({
                    where: {
                        boqSubItemId: sample.boqSubItemId,
                        epsNodeId: (0, typeorm_2.In)(targetEpsIds),
                    },
                });
                if (matches.length === 0)
                    continue;
                const currentMeasIds = currentPlans
                    .map((p) => p.measurementId)
                    .filter(Boolean)
                    .sort();
                const expectedMeasIds = matches.map((m) => m.id).sort();
                const isAligned = currentMeasIds.length === expectedMeasIds.length &&
                    currentMeasIds.every((id, i) => id === expectedMeasIds[i]);
                if (!isAligned) {
                    console.log(`[RepairV4] Misalignment for Act ${sample.activityId} Sub ${sample.boqSubItemId}. Fixing...`);
                    await this.planRepo.remove(currentPlans);
                    const newPlans = matches.map((m) => this.planRepo.create({
                        activityId: sample.activityId,
                        projectId: sample.projectId,
                        boqItemId: sample.boqItemId,
                        boqSubItemId: sample.boqSubItemId,
                        measurementId: m.id,
                        planningBasis: sample.planningBasis,
                        mappingType: boq_activity_plan_entity_1.MappingType.DIRECT,
                        plannedQuantity: m.qty,
                        createdBy: 'REPAIR_V4_FORCED',
                    }));
                    await this.planRepo.save(newPlans);
                    results.linksSplit += newPlans.length;
                    results.linksRefined++;
                }
            }
        }
        catch (err) {
            console.error('[RepairV4] Step 2 Error:', err);
            results.errors.push({ step: 2, message: err.message });
        }
        return results;
    }
    async repairDistributedActivitiesV5() {
        const results = {
            brokenFixed: 0,
            linksRefined: 0,
            linksSplit: 0,
            debug: {
                totalPlansFound: 0,
                sampleHierarchy: [],
                sampleLocation: 0,
            },
            errors: [],
        };
        const getEpsHierarchy = async (rootId) => {
            const ids = [rootId];
            const children = await this.epsRepo.find({ where: { parentId: rootId } });
            for (const child of children) {
                const subIds = await getEpsHierarchy(child.id);
                ids.push(...subIds);
            }
            return ids;
        };
        try {
            const allDistributedPlans = await this.planRepo
                .createQueryBuilder('plan')
                .innerJoinAndSelect('plan.activity', 'activity')
                .where('plan.boqSubItemId IS NOT NULL')
                .getMany();
            results.debug.totalPlansFound = allDistributedPlans.length;
            console.log(`[RepairV5] Checking ${allDistributedPlans.length} plans for alignment...`);
            const groups = new Map();
            for (const p of allDistributedPlans) {
                const key = `${p.activityId}_${p.boqSubItemId} `;
                if (!groups.has(key))
                    groups.set(key, []);
                groups.get(key).push(p);
            }
            let firstLoop = true;
            for (const [key, currentPlans] of groups) {
                const sample = currentPlans[0];
                const locationId = sample.activity.projectId;
                const targetEpsIds = await getEpsHierarchy(locationId);
                if (firstLoop) {
                    results.debug.sampleLocation = locationId;
                    results.debug.sampleHierarchy = targetEpsIds;
                    firstLoop = false;
                }
                const matches = await this.measurementRepo.find({
                    where: {
                        boqSubItemId: sample.boqSubItemId,
                        epsNodeId: (0, typeorm_2.In)(targetEpsIds),
                    },
                });
                if (matches.length === 0)
                    continue;
                const currentMeasIds = currentPlans
                    .map((p) => p.measurementId)
                    .filter(Boolean)
                    .sort();
                const expectedMeasIds = matches.map((m) => m.id).sort();
                const isAligned = currentMeasIds.length === expectedMeasIds.length &&
                    currentMeasIds.every((id, i) => id === expectedMeasIds[i]);
                if (!isAligned) {
                    await this.planRepo.remove(currentPlans);
                    const newPlans = matches.map((m) => this.planRepo.create({
                        activityId: sample.activityId,
                        projectId: sample.projectId,
                        boqItemId: sample.boqItemId,
                        boqSubItemId: sample.boqSubItemId,
                        measurementId: m.id,
                        planningBasis: sample.planningBasis,
                        mappingType: boq_activity_plan_entity_1.MappingType.DIRECT,
                        plannedQuantity: m.qty,
                        createdBy: 'REPAIR_V5_FORCED',
                    }));
                    await this.planRepo.save(newPlans);
                    results.linksSplit += newPlans.length;
                    results.linksRefined++;
                }
            }
        }
        catch (err) {
            console.error('[RepairV5] Step 2 Error:', err);
            results.errors.push({ step: 2, message: err.message });
        }
        return results;
    }
    async repairDistributedActivitiesV6() {
        const results = {
            brokenFixed: 0,
            linksRefined: 0,
            linksSplit: 0,
            shadowLinksFound: 0,
            debug: {
                totalPlansFound: 0,
                shadowProjects: [],
            },
            errors: [],
        };
        const getEpsHierarchy = async (rootId) => {
            const ids = [rootId];
            const children = await this.epsRepo.find({ where: { parentId: rootId } });
            for (const child of children) {
                const subIds = await getEpsHierarchy(child.id);
                ids.push(...subIds);
            }
            return ids;
        };
        try {
            const allDistributedPlans = await this.planRepo
                .createQueryBuilder('plan')
                .innerJoinAndSelect('plan.activity', 'activity')
                .where('plan.boqSubItemId IS NOT NULL')
                .getMany();
            results.debug.totalPlansFound = allDistributedPlans.length;
            console.log(`[RepairV6] Checking ${allDistributedPlans.length} plans...`);
            const groups = new Map();
            for (const p of allDistributedPlans) {
                const key = `${p.activityId}_${p.boqSubItemId} `;
                if (!groups.has(key))
                    groups.set(key, []);
                groups.get(key).push(p);
            }
            const hierarchyCache = new Map();
            for (const [key, currentPlans] of groups) {
                const sample = currentPlans[0];
                const locationId = sample.activity.projectId;
                let targetEpsIds = hierarchyCache.get(locationId);
                if (!targetEpsIds) {
                    targetEpsIds = await getEpsHierarchy(locationId);
                    if (targetEpsIds.length === 1) {
                        const projectNode = await this.epsRepo.findOne({
                            where: { id: locationId },
                        });
                        if (projectNode) {
                            const shadows = await this.epsRepo.find({
                                where: { name: projectNode.name },
                            });
                            for (const shadow of shadows) {
                                if (shadow.id !== locationId) {
                                    const shadowIds = await getEpsHierarchy(shadow.id);
                                    if (shadowIds.length > 1) {
                                        console.log(`[RepairV6] Found Shadow Project for ${projectNode.name}(${locationId}) -> ${shadow.id} with ${shadowIds.length} nodes.`);
                                        targetEpsIds.push(...shadowIds);
                                        results.debug.shadowProjects.push(`${locationId} -> ${shadow.id} `);
                                    }
                                }
                            }
                        }
                    }
                    hierarchyCache.set(locationId, targetEpsIds);
                }
                const matches = await this.measurementRepo.find({
                    where: {
                        boqSubItemId: sample.boqSubItemId,
                        epsNodeId: (0, typeorm_2.In)(targetEpsIds),
                    },
                });
                if (matches.length === 0)
                    continue;
                const currentMeasIds = currentPlans
                    .map((p) => p.measurementId)
                    .filter(Boolean)
                    .sort();
                const expectedMeasIds = matches.map((m) => m.id).sort();
                const isAligned = currentMeasIds.length === expectedMeasIds.length &&
                    currentMeasIds.every((id, i) => id === expectedMeasIds[i]);
                if (!isAligned) {
                    await this.planRepo.remove(currentPlans);
                    const newPlans = matches.map((m) => this.planRepo.create({
                        activityId: sample.activityId,
                        projectId: sample.projectId,
                        boqItemId: sample.boqItemId,
                        boqSubItemId: sample.boqSubItemId,
                        measurementId: m.id,
                        planningBasis: sample.planningBasis,
                        mappingType: boq_activity_plan_entity_1.MappingType.DIRECT,
                        plannedQuantity: m.qty,
                        createdBy: 'REPAIR_V6_SHADOW',
                    }));
                    await this.planRepo.save(newPlans);
                    results.linksSplit += newPlans.length;
                    results.linksRefined++;
                    results.shadowLinksFound += matches.length;
                }
            }
        }
        catch (err) {
            console.error('[RepairV6] Step 2 Error:', err);
            results.errors.push({ step: 2, message: err.message });
        }
        return results;
    }
    async checkHierarchy(rootId) {
        const results = { rootId, childrenFound: 0, hierarchy: [] };
        const getChildren = async (parentId, depth) => {
            const children = await this.epsRepo.find({ where: { parentId } });
            for (const child of children) {
                results.hierarchy.push({
                    id: child.id,
                    name: child.name,
                    parentId,
                    depth,
                });
                results.childrenFound++;
                await getChildren(child.id, depth + 1);
            }
        };
        await getChildren(rootId, 1);
        return results;
    }
    async searchEps(name) {
        return this.epsRepo.find({
            where: { name: (0, typeorm_2.Like)(`% ${name}% `) },
            take: 20,
        });
    }
    async listActivities() {
        return this.activityRepo.find({
            take: 10,
        });
    }
    async findActivityByName(namePartial) {
        const activity = await this.activityRepo.findOne({
            where: { activityName: namePartial },
            relations: ['wbsNode'],
        });
        if (activity) {
            const plans = await this.planRepo.find({
                where: { activityId: activity.id },
                relations: ['measurement'],
            });
            return {
                status: 'FOUND_EXACT',
                activity: {
                    id: activity.id,
                    projectId: activity.projectId,
                    name: activity.activityName,
                    plans: plans.map((p) => ({
                        id: p.id,
                        qty: p.plannedQuantity,
                        measId: p.measurementId,
                        measQty: p.measurement?.qty,
                    })),
                },
            };
        }
        const matches = await this.activityRepo.find({
            where: { activityName: (0, typeorm_2.Like)(`% ${namePartial}% `) },
            take: 10,
        });
        if (matches.length === 0)
            return { status: 'NOT_FOUND', name: namePartial };
        const first = matches[0];
        const plans = await this.planRepo.find({
            where: { activityId: first.id },
            relations: ['measurement'],
        });
        return {
            status: 'FOUND_MULTIPLE',
            count: matches.length,
            firstMatch: {
                id: first.id,
                projectId: first.projectId,
                name: first.activityName,
                plans: plans.map((p) => ({
                    id: p.id,
                    qty: p.plannedQuantity,
                    measId: p.measurementId,
                    measQty: p.measurement?.qty,
                })),
            },
        };
    }
    async updateActivityFinancials(activityId) {
        const activity = await this.activityRepo.findOne({
            where: { id: activityId },
            relations: ['wbsNode'],
        });
        if (!activity)
            return;
        const budgetRes = await this.planRepo
            .createQueryBuilder('p')
            .leftJoin('boq_item', 'b', 'p.boq_item_id = b.id')
            .select('SUM(p.plannedQuantity * b.rate)', 'sum')
            .where('p.activity_id = :activityId', { activityId })
            .getRawOne();
        activity.budgetedValue = Number(budgetRes?.sum || 0);
        const actualRes = await this.measurementRepo
            .createQueryBuilder('m')
            .leftJoin('boq_item', 'b', 'm.boqItemId = b.id')
            .select('SUM(m.executedQty * b.rate)', 'sum')
            .where('m.activityId = :activityId', { activityId })
            .getRawOne();
        activity.actualValue = Number(actualRes?.sum || 0);
        await this.activityRepo.save(activity);
    }
    async syncProjectFinancials(projectId) {
        const activities = await this.activityRepo.find({ where: { projectId } });
        for (const act of activities) {
            await this.updateActivityFinancials(act.id);
        }
        await this.cpmService.triggerWbsRollup(projectId);
    }
    async updateActivitiesByBoqItem(boqItemId) {
        const plans = await this.planRepo.find({
            where: { boqItemId },
            select: ['activityId'],
        });
        const activityIds = [...new Set(plans.map((p) => p.activityId))];
        for (const id of activityIds) {
            await this.updateActivityFinancials(id);
        }
        const firstPlan = plans[0];
        if (firstPlan) {
            const act = await this.activityRepo.findOne({
                where: { id: firstPlan.activityId },
            });
            if (act) {
                await this.cpmService.triggerWbsRollup(act.projectId);
            }
        }
    }
    async getLookAheadResources(projectId, startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        console.log(`[LookAhead] Project: ${projectId}, Window: ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`);
        const entityManager = this.planRepo.manager;
        const ScheduleVersionRepo = entityManager.getRepository('ScheduleVersion');
        const ActivityVersionRepo = entityManager.getRepository('ActivityVersion');
        const latestVersion = (await ScheduleVersionRepo.createQueryBuilder('sv')
            .where('sv.projectId = :projectId', { projectId })
            .andWhere('sv.versionType = :type', { type: 'WORKING' })
            .orderBy('sv.isActive', 'DESC')
            .addOrderBy('sv.createdOn', 'DESC')
            .getOne());
        let activities = [];
        let isVersioned = false;
        let sourceString = 'Master Schedule';
        if (latestVersion) {
            console.log(`[LookAhead] Using Version: ${latestVersion.versionCode} (ID: ${latestVersion.id})`);
            const versions = (await ActivityVersionRepo.createQueryBuilder('av')
                .innerJoinAndSelect('av.activity', 'act')
                .where('av.versionId = :vid', { vid: latestVersion.id })
                .andWhere('av.startDate <= :end', { end })
                .andWhere('(av.finishDate >= :start OR act.percentComplete < 100)', {
                start,
            })
                .getMany());
            activities = versions.map((av) => ({
                id: av.activity.id,
                activityName: av.activity.activityName,
                activityCode: av.activity.activityCode,
                projectId: av.activity.projectId,
                wbsNodeId: av.activity.wbsNodeId,
                startDatePlanned: av.startDate,
                finishDatePlanned: av.finishDate,
                durationPlanned: av.duration,
                startDateActual: av.activity.startDateActual,
                finishDateActual: av.activity.finishDateActual,
                percentComplete: av.activity.percentComplete,
                wbsNode: av.activity.wbsNode,
            }));
            isVersioned = true;
            sourceString = `Version ${latestVersion.versionCode}`;
        }
        else {
            console.log(`[LookAhead] No working Version found. Using Master Schedule.`);
            activities = await this.activityRepo
                .createQueryBuilder('activity')
                .where('activity.projectId = :projectId', { projectId })
                .andWhere('activity.startDatePlanned <= :end', { end })
                .andWhere('(activity.finishDatePlanned >= :start OR activity.percentComplete < 100)', { start })
                .getMany();
        }
        if (activities.length === 0) {
            return {
                aggregated: [],
                boqBreakdown: [],
                cpmActivities: [],
                activitiesCount: 0,
                measurementsCount: 0,
                source: sourceString,
            };
        }
        const activityIds = activities.map((a) => a.id);
        console.log(`[LookAhead] Found ${activities.length} overlapping activities.`);
        const directMeasurements = await this.measurementRepo.find({
            where: { activityId: (0, typeorm_2.In)(activityIds) },
            relations: [
                'analysisTemplate',
                'analysisTemplate.coefficients',
                'analysisTemplate.coefficients.resource',
                'boqItem',
                'boqItem.analysisTemplate',
                'boqItem.analysisTemplate.coefficients',
                'boqItem.analysisTemplate.coefficients.resource',
                'epsNode',
            ],
        });
        const plans = await this.planRepo.find({
            where: { activityId: (0, typeorm_2.In)(activityIds) },
            relations: [
                'boqItem',
                'boqItem.analysisTemplate',
                'boqItem.analysisTemplate.coefficients',
                'boqItem.analysisTemplate.coefficients.resource',
                'measurement',
                'measurement.analysisTemplate',
                'measurement.analysisTemplate.coefficients',
                'measurement.analysisTemplate.coefficients.resource',
                'measurement.boqItem',
                'measurement.epsNode',
            ],
        });
        const measurementMap = new Map();
        const planMeasurementMap = new Map();
        for (const m of directMeasurements) {
            measurementMap.set(m.id, m);
        }
        for (const p of plans) {
            if (p.measurement) {
                const m = p.measurement;
                if (!measurementMap.has(m.id)) {
                    measurementMap.set(m.id, m);
                }
                if (!planMeasurementMap.has(m.id)) {
                    planMeasurementMap.set(m.id, []);
                }
                const existing = planMeasurementMap.get(m.id);
                if (!existing.includes(p.activityId)) {
                    existing.push(p.activityId);
                }
            }
        }
        console.log(`[LookAhead] Found ${directMeasurements.length} direct measurements and ${plans.length} plans.`);
        const cpmActivities = [];
        const boqMap = new Map();
        const resourceMap = new Map();
        for (const activity of activities) {
            if (!activity.startDatePlanned || !activity.finishDatePlanned)
                continue;
            const actStart = new Date(activity.startDatePlanned);
            const actFinish = new Date(activity.finishDatePlanned);
            const percentDone = (activity.percentComplete || 0) / 100;
            if (percentDone >= 1)
                continue;
            const totalDiff = actFinish.getTime() - actStart.getTime();
            const totalDays = Math.max(1, Math.ceil(totalDiff / (1000 * 3600 * 24)) + 1);
            const daysDone = percentDone * totalDays;
            const remainingStart = new Date(actStart.getTime() + daysDone * 24 * 60 * 60 * 1000);
            let safeRatio = 0;
            let overlapDays = 0;
            if (actFinish < start) {
                safeRatio = 1 - percentDone;
                overlapDays = totalDays * safeRatio;
            }
            else if (remainingStart > end) {
                safeRatio = 0;
            }
            else {
                const oStart = remainingStart > start ? remainingStart : start;
                const oEnd = actFinish < end ? actFinish : end;
                const oDiff = oEnd.getTime() - oStart.getTime();
                overlapDays = Math.max(0, Math.ceil(oDiff / (1000 * 3600 * 24)) + 1);
                safeRatio = overlapDays / totalDays;
            }
            if (safeRatio <= 0)
                continue;
            cpmActivities.push({
                id: activity.id,
                name: activity.activityName,
                code: activity.activityCode,
                start: activity.startDatePlanned,
                finish: activity.finishDatePlanned,
                overlapDays: Math.round(overlapDays),
                totalDays,
                ratio: safeRatio.toFixed(2),
                actualStart: activity.startDateActual,
                actualFinish: activity.finishDateActual,
            });
            const actDirectMeasures = directMeasurements.filter((m) => m.activityId === activity.id);
            for (const m of actDirectMeasures) {
                const template = m.analysisTemplate || m.boqItem?.analysisTemplate;
                if (template) {
                    this.calculateResourceImpact(template, m.qty || 0, safeRatio, m.boqItem, boqMap, resourceMap);
                }
            }
            const actPlans = plans.filter((p) => p.activityId === activity.id);
            for (const p of actPlans) {
                const template = p.measurement?.analysisTemplate || p.boqItem?.analysisTemplate;
                const baseQty = p.plannedQuantity || 0;
                const boqItem = p.boqItem || p.measurement?.boqItem;
                if (template && boqItem) {
                    this.calculateResourceImpact(template, baseQty, safeRatio, boqItem, boqMap, resourceMap);
                }
            }
        }
        const aggregated = Array.from(resourceMap.values());
        const boqBreakdown = Array.from(boqMap.values()).map((b) => ({
            ...b,
            resources: Array.from(b.resources.values()),
        }));
        aggregated.sort((a, b) => b.totalAmount - a.totalAmount);
        boqBreakdown.sort((a, b) => b.totalAmount - a.totalAmount);
        return {
            aggregated,
            boqBreakdown,
            cpmActivities,
            activitiesCount: activities.length,
            measurementsCount: directMeasurements.length + plans.length,
            source: sourceString,
        };
    }
    calculateResourceImpact(template, baseQty, safeRatio, boqItem, boqMap, resourceMap) {
        if (!template || !template.coefficients || !boqItem)
            return;
        const windowQty = baseQty * safeRatio;
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
        for (const coeff of template.coefficients) {
            const resource = coeff.resource;
            if (!resource)
                continue;
            const resQty = windowQty * (coeff.coefficient || 0);
            const amount = resQty * (resource.standardRate || 0);
            const resKey = `RES_${resource.id}`;
            if (!resourceMap.has(resKey)) {
                resourceMap.set(resKey, {
                    id: resource.id,
                    name: resource.resourceName,
                    type: resource.resourceType,
                    uom: resource.uom,
                    totalQty: 0,
                    totalAmount: 0,
                });
            }
            const gRes = resourceMap.get(resKey);
            gRes.totalQty += resQty;
            gRes.totalAmount += amount;
            if (!boqEntry.resources.has(resKey)) {
                boqEntry.resources.set(resKey, {
                    resourceName: resource.resourceName,
                    uom: resource.uom,
                    rate: resource.standardRate || 0,
                    totalQty: 0,
                    totalAmount: 0,
                });
            }
            const bRes = boqEntry.resources.get(resKey);
            bRes.totalQty += resQty;
            bRes.totalAmount += amount;
            boqEntry.totalAmount += amount;
        }
    }
};
exports.PlanningService = PlanningService;
exports.PlanningService = PlanningService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(boq_activity_plan_entity_1.BoqActivityPlan)),
    __param(1, (0, typeorm_1.InjectRepository)(recovery_plan_entity_1.RecoveryPlan)),
    __param(2, (0, typeorm_1.InjectRepository)(boq_item_entity_1.BoqItem)),
    __param(3, (0, typeorm_1.InjectRepository)(activity_entity_1.Activity)),
    __param(4, (0, typeorm_1.InjectRepository)(quantity_progress_record_entity_1.QuantityProgressRecord)),
    __param(5, (0, typeorm_1.InjectRepository)(boq_sub_item_entity_1.BoqSubItem)),
    __param(6, (0, typeorm_1.InjectRepository)(measurement_element_entity_1.MeasurementElement)),
    __param(7, (0, typeorm_1.InjectRepository)(wbs_entity_1.WbsNode)),
    __param(8, (0, typeorm_1.InjectRepository)(eps_entity_1.EpsNode)),
    __param(9, (0, typeorm_1.InjectRepository)(activity_relationship_entity_1.ActivityRelationship)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        cpm_service_1.CpmService,
        audit_service_1.AuditService])
], PlanningService);
//# sourceMappingURL=planning.service.js.map