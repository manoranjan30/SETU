import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In } from 'typeorm';
import { MeasurementElement } from '../boq/entities/measurement-element.entity';
import { MeasurementProgress } from '../boq/entities/measurement-progress.entity';
import { BoqItem } from '../boq/entities/boq-item.entity';
import { Activity, ActivityStatus } from '../wbs/entities/activity.entity';
import { BoqActivityPlan } from '../planning/entities/boq-activity-plan.entity';
import { BoqService } from '../boq/boq.service';

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);

  constructor(
    private dataSource: DataSource,
    private boqService: BoqService,
    @InjectRepository(Activity)
    private activityRepo: Repository<Activity>,
    @InjectRepository(BoqActivityPlan)
    private planRepo: Repository<BoqActivityPlan>,
    @InjectRepository(BoqItem)
    private boqRepo: Repository<BoqItem>,
    @InjectRepository(MeasurementProgress)
    private progressRepo: Repository<MeasurementProgress>,
    @InjectRepository(MeasurementElement)
    private measurementRepo: Repository<MeasurementElement>,
  ) {}

  async batchSaveMeasurements(
    projectId: number,
    entries: any[],
    userId: number,
    autoApprove: boolean = false, // If true (Admin/PM), status = APPROVED immediately
  ) {
    return await this.dataSource.transaction(async (manager) => {
      const results: MeasurementProgress[] = [];

      for (const entry of entries) {
        // 1. Fetch BOQ Item to get context (EPS Node)
        const boqItem = await manager.findOne(BoqItem, {
          where: { id: entry.boqItemId },
        });
        if (!boqItem) {
          this.logger.warn(
            `BoqItem ${entry.boqItemId} not found for measurement entry`,
          );
          continue; // Skip invalid
        }

        // 2. Find or Create "Site Execution" Measurement Holder
        const epsNodeId = entry.wbsNodeId || boqItem.epsNodeId || projectId;
        const microSuffix = entry.microActivityId
          ? `-MICRO-${entry.microActivityId}`
          : '';

        let siteMeas = await manager.findOne(MeasurementElement, {
          where: {
            boqItemId: entry.boqItemId,
            activityId: entry.activityId || null,
            microActivityId: entry.microActivityId || null,
            elementId: `SITE-EXEC-${entry.boqItemId}-${entry.activityId || 'GENERIC'}-${epsNodeId}-${entry.planId || 'NOPLAN'}${microSuffix}`,
          },
        });

        if (!siteMeas) {
          const epsNodeId = entry.wbsNodeId || boqItem.epsNodeId || projectId;
          siteMeas = manager.create(MeasurementElement, {
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
          siteMeas = await manager.save(MeasurementElement, siteMeas);
        }

        // 3. Create Progress Log
        const status = autoApprove ? 'APPROVED' : 'PENDING';

        const progress = new MeasurementProgress();
        progress.measurementElement = siteMeas;
        progress.executedQty = entry.executedQty;
        progress.date = new Date(entry.date);
        progress.updatedBy = userId.toString();
        progress.status = status;
        progress.reviewedBy = autoApprove ? userId.toString() : null;
        progress.reviewedAt = autoApprove ? new Date() : null;

        await manager.save(MeasurementProgress, progress);
        results.push(progress);

        // 4. Update Aggregates & Sync Schedule (ONLY IF APPROVED)
        if (status === 'APPROVED') {
          await this.recomputeAggregates(siteMeas.id, manager);

          // Trigger Schedule Update
          await this.syncSchedule(entry.boqItemId, manager, entry.activityId);
        }
      }

      return results;
    });
  }

  private async syncSchedule(
    boqItemId: number,
    manager: any,
    triggerActivityId?: number,
  ) {
    // 1. Find Linked Activities
    const plans = await manager.find(BoqActivityPlan, {
      where: { boqItemId },
      relations: ['activity'],
    });

    if (!plans || plans.length === 0) return;

    // 2. For each Activity, Recalculate %
    const activityIds = [...new Set(plans.map((p) => p.activityId))];

    for (const actId of activityIds) {
      // Optimization: If triggerActivityId is known, only update THAT activity?
      // Actually, if a BOQ item is shared generically (no activity context), it affects ALL.
      // If it HAS activity context, it should only affect THAT activity.

      // If the measurement was specific to Activity A, ideally we shouldn't touch Activity B.
      // But 'recalculateActivityProgress' will handle the filtering logic.
      await this.recalculateActivityProgress(actId as number, manager);
    }
  }

  private async recomputeAggregates(meId: number, manager: any) {
    // 1. Recompute MeasurementElement.executedQty from APPROVED logs
    const { total } = await manager
      .createQueryBuilder(MeasurementProgress, 'p')
      .where('p.measurementElementId = :meId', { meId })
      .andWhere('p.status = :status', { status: 'APPROVED' })
      .select('COALESCE(SUM(p.executedQty), 0)', 'total')
      .getRawOne();

    await manager.update(MeasurementElement, meId, {
      executedQty: Number(total),
    });

    // 2. Recompute BoqItem.consumedQty from all its MeasurementElements
    const me = await manager.findOne(MeasurementElement, {
      where: { id: meId },
    });
    if (me?.boqItemId) {
      const { boqTotal } = await manager
        .createQueryBuilder(MeasurementElement, 'me')
        .where('me.boqItemId = :boqId', { boqId: me.boqItemId })
        .select('COALESCE(SUM(me.executedQty), 0)', 'boqTotal')
        .getRawOne();

      await manager.update(BoqItem, me.boqItemId, {
        consumedQty: Number(boqTotal),
      });
    }
  }

  private async recalculateActivityProgress(activityId: number, manager: any) {
    const activity = await manager.findOne(Activity, {
      where: { id: activityId },
    });
    if (!activity) return;

    // Fetch All Links for this Activity
    const allLinks = await manager.find(BoqActivityPlan, {
      where: { activityId },
      relations: ['boqItem'],
    });

    let totalWeightedProgress = 0;
    let totalActivityPlanned = 0;
    let totalBudgetedValue = 0;
    let totalActualValue = 0;

    let allLinksComplete = true; // Strict Check

    for (const link of allLinks) {
      const item = link.boqItem;
      const rate = Number(item.rate || 0);

      // Planned Portion for this specific Activity
      const plannedQty = Number(link.plannedQuantity);
      totalActivityPlanned += plannedQty;
      totalBudgetedValue += plannedQty * rate;

      // Executed Portion specific to this Activity+BOQ+Plan
      const specificMeas = await manager.find(MeasurementElement, {
        where: { boqItemId: item.id, activityId: activityId },
      });
      const specificConsumed = specificMeas.reduce(
        (sum, m) => sum + Number(m.executedQty),
        0,
      );
      totalActualValue += specificConsumed * rate;

      // Calculation based on Plan Weighting
      totalWeightedProgress += Math.min(plannedQty, specificConsumed); // Cap weight contribution to 100% for % calculation

      // Strict Finish Verification
      if (specificConsumed < plannedQty) {
        allLinksComplete = false;
      }
    }

    if (totalActivityPlanned === 0) return;

    const percentComplete =
      (totalWeightedProgress / totalActivityPlanned) * 100;
    const finalPercent = Math.min(100, Math.max(0, percentComplete));

    // Update Activity
    const oldStatus = activity.status;
    activity.percentComplete = Number(finalPercent.toFixed(2));
    activity.budgetedValue = Number(totalBudgetedValue.toFixed(2));
    activity.actualValue = Number(totalActualValue.toFixed(2));

    const today = new Date();

    // 1. AUTO-START Logic
    if (activity.percentComplete > 0 && !activity.startDateActual) {
      activity.startDateActual = today;
      if (activity.status === ActivityStatus.NOT_STARTED) {
        activity.status = ActivityStatus.IN_PROGRESS;
      }
    }

    // 2. AUTO-FINISH Logic (Now strict)
    if (finalPercent >= 100 && allLinksComplete) {
      if (!activity.finishDateActual) {
        activity.finishDateActual = today;
      }
      activity.status = ActivityStatus.COMPLETED;
      activity.percentComplete = 100;
    }

    // 3. REVERSAL Logic (If user clears date or quantity drops)
    if (
      (activity.percentComplete < 100 || !allLinksComplete) &&
      activity.status === ActivityStatus.COMPLETED
    ) {
      activity.status = ActivityStatus.IN_PROGRESS;
      activity.finishDateActual = null;
    }

    // 4. MANUAL OVERRIDE SYNC (If finish date is missing but was complete, ensure status reflects)
    if (
      !activity.finishDateActual &&
      activity.status === ActivityStatus.COMPLETED
    ) {
      activity.status = ActivityStatus.IN_PROGRESS;
    }

    await manager.save(Activity, activity);
    this.logger.log(
      `[ScheduleSync] ${activity.activityCode}: ${activity.percentComplete}% (${activity.status}) - AllLinksComplete: ${allLinksComplete}`,
    );

    // --- 3. SYNC TO ACTIVE WORKING SCHEDULE ---
    // User expects the "Working Schedule" to reflect these actuals in the Planned Dates (As-Built effect).
    // Find Active Version
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
        // If Actual Start is set, update Plan Start to match (or keep it if it was already same?)
        // Usually, Actual overrides Plan in current view.
        if (activity.startDateActual) {
          av.startDate = activity.startDateActual;
          changed = true;
        }
        if (activity.finishDateActual) {
          av.finishDate = activity.finishDateActual;
          av.percentComplete = 100; // If version had % field (it doesn't, but logic holds)
          changed = true;
        }

        // If In Progress, Duration might change?
        // Let's just sync dates for now.

        if (changed) {
          await manager.save('ActivityVersion', av);
          this.logger.log(`Synced ActivityVersion ${av.id} dates to Actuals`);
        }
      }
    }
  }

  async getProjectProgressLogs(projectId: number) {
    this.logger.log(`Fetching progress logs for project: ${projectId}`);

    // Debug check: what site execution elements exist at all?
    const debugElements = await this.measurementRepo.find({
      where: { elementName: 'Site Execution' },
      take: 5,
    });
    this.logger.debug(
      `Sample Site Execution Elements: ${JSON.stringify(debugElements.map((e) => ({ id: e.id, projectId: e.projectId, activityId: e.activityId })))}`,
    );

    const logs = await this.progressRepo
      .createQueryBuilder('progress')
      .innerJoinAndSelect('progress.measurementElement', 'me')
      .leftJoinAndSelect('me.boqItem', 'boq')
      .leftJoinAndSelect('me.activity', 'act')
      .where('me.projectId = :projectId', { projectId })
      .andWhere('progress.status = :status', { status: 'APPROVED' })
      .orderBy('progress.loggedOn', 'DESC')
      .getMany();

    this.logger.log(
      `Found ${logs.length} APPROVED progress logs for project ${projectId}`,
    );
    return logs;
  }

  async updateProgressLog(logId: number, newQty: number, userId: number) {
    return await this.dataSource.transaction(async (manager) => {
      const progress = await manager.findOne(MeasurementProgress, {
        where: { id: logId },
        relations: ['measurementElement', 'measurementElement.boqItem'],
      });

      if (!progress) throw new Error('Progress log not found');

      const me = progress.measurementElement;
      const boqItem = me.boqItem;
      const diff = Number(newQty) - Number(progress.executedQty);

      // 1. Update Log
      progress.executedQty = newQty;
      progress.updatedBy = userId.toString();
      await manager.save(progress);

      // 2. Recompute Aggregates
      await this.recomputeAggregates(me.id, manager);

      // 3. Trigger Syncs
      if (boqItem) {
        await this.syncSchedule(boqItem.id, manager, me.activityId);
      }

      return progress;
    });
  }

  async deleteProgressLog(logId: number) {
    return await this.dataSource.transaction(async (manager) => {
      const progress = await manager.findOne(MeasurementProgress, {
        where: { id: logId },
        relations: ['measurementElement', 'measurementElement.boqItem'],
      });

      if (!progress) throw new Error('Progress log not found');

      const me = progress.measurementElement;
      const boqItem = me.boqItem;
      const qtyToRemove = Number(progress.executedQty);

      // 1. Delete Log
      await manager.remove(progress);

      // ONLY recompute if this progress log was actually approved
      if (progress.status === 'APPROVED') {
        // 2. Recompute Aggregates
        await this.recomputeAggregates(me.id, manager);

        // 3. Trigger Syncs
        if (boqItem) {
          await this.syncSchedule(boqItem.id, manager, me.activityId);
        }
      }

      return { success: true };
    });
  }

  async getPendingProgressLogs(projectId: number) {
    return await this.progressRepo
      .createQueryBuilder('progress')
      .innerJoinAndSelect('progress.measurementElement', 'me')
      .leftJoinAndSelect('me.boqItem', 'boq')
      .leftJoinAndSelect('me.activity', 'act')
      .leftJoinAndSelect('me.epsNode', 'loc') // location context
      .where('me.projectId = :projectId', { projectId })
      .andWhere('progress.status = :status', { status: 'PENDING' })
      .orderBy('progress.loggedOn', 'DESC')
      .getMany();
  }

  async approveProgress(logIds: number[], userId: number) {
    return await this.dataSource.transaction(async (manager) => {
      // Fetch only PENDING items to avoid double-counting
      const logs = await manager.find(MeasurementProgress, {
        where: {
          id: In(logIds),
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
        // 1. Mark Approved
        progress.status = 'APPROVED';
        progress.reviewedBy = userId.toString();
        progress.reviewedAt = new Date();
        await manager.save(MeasurementProgress, progress);

        // 2. Perform Adjustments (Deferred Logic)
        const me = progress.measurementElement;

        if (!me) continue; // Should not happen

        const boqItem = me.boqItem;

        // Recompute Aggregates
        await this.recomputeAggregates(me.id, manager);

        // Trigger Schedule Sync
        if (boqItem) {
          await this.syncSchedule(boqItem.id, manager, me.activityId);
        }
      }

      this.logger.log(`Approved ${logs.length} progress entries`);
      return { success: true, count: logs.length };
    });
  }

  async rejectProgress(logIds: number[], userId: number, reason: string) {
    // Just update status, do NOT touch aggregates
    const result = await this.dataSource.manager.update(
      MeasurementProgress,
      { id: In(logIds), status: 'PENDING' },
      {
        status: 'REJECTED',
        reviewedBy: userId.toString(),
        reviewedAt: new Date(),
        rejectionReason: reason,
      },
    );
    return { success: true, affected: result.affected };
  }
}
