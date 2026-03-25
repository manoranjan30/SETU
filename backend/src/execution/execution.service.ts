import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { BoqItem } from '../boq/entities/boq-item.entity';
import { BoqSubItem } from '../boq/entities/boq-sub-item.entity';
import { EpsNode, EpsNodeType } from '../eps/eps.entity';
import {
  ExecutionProgressAdjustment,
} from './entities/execution-progress-adjustment.entity';
import {
  ExecutionProgressEntry,
  ExecutionProgressEntryStatus,
} from './entities/execution-progress-entry.entity';
import { WoActivityPlan } from '../planning/entities/wo-activity-plan.entity';
import { Activity, ActivityStatus } from '../wbs/entities/activity.entity';
import {
  WorkOrderItem,
  WorkOrderItemNodeType,
} from '../workdoc/entities/work-order-item.entity';
import { MicroScheduleActivity } from '../micro-schedule/entities/micro-schedule-activity.entity';
import { MicroQuantityLedger } from '../micro-schedule/entities/micro-quantity-ledger.entity';

type Manager = EntityManager;

type ResolvedPlanContext = {
  plan: WoActivityPlan;
  workOrderItem: WorkOrderItem;
  boqSubItem: BoqSubItem | null;
  boqItem: BoqItem | null;
  microActivity: MicroScheduleActivity | null;
};

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Activity)
    private readonly activityRepo: Repository<Activity>,
    @InjectRepository(WoActivityPlan)
    private readonly planRepo: Repository<WoActivityPlan>,
    @InjectRepository(BoqItem)
    private readonly boqRepo: Repository<BoqItem>,
    @InjectRepository(BoqSubItem)
    private readonly boqSubItemRepo: Repository<BoqSubItem>,
    @InjectRepository(WorkOrderItem)
    private readonly workOrderItemRepo: Repository<WorkOrderItem>,
    @InjectRepository(EpsNode)
    private readonly epsRepo: Repository<EpsNode>,
    @InjectRepository(ExecutionProgressEntry)
    private readonly executionEntryRepo: Repository<ExecutionProgressEntry>,
    @InjectRepository(ExecutionProgressAdjustment)
    private readonly executionAdjustmentRepo: Repository<ExecutionProgressAdjustment>,
  ) {}

  async batchSaveMeasurements(
    projectId: number,
    entries: any[],
    userId: number,
    autoApprove = false,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const results: any[] = [];

      for (const rawEntry of entries) {
        const entryQty = Number(rawEntry.executedQty ?? rawEntry.quantity ?? 0);
        if (!Number.isFinite(entryQty) || entryQty <= 0) {
          throw new BadRequestException('Executed quantity must be greater than 0.');
        }

        const context = await this.resolvePlanContext(manager, projectId, rawEntry);
        const selectedExecutionEpsNodeId = Number(
          rawEntry.wbsNodeId ||
            context.plan.executionEpsNodeId ||
            context.plan.projectId ||
            projectId,
        );
        const effectiveProjectId = await this.resolveRootProjectId(
          manager,
          Number(
            rawEntry.wbsNodeId ||
              context.plan.executionEpsNodeId ||
              context.plan.projectId ||
              projectId,
          ),
        );
        await this.validatePlanCapacity(
          manager,
          context,
          entryQty,
          Number(rawEntry.microActivityId || 0) || null,
          null,
        );

        const executionEntry = manager.create(ExecutionProgressEntry, {
          projectId: effectiveProjectId,
          workOrderId: context.plan.workOrderId ?? context.workOrderItem.workOrder?.id ?? null,
          workOrderItemId: context.workOrderItem.id,
          activityId: context.plan.activityId,
          woActivityPlanId: context.plan.id,
          executionEpsNodeId: selectedExecutionEpsNodeId,
          microActivityId: context.microActivity?.id ?? null,
          entryDate: new Date(rawEntry.date),
          enteredQty: entryQty,
          remarks: rawEntry.notes || rawEntry.remarks || null,
          status: autoApprove
            ? ExecutionProgressEntryStatus.APPROVED
            : ExecutionProgressEntryStatus.PENDING,
          createdBy: String(userId),
          approvedBy: autoApprove ? String(userId) : null,
          approvedAt: autoApprove ? new Date() : null,
        });

        const saved = await manager.save(ExecutionProgressEntry, executionEntry);

        if (saved.status === ExecutionProgressEntryStatus.APPROVED) {
          await this.syncDerivedState(
            manager,
            context.plan.activityId ? [context.plan.activityId] : [],
            [context.workOrderItem.id],
            context.boqItem?.id ? [context.boqItem.id] : [],
            context.boqSubItem?.id ? [context.boqSubItem.id] : [],
          );
        }

        results.push(await this.buildCompatLogDto(manager, saved.id));
      }

      return results;
    });
  }

  async getProjectProgressLogs(projectId: number) {
    return this.listCompatLogs(projectId, ExecutionProgressEntryStatus.APPROVED);
  }

  async updateProgressLog(logId: number, newQty: number, userId: number) {
    return this.dataSource.transaction(async (manager) => {
      const entry = await manager.findOne(ExecutionProgressEntry, {
        where: { id: logId },
        relations: [
          'woActivityPlan',
          'workOrderItem',
          'workOrderItem.workOrder',
        ],
      });

      if (!entry) {
        throw new BadRequestException('Progress log not found');
      }

      const qty = Number(newQty);
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new BadRequestException('Executed quantity must be greater than 0.');
      }

      if (!entry.woActivityPlanId || !entry.workOrderItemId) {
        throw new BadRequestException(
          'Legacy execution entries without plan linkage cannot be edited.',
        );
      }

      const plan = await manager.findOne(WoActivityPlan, {
        where: { id: entry.woActivityPlanId },
        relations: ['workOrderItem', 'boqItem'],
      });
      if (!plan) {
        throw new BadRequestException('Mapped schedule quantity was not found.');
      }

      const workOrderItem =
        plan.workOrderItem ||
        (await manager.findOne(WorkOrderItem, {
          where: { id: entry.workOrderItemId },
          relations: ['workOrder'],
        }));
      if (!workOrderItem) {
        throw new BadRequestException('Mapped work order item was not found.');
      }

      const boqSubItem =
        plan.boqSubItemId || workOrderItem.boqSubItemId
          ? await manager.findOne(BoqSubItem, {
              where: {
                id: Number(plan.boqSubItemId || workOrderItem.boqSubItemId),
              },
            })
          : null;

      await this.validatePlanCapacity(
        manager,
        {
          plan,
          workOrderItem,
          boqItem: plan.boqItem || null,
          boqSubItem: boqSubItem || null,
          microActivity: entry.microActivityId
            ? await manager.findOne(MicroScheduleActivity, {
                where: { id: entry.microActivityId, deletedAt: IsNull() },
              })
            : null,
        },
        qty,
        entry.microActivityId,
        entry.id,
      );

      await manager.save(
        ExecutionProgressAdjustment,
        manager.create(ExecutionProgressAdjustment, {
          executionProgressEntryId: entry.id,
          oldQty: Number(entry.enteredQty || 0),
          newQty: qty,
          reason: 'Manual edit',
          changedBy: String(userId),
        }),
      );

      entry.enteredQty = qty;
      entry.createdBy = String(userId);
      await manager.save(ExecutionProgressEntry, entry);

      if (entry.status === ExecutionProgressEntryStatus.APPROVED) {
        const workOrderItem = await manager.findOne(WorkOrderItem, {
          where: { id: entry.workOrderItemId },
        });
        await this.syncDerivedState(
          manager,
          entry.activityId ? [entry.activityId] : [],
          entry.workOrderItemId ? [entry.workOrderItemId] : [],
          workOrderItem?.boqItemId ? [workOrderItem.boqItemId] : [],
          workOrderItem?.boqSubItemId ? [workOrderItem.boqSubItemId] : [],
        );
      }

      return this.buildCompatLogDto(manager, entry.id);
    });
  }

  async deleteProgressLog(logId: number) {
    return this.dataSource.transaction(async (manager) => {
      const entry = await manager.findOne(ExecutionProgressEntry, {
        where: { id: logId },
      });

      if (!entry) {
        throw new BadRequestException('Progress log not found');
      }

      const workOrderItem = entry.workOrderItemId
        ? await manager.findOne(WorkOrderItem, {
            where: { id: entry.workOrderItemId },
          })
        : null;

      await manager.delete(ExecutionProgressAdjustment, {
        executionProgressEntryId: entry.id,
      });
      await manager.delete(ExecutionProgressEntry, { id: entry.id });

      if (entry.status === ExecutionProgressEntryStatus.APPROVED) {
        await this.syncDerivedState(
          manager,
          entry.activityId ? [entry.activityId] : [],
          entry.workOrderItemId ? [entry.workOrderItemId] : [],
          workOrderItem?.boqItemId ? [workOrderItem.boqItemId] : [],
          workOrderItem?.boqSubItemId ? [workOrderItem.boqSubItemId] : [],
        );
      }

      return { success: true };
    });
  }

  async getPendingProgressLogs(projectId: number) {
    return this.listCompatLogs(projectId, ExecutionProgressEntryStatus.PENDING);
  }

  async approveProgress(logIds: number[], userId: number) {
    return this.dataSource.transaction(async (manager) => {
      const logs = await manager.find(ExecutionProgressEntry, {
        where: {
          id: In(logIds),
          status: ExecutionProgressEntryStatus.PENDING,
        },
      });

      if (!logs.length) {
        return {
          success: true,
          count: 0,
          message: 'No pending logs found to approve',
        };
      }

      const activityIds = new Set<number>();
      const workOrderItemIds = new Set<number>();
      const boqItemIds = new Set<number>();
      const boqSubItemIds = new Set<number>();

      for (const log of logs) {
        log.status = ExecutionProgressEntryStatus.APPROVED;
        log.approvedBy = String(userId);
        log.approvedAt = new Date();
        await manager.save(ExecutionProgressEntry, log);

        if (log.activityId) activityIds.add(log.activityId);
        if (log.workOrderItemId) {
          workOrderItemIds.add(log.workOrderItemId);
          const workOrderItem = await manager.findOne(WorkOrderItem, {
            where: { id: log.workOrderItemId },
          });
          if (workOrderItem?.boqItemId) boqItemIds.add(workOrderItem.boqItemId);
          if (workOrderItem?.boqSubItemId) boqSubItemIds.add(workOrderItem.boqSubItemId);
        }
      }

      await this.syncDerivedState(
        manager,
        Array.from(activityIds),
        Array.from(workOrderItemIds),
        Array.from(boqItemIds),
        Array.from(boqSubItemIds),
      );

      return { success: true, count: logs.length };
    });
  }

  async rejectProgress(logIds: number[], userId: number, reason: string) {
    const result = await this.dataSource.manager.update(
      ExecutionProgressEntry,
      { id: In(logIds), status: ExecutionProgressEntryStatus.PENDING },
      {
        status: ExecutionProgressEntryStatus.REJECTED,
        approvedBy: String(userId),
        approvedAt: new Date(),
        rejectionReason: reason,
      },
    );

    return { success: true, affected: result.affected ?? 0 };
  }

  private async resolvePlanContext(
    manager: Manager,
    projectId: number,
    rawEntry: any,
  ): Promise<ResolvedPlanContext> {
    const plan = await this.findCompatiblePlan(manager, rawEntry);

    if (!plan) {
      throw new BadRequestException(
        'Progress can only be recorded against a mapped WO quantity for the selected activity and floor.',
      );
    }

    const workOrderItem =
      plan.workOrderItem ||
      (await manager.findOne(WorkOrderItem, {
        where: { id: plan.workOrderItemId },
        relations: ['workOrder'],
      }));

    if (!workOrderItem) {
      throw new BadRequestException('Mapped work order item was not found.');
    }

    const boqSubItemId =
      rawEntry.boqSubItemId ||
      plan.boqSubItemId ||
      workOrderItem.boqSubItemId ||
      null;
    const boqSubItem = boqSubItemId
      ? await manager.findOne(BoqSubItem, {
          where: { id: boqSubItemId },
        })
      : null;

    const boqItem =
      plan.boqItem ||
      (workOrderItem.boqItemId
        ? await manager.findOne(BoqItem, {
            where: { id: workOrderItem.boqItemId },
          })
        : null);

    if (rawEntry.vendorId && plan.vendorId) {
      const requestedVendorId = Number(rawEntry.vendorId);
      if (requestedVendorId !== Number(plan.vendorId)) {
        throw new BadRequestException(
          'Progress vendor does not match the mapped work order vendor.',
        );
      }
    }

    if (rawEntry.wbsNodeId && plan.executionEpsNodeId) {
      const requested = Number(rawEntry.wbsNodeId);
      const allowedScopeIds = await this.resolveEpsScopeIds(manager, requested);
      if (!allowedScopeIds.includes(Number(plan.executionEpsNodeId))) {
        throw new BadRequestException(
          'Progress location is locked to the linked schedule floor.',
        );
      }
    }

    let microActivity: MicroScheduleActivity | null = null;
    if (rawEntry.microActivityId) {
      microActivity = await manager.findOne(MicroScheduleActivity, {
        where: { id: Number(rawEntry.microActivityId), deletedAt: IsNull() },
      });

      if (!microActivity) {
        throw new BadRequestException('Selected micro schedule activity was not found.');
      }

      if (Number(microActivity.parentActivityId) !== Number(plan.activityId)) {
        throw new BadRequestException(
          'Micro schedule activity does not belong to the selected master activity.',
        );
      }

      if (rawEntry.wbsNodeId && microActivity.epsNodeId) {
        const requestedScopeIds = await this.resolveEpsScopeIds(
          manager,
          Number(rawEntry.wbsNodeId),
        );
        const microScopeIds = await this.resolveEpsScopeIds(
          manager,
          Number(microActivity.epsNodeId),
        );
        const sharedScope = requestedScopeIds.some((id) =>
          microScopeIds.includes(id),
        );

        if (!sharedScope) {
          this.logger.warn(
            `Allowing micro activity ${microActivity.id} across EPS mismatch because it matches the selected logical activity/WO mapping. Selected EPS=${rawEntry.wbsNodeId}, micro EPS=${microActivity.epsNodeId}`,
          );
        }
      }

      if (
        microActivity.workOrderItemId &&
        Number(microActivity.workOrderItemId) !== Number(plan.workOrderItemId)
      ) {
        throw new BadRequestException(
          'Micro schedule activity does not belong to the selected mapped WO quantity.',
        );
      }

      if (rawEntry.vendorId && microActivity.vendorId) {
        const requestedVendorId = Number(rawEntry.vendorId);
        if (requestedVendorId !== Number(microActivity.vendorId)) {
          throw new BadRequestException(
            'Micro schedule activity does not belong to the selected vendor.',
          );
        }
      }
    }

    return {
      plan,
      workOrderItem,
      boqSubItem,
      boqItem,
      microActivity,
    };
  }

  private async findCompatiblePlan(
    manager: Manager,
    rawEntry: any,
  ): Promise<WoActivityPlan | null> {
    const requestedFloorId = Number(rawEntry.wbsNodeId || 0) || null;
    const activityId = Number(rawEntry.activityId || 0) || null;
    const workOrderItemId = Number(rawEntry.workOrderItemId || 0) || null;
    const boqItemId = Number(rawEntry.boqItemId || 0) || null;
    const vendorId = Number(rawEntry.vendorId || 0) || null;
    const activityScopeIds = activityId
      ? await this.resolveActivityScopeIds(manager, activityId)
      : [];
    const epsScopeIds = requestedFloorId
      ? await this.resolveEpsScopeIds(manager, requestedFloorId)
      : [];

    if (rawEntry.planId) {
      const plan = await manager.findOne(WoActivityPlan, {
        where: { id: Number(rawEntry.planId) },
        relations: [
          'activity',
          'workOrderItem',
          'workOrderItem.workOrder',
          'boqItem',
          'executionEpsNode',
        ],
      });
      if (!plan) {
        return null;
      }
      if (
        activityScopeIds.length &&
        !activityScopeIds.includes(Number(plan.activityId))
      ) {
        throw new BadRequestException('Selected progress bucket does not belong to this activity.');
      }
      if (
        requestedFloorId &&
        plan.executionEpsNodeId &&
        !epsScopeIds.includes(Number(plan.executionEpsNodeId))
      ) {
        throw new BadRequestException('Selected progress bucket does not belong to this floor.');
      }
      if (vendorId && plan.vendorId && Number(plan.vendorId) !== vendorId) {
        throw new BadRequestException('Selected progress bucket does not belong to this vendor.');
      }
      return plan;
    }

    const exactByWoItem = async (ids: number[]) => {
      if (!ids.length || !activityScopeIds.length) return null;
      const qb = manager
        .createQueryBuilder(WoActivityPlan, 'plan')
        .leftJoinAndSelect('plan.activity', 'activity')
        .leftJoinAndSelect('plan.workOrderItem', 'workOrderItem')
        .leftJoinAndSelect('workOrderItem.workOrder', 'workOrder')
        .leftJoinAndSelect('plan.boqItem', 'boqItem')
        .leftJoinAndSelect('plan.executionEpsNode', 'executionEpsNode')
        .where('plan.workOrderItemId IN (:...ids)', { ids })
        .andWhere('plan.activityId IN (:...activityScopeIds)', {
          activityScopeIds,
        });

      if (vendorId) {
        qb.andWhere('(plan.vendorId = :vendorId OR plan.vendorId IS NULL)', {
          vendorId,
        }).addOrderBy(
          'CASE WHEN plan.vendorId = :vendorId THEN 0 ELSE 1 END',
          'ASC',
        );
      }

      if (requestedFloorId) {
        qb.andWhere(
          '(plan.executionEpsNodeId IN (:...epsScopeIds) OR plan.executionEpsNodeId IS NULL)',
          { epsScopeIds, executionEpsNodeId: requestedFloorId },
        ).orderBy(
          'CASE WHEN plan.executionEpsNodeId = :executionEpsNodeId THEN 0 WHEN plan.executionEpsNodeId IS NULL THEN 2 ELSE 1 END',
          'ASC',
        );
      }

      return qb
        .addOrderBy('plan.id', 'ASC')
        .getOne();
    };

    if (workOrderItemId && activityId) {
      const directPlan = await exactByWoItem([workOrderItemId]);
      if (directPlan) return directPlan;

      const descendantIds = await this.collectWorkOrderDescendantIds(
        manager,
        workOrderItemId,
      );
      const descendantPlan = await exactByWoItem(descendantIds);
      if (descendantPlan) return descendantPlan;
    }

    if (boqItemId && activityScopeIds.length) {
      const qb = manager
        .createQueryBuilder(WoActivityPlan, 'plan')
        .leftJoinAndSelect('plan.activity', 'activity')
        .leftJoinAndSelect('plan.workOrderItem', 'workOrderItem')
        .leftJoinAndSelect('workOrderItem.workOrder', 'workOrder')
        .leftJoinAndSelect('plan.boqItem', 'boqItem')
        .leftJoinAndSelect('plan.executionEpsNode', 'executionEpsNode')
        .where('plan.boqItemId = :boqItemId', { boqItemId })
        .andWhere('plan.activityId IN (:...activityScopeIds)', {
          activityScopeIds,
        });

      if (vendorId) {
        qb.andWhere('(plan.vendorId = :vendorId OR plan.vendorId IS NULL)', {
          vendorId,
        }).addOrderBy(
          'CASE WHEN plan.vendorId = :vendorId THEN 0 ELSE 1 END',
          'ASC',
        );
      }

      if (requestedFloorId) {
        qb.andWhere(
          '(plan.executionEpsNodeId IN (:...epsScopeIds) OR plan.executionEpsNodeId IS NULL)',
          { epsScopeIds, executionEpsNodeId: requestedFloorId },
        ).orderBy(
          'CASE WHEN plan.executionEpsNodeId = :executionEpsNodeId THEN 0 WHEN plan.executionEpsNodeId IS NULL THEN 2 ELSE 1 END',
          'ASC',
        );
      }

      return qb
        .addOrderBy('plan.id', 'ASC')
        .getOne();
    }

    if (activityScopeIds.length) {
      const qb = manager
        .createQueryBuilder(WoActivityPlan, 'plan')
        .leftJoinAndSelect('plan.activity', 'activity')
        .leftJoinAndSelect('plan.workOrderItem', 'workOrderItem')
        .leftJoinAndSelect('workOrderItem.workOrder', 'workOrder')
        .leftJoinAndSelect('plan.boqItem', 'boqItem')
        .leftJoinAndSelect('plan.executionEpsNode', 'executionEpsNode')
        .where('plan.activityId IN (:...activityScopeIds)', {
          activityScopeIds,
        });

      if (vendorId) {
        qb.andWhere('(plan.vendorId = :vendorId OR plan.vendorId IS NULL)', {
          vendorId,
        }).addOrderBy(
          'CASE WHEN plan.vendorId = :vendorId THEN 0 ELSE 1 END',
          'ASC',
        );
      }

      if (requestedFloorId) {
        qb.andWhere(
          '(plan.executionEpsNodeId IN (:...epsScopeIds) OR plan.executionEpsNodeId IS NULL)',
          { epsScopeIds, executionEpsNodeId: requestedFloorId },
        ).addOrderBy(
          'CASE WHEN plan.executionEpsNodeId = :executionEpsNodeId THEN 0 WHEN plan.executionEpsNodeId IS NULL THEN 2 ELSE 1 END',
          'ASC',
        );
      }

      return qb.addOrderBy('plan.id', 'ASC').getOne();
    }

    return null;
  }

  private async collectWorkOrderDescendantIds(
    manager: Manager,
    workOrderItemId: number,
  ): Promise<number[]> {
    const ids: number[] = [];
    const queue = [workOrderItemId];

    while (queue.length) {
      const currentId = queue.shift()!;
      const children = await manager.find(WorkOrderItem, {
        where: { parentWorkOrderItemId: currentId },
        select: ['id'],
      });
      for (const child of children) {
        ids.push(child.id);
        queue.push(child.id);
      }
    }

    return ids;
  }

  private async resolveActivityScopeIds(
    manager: Manager,
    activityId: number,
  ): Promise<number[]> {
    const ids: number[] = [];
    let currentId: number | null = Number(activityId);

    while (currentId) {
      const activity = await manager.findOne(Activity, {
        where: { id: currentId },
        select: ['id', 'masterActivityId'],
      });
      if (!activity) {
        break;
      }
      ids.push(Number(activity.id));
      currentId = activity.masterActivityId
        ? Number(activity.masterActivityId)
        : null;
    }

    return [...new Set(ids)];
  }

  private async resolveEpsScopeIds(
    manager: Manager,
    epsNodeId: number,
  ): Promise<number[]> {
    const ids: number[] = [];
    let currentId: number | null = Number(epsNodeId);

    while (currentId) {
      const node = await manager.findOne(EpsNode, {
        where: { id: currentId },
        select: ['id', 'parentId'],
      });
      if (!node) {
        break;
      }
      ids.push(Number(node.id));
      currentId = node.parentId ? Number(node.parentId) : null;
    }

    return [...new Set(ids)];
  }

  private async validatePlanCapacity(
    manager: Manager,
    context: ResolvedPlanContext,
    newQty: number,
    microActivityId: number | null,
    ignoreEntryId: number | null,
  ) {
    const plan = context.plan;
    const qb = manager
      .createQueryBuilder(ExecutionProgressEntry, 'entry')
      .select('COALESCE(SUM(entry.enteredQty), 0)', 'total')
      .where('entry.woActivityPlanId = :woActivityPlanId', {
        woActivityPlanId: plan.id,
      })
      .andWhere('entry.status != :rejected', {
        rejected: ExecutionProgressEntryStatus.REJECTED,
      });

    if (ignoreEntryId) {
      qb.andWhere('entry.id != :ignoreEntryId', { ignoreEntryId });
    }

    const result = await qb.getRawOne<{ total: string }>();
    const currentTotal = Number(result?.total || 0);
    const maxQty = Number(plan.plannedQuantity || 0);

    if (maxQty > 0 && currentTotal + Number(newQty) > maxQty + 0.0001) {
      throw new BadRequestException(
        `Progress exceeds mapped activity quantity. Planned: ${maxQty}, already submitted: ${currentTotal}, new: ${newQty}.`,
      );
    }

    if (microActivityId) {
      const microActivity =
        context.microActivity ||
        (await manager.findOne(MicroScheduleActivity, {
          where: { id: microActivityId, deletedAt: IsNull() },
        }));

      if (!microActivity) {
        throw new BadRequestException('Selected micro schedule activity was not found.');
      }

      const microQb = manager
        .createQueryBuilder(ExecutionProgressEntry, 'entry')
        .select('COALESCE(SUM(entry.enteredQty), 0)', 'total')
        .where('entry.microActivityId = :microActivityId', { microActivityId })
        .andWhere('entry.status != :rejected', {
          rejected: ExecutionProgressEntryStatus.REJECTED,
        });

      if (ignoreEntryId) {
        microQb.andWhere('entry.id != :ignoreEntryId', { ignoreEntryId });
      }

      const microResult = await microQb.getRawOne<{ total: string }>();
      const microSubmittedQty = Number(microResult?.total || 0);
      const microCap = Number(microActivity.allocatedQty || 0);

      if (
        microCap > 0 &&
        microSubmittedQty + Number(newQty) > microCap + 0.0001
      ) {
        throw new BadRequestException(
          `Progress exceeds micro activity quantity. Allocated: ${microCap}, already submitted: ${microSubmittedQty}, new: ${newQty}.`,
        );
      }
      return;
    }

    const ledger = await manager.findOne(MicroQuantityLedger, {
      where: {
        parentActivityId: plan.activityId,
        workOrderItemId: plan.workOrderItemId,
      },
    });

    const directQb = manager
      .createQueryBuilder(ExecutionProgressEntry, 'entry')
      .select('COALESCE(SUM(entry.enteredQty), 0)', 'total')
      .where('entry.woActivityPlanId = :woActivityPlanId', {
        woActivityPlanId: plan.id,
      })
      .andWhere('entry.microActivityId IS NULL')
      .andWhere('entry.status != :rejected', {
        rejected: ExecutionProgressEntryStatus.REJECTED,
      });

    if (ignoreEntryId) {
      directQb.andWhere('entry.id != :ignoreEntryId', { ignoreEntryId });
    }

    const directResult = await directQb.getRawOne<{ total: string }>();
    const currentDirectQty = Number(directResult?.total || 0);
    const directCapacity =
      ledger !== null
        ? Math.max(0, Number(ledger.balanceQty || 0))
        : Number(plan.plannedQuantity || 0);

    if (
      directCapacity > 0 &&
      currentDirectQty + Number(newQty) > directCapacity + 0.0001
    ) {
      throw new BadRequestException(
        `Progress exceeds direct balance quantity. Direct balance: ${directCapacity}, already submitted: ${currentDirectQty}, new: ${newQty}.`,
      );
    }
  }

  private async syncDerivedState(
    manager: Manager,
    activityIds: number[],
    workOrderItemIds: number[],
    boqItemIds: number[],
    boqSubItemIds: number[],
  ) {
    for (const workOrderItemId of [...new Set(workOrderItemIds)].filter(Boolean)) {
      await this.refreshWorkOrderItem(manager, workOrderItemId);
    }

    for (const boqSubItemId of [...new Set(boqSubItemIds)].filter(Boolean)) {
      await this.refreshBoqSubItem(manager, boqSubItemId);
    }

    for (const boqItemId of [...new Set(boqItemIds)].filter(Boolean)) {
      await this.refreshBoqItem(manager, boqItemId);
    }

    for (const activityId of [...new Set(activityIds)].filter(Boolean)) {
      await this.recalculateActivity(manager, activityId);
    }
  }

  private async refreshWorkOrderItem(manager: Manager, workOrderItemId: number) {
    const result = await manager
      .createQueryBuilder(ExecutionProgressEntry, 'entry')
      .select('COALESCE(SUM(entry.enteredQty), 0)', 'total')
      .where('entry.workOrderItemId = :workOrderItemId', { workOrderItemId })
      .andWhere('entry.status = :status', {
        status: ExecutionProgressEntryStatus.APPROVED,
      })
      .getRawOne<{ total: string }>();

    await manager.update(WorkOrderItem, workOrderItemId, {
      executedQuantity: Number(result?.total || 0),
    });
  }

  private async refreshBoqSubItem(manager: Manager, boqSubItemId: number) {
    const result = await manager
      .createQueryBuilder(ExecutionProgressEntry, 'entry')
      .innerJoin(WorkOrderItem, 'woItem', 'woItem.id = entry.workOrderItemId')
      .select('COALESCE(SUM(entry.enteredQty), 0)', 'total')
      .where('woItem.boqSubItemId = :boqSubItemId', { boqSubItemId })
      .andWhere('entry.status = :status', {
        status: ExecutionProgressEntryStatus.APPROVED,
      })
      .getRawOne<{ total: string }>();

    await manager.update(BoqSubItem, boqSubItemId, {
      executedQty: Number(result?.total || 0),
    });
  }

  private async refreshBoqItem(manager: Manager, boqItemId: number) {
    const result = await manager
      .createQueryBuilder(ExecutionProgressEntry, 'entry')
      .innerJoin(WorkOrderItem, 'woItem', 'woItem.id = entry.workOrderItemId')
      .select('COALESCE(SUM(entry.enteredQty), 0)', 'total')
      .where('woItem.boqItemId = :boqItemId', { boqItemId })
      .andWhere('entry.status = :status', {
        status: ExecutionProgressEntryStatus.APPROVED,
      })
      .getRawOne<{ total: string }>();

    await manager.update(BoqItem, boqItemId, {
      consumedQty: Number(result?.total || 0),
    });
  }

  private async recalculateActivity(manager: Manager, activityId: number) {
    const activity = await manager.findOne(Activity, {
      where: { id: activityId },
    });
    if (!activity) {
      return;
    }

    const plans = await manager.find(WoActivityPlan, {
      where: { activityId },
      relations: ['workOrderItem'],
      order: { id: 'ASC' },
    });

    if (!plans.length) {
      activity.percentComplete = 0;
      activity.budgetedValue = 0;
      activity.actualValue = 0;
      activity.status = ActivityStatus.NOT_STARTED;
      activity.startDateActual = null;
      activity.finishDateActual = null;
      await manager.save(Activity, activity);
      return;
    }

    let totalPlannedQty = 0;
    let totalExecutedQty = 0;
    let totalBudgetedValue = 0;
    let totalActualValue = 0;
    let allPlansComplete = true;

    const entryDateRows = await manager
      .createQueryBuilder(ExecutionProgressEntry, 'entry')
      .select('MIN(entry.entryDate)', 'minDate')
      .addSelect('MAX(entry.entryDate)', 'maxDate')
      .where('entry.activityId = :activityId', { activityId })
      .andWhere('entry.status = :status', {
        status: ExecutionProgressEntryStatus.APPROVED,
      })
      .getRawOne<{ minDate: string | null; maxDate: string | null }>();

    for (const plan of plans) {
      const rate =
        Number(plan.workOrderItem?.rate || 0) ||
        Number(
          plan.boqSubItemId
            ? (
                await manager.findOne(BoqSubItem, {
                  where: { id: plan.boqSubItemId },
                  select: ['id', 'rate'],
                })
              )?.rate || 0
            : 0,
        );

      const plannedQty = Number(plan.plannedQuantity || 0);
      totalPlannedQty += plannedQty;
      totalBudgetedValue += plannedQty * rate;

      const executedResult = await manager
        .createQueryBuilder(ExecutionProgressEntry, 'entry')
        .select('COALESCE(SUM(entry.enteredQty), 0)', 'total')
        .where('entry.woActivityPlanId = :woActivityPlanId', {
          woActivityPlanId: plan.id,
        })
        .andWhere('entry.status = :status', {
          status: ExecutionProgressEntryStatus.APPROVED,
        })
        .getRawOne<{ total: string }>();

      const executedQty = Number(executedResult?.total || 0);
      totalExecutedQty += Math.min(plannedQty, executedQty);
      totalActualValue += executedQty * rate;

      if (plannedQty > 0 && executedQty + 0.0001 < plannedQty) {
        allPlansComplete = false;
      }
    }

    const percentComplete =
      totalPlannedQty > 0 ? (totalExecutedQty / totalPlannedQty) * 100 : 0;
    const normalizedPercent = Math.min(100, Math.max(0, percentComplete));

    activity.percentComplete = Number(normalizedPercent.toFixed(2));
    activity.budgetedValue = Number(totalBudgetedValue.toFixed(2));
    activity.actualValue = Number(totalActualValue.toFixed(2));

    if (activity.actualValue > 0 || activity.percentComplete > 0) {
      if (!activity.startDateActual && entryDateRows?.minDate) {
        activity.startDateActual = new Date(entryDateRows.minDate);
      }
      if (activity.status === ActivityStatus.NOT_STARTED) {
        activity.status = ActivityStatus.IN_PROGRESS;
      }
    } else {
      activity.startDateActual = null;
      activity.finishDateActual = null;
      activity.status = ActivityStatus.NOT_STARTED;
    }

    if (normalizedPercent >= 100 && allPlansComplete) {
      activity.percentComplete = 100;
      activity.status = ActivityStatus.COMPLETED;
      if (!activity.finishDateActual && entryDateRows?.maxDate) {
        activity.finishDateActual = new Date(entryDateRows.maxDate);
      }
      if (!activity.startDateActual && entryDateRows?.minDate) {
        activity.startDateActual = new Date(entryDateRows.minDate);
      }
    } else if (activity.status === ActivityStatus.COMPLETED) {
      activity.status = normalizedPercent > 0 ? ActivityStatus.IN_PROGRESS : ActivityStatus.NOT_STARTED;
      activity.finishDateActual = null;
    }

    await manager.save(Activity, activity);
  }

  private async listCompatLogs(
    projectId: number,
    status: ExecutionProgressEntryStatus,
  ) {
    const scopeIds = await this.getProjectScopeIds(projectId);
    const rows = await this.executionEntryRepo
      .createQueryBuilder('entry')
      .leftJoinAndSelect('entry.workOrderItem', 'workOrderItem')
      .leftJoinAndSelect('workOrderItem.boqItem', 'boqItem')
      .leftJoinAndSelect('entry.woActivityPlan', 'woActivityPlan')
      .leftJoinAndSelect('woActivityPlan.activity', 'activity')
      .leftJoinAndSelect('entry.executionEpsNode', 'executionEpsNode')
      .where('entry.status = :status', { status })
      .andWhere(
        '(entry.projectId IN (:...scopeIds) OR woActivityPlan.projectId IN (:...scopeIds) OR activity.projectId IN (:...scopeIds) OR entry.executionEpsNodeId IN (:...scopeIds))',
        { scopeIds },
      )
      .orderBy('entry.createdAt', 'DESC')
      .addOrderBy('entry.id', 'DESC')
      .getMany();

    return rows.map((row) => this.toCompatLogDto(row));
  }

  private async buildCompatLogDto(manager: Manager, entryId: number) {
    const row = await manager.findOne(ExecutionProgressEntry, {
      where: { id: entryId },
      relations: [
        'workOrderItem',
        'workOrderItem.boqItem',
        'woActivityPlan',
        'woActivityPlan.activity',
        'executionEpsNode',
      ],
    });
    if (!row) {
      throw new BadRequestException('Progress log not found after save.');
    }
    return this.toCompatLogDto(row);
  }

  private toCompatLogDto(entry: ExecutionProgressEntry) {
    const boqItem = entry.workOrderItem?.boqItem;
    const activity = entry.woActivityPlan?.activity;
    const epsNode = entry.executionEpsNode;
    const elementName =
      entry.workOrderItem?.description ||
      boqItem?.description ||
      'Execution Progress';

    return {
      id: entry.id,
      executedQty: Number(entry.enteredQty || 0),
      date: entry.entryDate,
      updatedBy: entry.createdBy,
      status: entry.status,
      reviewedBy: entry.approvedBy,
      reviewedAt: entry.approvedAt,
      rejectionReason: entry.rejectionReason,
      measurementElement: {
        id:
          entry.workOrderItem?.measurementElementId ||
          entry.workOrderItemId ||
          entry.id,
        elementName,
        activity: activity
          ? {
              id: activity.id,
              activityCode: activity.activityCode,
              activityName: activity.activityName,
            }
          : null,
        boqItem: boqItem
          ? {
              id: boqItem.id,
              description: boqItem.description,
              uom: boqItem.uom,
              boqCode: boqItem.boqCode,
            }
          : null,
        epsNode: epsNode
          ? {
              id: epsNode.id,
              nodeName: epsNode.name,
              type: epsNode.type,
            }
          : null,
      },
    };
  }

  private async resolveRootProjectId(
    manager: Manager,
    nodeId: number,
  ): Promise<number> {
    if (!nodeId) {
      return nodeId;
    }

    let currentId: number | null = Number(nodeId);
    while (currentId != null) {
      const node = await manager.findOne(EpsNode, {
        where: { id: currentId },
        select: ['id', 'parentId', 'type'],
      });
      if (!node) {
        return Number(nodeId);
      }
      if (String(node.type).toUpperCase() === EpsNodeType.PROJECT) {
        return Number(node.id);
      }
      currentId = node.parentId == null ? null : Number(node.parentId);
    }

    return Number(nodeId);
  }

  private async getProjectScopeIds(projectId: number): Promise<number[]> {
    const nodes = await this.epsRepo.find({
      select: ['id', 'parentId'],
    });
    const scopeIds = new Set<number>([Number(projectId)]);
    const queue = [Number(projectId)];

    while (queue.length) {
      const currentId = queue.shift()!;
      for (const node of nodes) {
        if (node.parentId === currentId && !scopeIds.has(Number(node.id))) {
          scopeIds.add(Number(node.id));
          queue.push(Number(node.id));
        }
      }
    }

    return Array.from(scopeIds);
  }

  async resolveExecutionFloorForActivity(activityId: number): Promise<number | null> {
    const activity = await this.activityRepo.findOne({
      where: { id: activityId },
    });
    if (!activity) return null;

    const nodes = await this.epsRepo.find({
      select: ['id', 'parentId', 'type'],
    });
    const nodeMap = new Map<number, EpsNode>(nodes.map((node) => [node.id, node]));

    let currentId: number | null = Number(activity.projectId);
    while (currentId != null) {
      const node = nodeMap.get(currentId);
      if (!node) return Number(activity.projectId);
      if (
        node.type === EpsNodeType.FLOOR ||
        String(node.type || '').toUpperCase() === 'LEVEL'
      ) {
        return node.id;
      }
      currentId = node.parentId == null ? null : Number(node.parentId);
    }

    return Number(activity.projectId);
  }
}
