import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, In } from 'typeorm';
import * as xml2js from 'xml2js';
import {
  ScheduleVersion,
  ScheduleVersionType,
} from './entities/schedule-version.entity';
import { ActivityVersion } from './entities/activity-version.entity';
import { Activity, ActivityStatus } from '../wbs/entities/activity.entity';
import { ActivityRelationship } from '../wbs/entities/activity-relationship.entity';
import { SchedulingEngineService } from './scheduling-engine.service';
import { WbsNode } from '../wbs/entities/wbs.entity';

@Injectable()
export class ScheduleVersionService {
  constructor(
    @InjectRepository(ScheduleVersion)
    private versionRepo: Repository<ScheduleVersion>,
    @InjectRepository(ActivityVersion)
    private activityVersionRepo: Repository<ActivityVersion>,
    @InjectRepository(Activity) // Need this to clone from Master
    private activityRepo: Repository<Activity>,
    @InjectRepository(ActivityRelationship)
    private relRepo: Repository<ActivityRelationship>,
    @InjectRepository(WbsNode)
    private wbsRepo: Repository<WbsNode>,
    private dataSource: DataSource,
    private engine: SchedulingEngineService,
  ) {}

  private readonly wbsUidPrefix = 900000;

  private parseDateInput(value?: string | Date | null): Date | null {
    if (!value) return null;
    const next = value instanceof Date ? value : new Date(value);
    return Number.isNaN(next.getTime()) ? null : next;
  }

  private formatDuration(durationDays: number): string {
    if (!durationDays || durationDays <= 0) return 'PT0H0M0S';
    const hours = Math.round(Number(durationDays) * 8);
    return `PT${hours}H0M0S`;
  }

  private mapRelationshipType(type: string): string {
    switch (type) {
      case 'FF':
        return '0';
      case 'FS':
        return '1';
      case 'SF':
        return '2';
      case 'SS':
        return '3';
      default:
        return '1';
    }
  }

  private formatLag(lagDays: number | null | undefined): string | undefined {
    if (!lagDays) return undefined;
    const val = Math.round(Number(lagDays) * 4800);
    return `${val}`;
  }

  private buildWbsOutlineNumbers(nodes: WbsNode[]): Map<number, string> {
    const outlineById = new Map<number, string>();
    const childrenByParent = new Map<number | null, WbsNode[]>();

    for (const node of nodes) {
      const list = childrenByParent.get(node.parentId || null) || [];
      list.push(node);
      childrenByParent.set(node.parentId || null, list);
    }

    const isOutline = (code: string) => /^\d+(\.\d+)*$/.test(code);

    const walk = (parentId: number | null, prefix: string | null) => {
      const children = childrenByParent.get(parentId || null) || [];
      children.sort((a, b) => {
        if (a.sequenceNo !== b.sequenceNo) return a.sequenceNo - b.sequenceNo;
        return a.id - b.id;
      });
      children.forEach((child, index) => {
        const outline = isOutline(child.wbsCode)
          ? child.wbsCode
          : prefix
            ? `${prefix}.${index + 1}`
            : `${index + 1}`;
        outlineById.set(child.id, outline);
        walk(child.id, outline);
      });
    };

    walk(null, null);
    return outlineById;
  }

  private async getVersionFinish(versionId: number): Promise<Date | null> {
    const rows = await this.activityVersionRepo.find({
      where: { versionId },
      order: { finishDate: 'DESC' },
      take: 1,
    });
    return rows[0]?.finishDate ? new Date(rows[0].finishDate) : null;
  }

  private async generateUniqueActivityCode(
    projectId: number,
    preferredCode?: string,
  ) {
    const baseCode = (preferredCode || 'MANUAL-ACTIVITY').trim();
    let nextCode = baseCode;
    let suffix = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await this.activityRepo.findOne({
        where: { projectId, activityCode: nextCode },
      });
      if (!existing) return nextCode;
      suffix += 1;
      nextCode = `${baseCode}-${suffix}`;
    }
  }

  async getVersionRelationships(versionId: number) {
    const version = await this.versionRepo.findOne({ where: { id: versionId } });
    if (!version) {
      throw new NotFoundException('Working schedule version not found');
    }
    return this.relRepo.find({
      where: [
        { projectId: version.projectId, versionId: IsNull() },
        { projectId: version.projectId, versionId },
      ],
      relations: ['predecessor', 'successor'],
    });
  }

  private async syncVersionPredecessorLink(
    versionId: number,
    successorActivityId: number,
    predecessorActivityId?: number | null,
    relationshipType: string = 'FS',
    lagDays?: number | null,
  ) {
    await this.relRepo
      .createQueryBuilder()
      .delete()
      .from(ActivityRelationship)
      .where('versionId = :versionId', { versionId })
      .andWhere('successor_activity_id = :successorActivityId', {
        successorActivityId,
      })
      .execute();

    if (!predecessorActivityId) {
      return;
    }

    const predecessorExists = await this.activityVersionRepo.findOne({
      where: { versionId, activityId: predecessorActivityId },
    });
    if (!predecessorExists) {
      throw new BadRequestException(
        'Selected predecessor is not available in this working schedule.',
      );
    }

    const predecessor = await this.activityRepo.findOne({
      where: { id: predecessorActivityId },
    });
    const successor = await this.activityRepo.findOne({
      where: { id: successorActivityId },
    });

    if (!predecessor || !successor) {
      throw new NotFoundException('Unable to resolve predecessor activity');
    }

    await this.relRepo.save(
      this.relRepo.create({
        projectId: predecessor.projectId,
        versionId,
        predecessor,
        successor,
        relationshipType: relationshipType as any,
        lagDays: Number(lagDays || 0),
      }),
    );
  }

  async getVersions(projectId: number) {
    return this.versionRepo.find({
      where: { projectId },
      order: { createdOn: 'DESC' },
    });
  }

  async createVersion(
    projectId: number,
    code: string,
    type: ScheduleVersionType,
    sourceVersionId?: number,
    user: string = 'System',
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Determine Sequence Number
      let sequenceNumber = 0;
      let parentVersionId: number | null = null;

      if (sourceVersionId) {
        // Cloning from existing version?
        const parent = await this.versionRepo.findOne({
          where: { id: sourceVersionId },
        });
        if (parent) {
          sequenceNumber = parent.sequenceNumber + 1;
          parentVersionId = parent.id;
        }
      } else {
        // Cloning from Master => R0 (Baseline)
        sequenceNumber = 0;
      }

      // 1. Create Version Record
      const newVersion = this.versionRepo.create({
        projectId,
        versionCode: code,
        versionType: type,
        parentVersionId,
        sequenceNumber,
        createdBy: user,
        isActive: type === ScheduleVersionType.WORKING,
      });
      const savedVersion = await queryRunner.manager.save(
        ScheduleVersion,
        newVersion,
      );

      // 2. Clone Activities
      if (!sourceVersionId) {
        // CLONE FROM MASTER (Activity Table) -> R0
        const masterActivities = await this.activityRepo.find({
          where: { projectId },
        });

        const versions = masterActivities.map((act) => {
          return this.activityVersionRepo.create({
            versionId: savedVersion.id,
            activityId: act.id,
            startDate: act.startDatePlanned,
            finishDate: act.finishDatePlanned,
            duration: act.durationPlanned,
            remarks: 'Initial R0 Baseline from Master',
          });
        });

        await queryRunner.manager.save(ActivityVersion, versions);
      } else {
        // CLONE FROM PREVIOUS VERSION -> R(n+1)
        const sourceActivities = await this.activityVersionRepo.find({
          where: { versionId: sourceVersionId },
        });

        const versions = sourceActivities.map((av) => {
          return this.activityVersionRepo.create({
            versionId: savedVersion.id,
            activityId: av.activityId,
            startDate: av.startDate,
            finishDate: av.finishDate,
            duration: av.duration,
            isCritical: av.isCritical,
            totalFloat: av.totalFloat,
            freeFloat: av.freeFloat,
            remarks: `Cloned from ${sourceVersionId} (R${sequenceNumber - 1})`,
          });
        });

        await queryRunner.manager.save(ActivityVersion, versions);

        const sourceRelationships = await queryRunner.manager.find(
          ActivityRelationship,
          {
            where: { projectId, versionId: sourceVersionId },
            relations: ['predecessor', 'successor'],
          },
        );

        if (sourceRelationships.length > 0) {
          const clonedRelationships = sourceRelationships.map((rel) =>
            queryRunner.manager.create(ActivityRelationship, {
              projectId,
              versionId: savedVersion.id,
              predecessor: rel.predecessor,
              successor: rel.successor,
              relationshipType: rel.relationshipType,
              lagDays: rel.lagDays,
            }),
          );
          await queryRunner.manager.save(ActivityRelationship, clonedRelationships);
        }
      }

      await queryRunner.commitTransaction();
      return savedVersion;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getVersionActivities(versionId: number) {
    return this.activityVersionRepo.find({
      where: { versionId },
      relations: ['activity', 'activity.wbsNode'],
    });
  }

  async updateActivityDate(
    versionId: number,
    activityId: number,
    start?: Date,
    finish?: Date,
    actualStart?: Date,
    actualFinish?: Date,
  ) {
    const av = await this.activityVersionRepo.findOne({
      where: { versionId, activityId },
      relations: ['activity'], // Load Master Activity
    });
    if (!av) throw new NotFoundException('Activity not found in this version');

    // Update Planned Dates (Version Specific)
    if (start !== undefined) av.startDate = start;
    if (finish !== undefined) av.finishDate = finish;
    await this.activityVersionRepo.save(av);

    // Update Actual Dates (Master Activity)
    // Since Actuals are "Reality", they propagate to the Master Record.
    if (av.activity) {
      let masterChanged = false;

      // Handle Actual Start
      if (actualStart !== undefined) {
        av.activity.startDateActual = actualStart;
        masterChanged = true;
        // If we set a start date but status was NOT_STARTED, move to IN_PROGRESS
        if (actualStart && av.activity.status === ActivityStatus.NOT_STARTED) {
          av.activity.status = ActivityStatus.IN_PROGRESS;
        }
      }

      // Handle Actual Finish
      if (actualFinish !== undefined) {
        const oldFinish = av.activity.finishDateActual;
        av.activity.finishDateActual = actualFinish;
        masterChanged = true;

        if (actualFinish) {
          // Marking as finished
          av.activity.status = ActivityStatus.COMPLETED;
          av.activity.percentComplete = 100;
        } else if (oldFinish && !actualFinish) {
          // Clearing a finish date -> Revert Status
          av.activity.status = ActivityStatus.IN_PROGRESS;
          // Note: percentComplete stays as-is (calculated from BOQ)
          // or should we force it back below 100?
          // Recalculate logic will handle it, but for immediate UI feedback:
          if (av.activity.percentComplete >= 100) {
            av.activity.percentComplete = 99.9; // Small nudge to reflect "incomplete"
          }
        }
      }

      if (masterChanged) {
        await this.activityRepo.save(av.activity);
      }
    }

    return av;
  }

  async addManualActivity(
    versionId: number,
    payload: {
      targetWbsNodeId: number;
      selectedActivityId?: number;
      activityCode?: string;
      activityName: string;
      startDate?: string | Date | null;
      finishDate?: string | Date | null;
      duration?: number;
      remarks?: string;
      createdBy?: string;
      predecessorActivityId?: number | null;
      relationshipType?: string;
      lagDays?: number | null;
    },
  ) {
    const version = await this.versionRepo.findOne({ where: { id: versionId } });
    if (!version) throw new NotFoundException('Working schedule version not found');

    const targetWbs = await this.wbsRepo.findOne({
      where: { id: payload.targetWbsNodeId, projectId: version.projectId },
    });
    if (!targetWbs) {
      throw new NotFoundException('Target WBS node not found in this project');
    }

    const startDate = this.parseDateInput(payload.startDate);
    const finishDate = this.parseDateInput(payload.finishDate);
    if (!startDate || !finishDate) {
      throw new BadRequestException(
        'Manual activity requires planned start and finish dates.',
      );
    }
    if (finishDate.getTime() < startDate.getTime()) {
      throw new BadRequestException(
        'Finish date cannot be earlier than start date.',
      );
    }

    const originalFinish = await this.getVersionFinish(versionId);
    const requestedDuration =
      Number(payload.duration || 0) > 0
        ? Number(payload.duration)
        : Number(
            Math.max(
              1,
              Math.ceil(
                (finishDate.getTime() - startDate.getTime()) /
                  (1000 * 60 * 60 * 24),
              ),
            ).toFixed(2),
          );

    let savedActivityId: number | null = null;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const activityCode = await this.generateUniqueActivityCode(
        version.projectId,
        payload.activityCode,
      );

      const activity = queryRunner.manager.create(Activity, {
        projectId: version.projectId,
        wbsNode: targetWbs,
        activityCode,
        activityName: payload.activityName.trim(),
        durationPlanned: requestedDuration,
        startDatePlanned: startDate,
        finishDatePlanned: finishDate,
        startDateMSP: startDate,
        finishDateMSP: finishDate,
        createdBy: payload.createdBy || 'Manual Revision',
        status: ActivityStatus.NOT_STARTED,
        percentComplete: 0,
        budgetedValue: 0,
        actualValue: 0,
        originVersionId: versionId,
      });
      const savedActivity = await queryRunner.manager.save(Activity, activity);
      savedActivityId = savedActivity.id;

      const versionRow = queryRunner.manager.create(ActivityVersion, {
        versionId,
        activityId: savedActivity.id,
        startDate,
        finishDate,
        duration: requestedDuration,
        remarks:
          payload.remarks?.trim() ||
          `Manual insertion in ${version.versionCode}`,
      });
      await queryRunner.manager.save(ActivityVersion, versionRow);

      if (payload.predecessorActivityId) {
        const predecessor = await queryRunner.manager.findOne(Activity, {
          where: { id: payload.predecessorActivityId },
        });
        if (!predecessor) {
          throw new NotFoundException('Selected predecessor activity not found');
        }
        await queryRunner.manager.save(
          ActivityRelationship,
          queryRunner.manager.create(ActivityRelationship, {
            projectId: version.projectId,
            versionId,
            predecessor,
            successor: savedActivity,
            relationshipType: (payload.relationshipType || 'FS') as any,
            lagDays: Number(payload.lagDays || 0),
          }),
        );
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    await this.recalculateSchedule(versionId);
    const newFinish = await this.getVersionFinish(versionId);

    if (
      originalFinish &&
      newFinish &&
      newFinish.getTime() > originalFinish.getTime()
    ) {
      const inserted = savedActivityId
        ? await this.activityRepo.findOne({ where: { id: savedActivityId } })
        : null;
      if (inserted) {
        await this.activityVersionRepo.delete({
          versionId,
          activityId: inserted.id,
        });
        await this.activityRepo.delete({ id: inserted.id });
        await this.recalculateSchedule(versionId);
      }

      throw new BadRequestException(
        `This activity cannot be added because it would push the project finish from ${originalFinish.toISOString().split('T')[0]} to ${newFinish.toISOString().split('T')[0]}. Kindly revise the schedule and import the updated XML instead.`,
      );
    }

    if (!savedActivityId) return null;
    return this.activityVersionRepo.findOne({
      where: {
        versionId,
        activityId: savedActivityId,
      },
      relations: ['activity', 'activity.wbsNode'],
    });
  }

  async updateManualActivity(
    versionId: number,
    activityId: number,
    payload: {
      targetWbsNodeId: number;
      activityCode?: string;
      activityName: string;
      startDate?: string | Date | null;
      finishDate?: string | Date | null;
      duration?: number;
      remarks?: string;
      predecessorActivityId?: number | null;
      relationshipType?: string;
      lagDays?: number | null;
    },
  ) {
    const version = await this.versionRepo.findOne({ where: { id: versionId } });
    if (!version) throw new NotFoundException('Working schedule version not found');

    const activityVersion = await this.activityVersionRepo.findOne({
      where: { versionId, activityId },
      relations: ['activity', 'activity.wbsNode'],
    });
    if (!activityVersion?.activity) {
      throw new NotFoundException('Manual activity not found in this version');
    }
    if (!activityVersion.activity.originVersionId) {
      throw new BadRequestException(
        'Only manually added working schedule activities can be edited here.',
      );
    }

    const targetWbs = await this.wbsRepo.findOne({
      where: { id: payload.targetWbsNodeId, projectId: version.projectId },
    });
    if (!targetWbs) {
      throw new NotFoundException('Target WBS node not found in this project');
    }

    const originalFinish = await this.getVersionFinish(versionId);
    const previousActivityState = {
      activityCode: activityVersion.activity.activityCode,
      activityName: activityVersion.activity.activityName,
      wbsNodeId: activityVersion.activity.wbsNode?.id,
      startDate: activityVersion.startDate,
      finishDate: activityVersion.finishDate,
      duration: activityVersion.duration,
      remarks: activityVersion.remarks,
    };
    const previousPredecessors = await this.relRepo.find({
      where: { versionId, successor: { id: activityId } as Activity },
      relations: ['predecessor', 'successor'],
    });

    const startDate = this.parseDateInput(payload.startDate);
    const finishDate = this.parseDateInput(payload.finishDate);
    if (!startDate || !finishDate) {
      throw new BadRequestException(
        'Manual activity requires planned start and finish dates.',
      );
    }
    if (finishDate.getTime() < startDate.getTime()) {
      throw new BadRequestException(
        'Finish date cannot be earlier than start date.',
      );
    }

    activityVersion.activity.wbsNode = targetWbs;
    activityVersion.activity.activityCode = (payload.activityCode || '').trim()
      ? payload.activityCode!.trim()
      : activityVersion.activity.activityCode;
    activityVersion.activity.activityName = payload.activityName.trim();
    activityVersion.activity.durationPlanned = Number(payload.duration || activityVersion.duration || 1);
    activityVersion.activity.startDatePlanned = startDate;
    activityVersion.activity.finishDatePlanned = finishDate;
    activityVersion.activity.startDateMSP = startDate;
    activityVersion.activity.finishDateMSP = finishDate;

    activityVersion.startDate = startDate;
    activityVersion.finishDate = finishDate;
    activityVersion.duration = Number(payload.duration || activityVersion.duration || 1);
    activityVersion.remarks =
      payload.remarks?.trim() || activityVersion.remarks || '';

    await this.activityRepo.save(activityVersion.activity);
    await this.activityVersionRepo.save(activityVersion);
    await this.syncVersionPredecessorLink(
      versionId,
      activityId,
      payload.predecessorActivityId,
      payload.relationshipType,
      payload.lagDays,
    );

    await this.recalculateSchedule(versionId);
    const newFinish = await this.getVersionFinish(versionId);

    if (
      originalFinish &&
      newFinish &&
      newFinish.getTime() > originalFinish.getTime()
    ) {
      activityVersion.activity.activityCode = previousActivityState.activityCode;
      activityVersion.activity.activityName = previousActivityState.activityName;
      if (previousActivityState.wbsNodeId) {
        const previousWbs = await this.wbsRepo.findOne({
          where: { id: previousActivityState.wbsNodeId },
        });
        if (previousWbs) {
          activityVersion.activity.wbsNode = previousWbs;
        }
      }
      activityVersion.activity.startDatePlanned = previousActivityState.startDate;
      activityVersion.activity.finishDatePlanned = previousActivityState.finishDate;
      activityVersion.activity.startDateMSP = previousActivityState.startDate;
      activityVersion.activity.finishDateMSP = previousActivityState.finishDate;
      activityVersion.activity.durationPlanned = Number(previousActivityState.duration || 0);
      activityVersion.startDate = previousActivityState.startDate;
      activityVersion.finishDate = previousActivityState.finishDate;
      activityVersion.duration = Number(previousActivityState.duration || 0);
      activityVersion.remarks = previousActivityState.remarks || '';

      await this.activityRepo.save(activityVersion.activity);
      await this.activityVersionRepo.save(activityVersion);
      await this.relRepo
        .createQueryBuilder()
        .delete()
        .from(ActivityRelationship)
        .where('versionId = :versionId', { versionId })
        .andWhere('successor_activity_id = :activityId', { activityId })
        .execute();
      if (previousPredecessors.length > 0) {
        await this.relRepo.save(
          previousPredecessors.map((rel) =>
            this.relRepo.create({
              projectId: rel.projectId,
              versionId: rel.versionId,
              predecessor: rel.predecessor,
              successor: rel.successor,
              relationshipType: rel.relationshipType,
              lagDays: rel.lagDays,
            }),
          ),
        );
      }
      await this.recalculateSchedule(versionId);

      throw new BadRequestException(
        `This activity cannot be updated because it would push the project finish from ${originalFinish.toISOString().split('T')[0]} to ${newFinish.toISOString().split('T')[0]}. Kindly revise the schedule and import the updated XML instead.`,
      );
    }

    return this.activityVersionRepo.findOne({
      where: { versionId, activityId },
      relations: ['activity', 'activity.wbsNode'],
    });
  }

  async deleteManualActivity(versionId: number, activityId: number) {
    const activityVersion = await this.activityVersionRepo.findOne({
      where: { versionId, activityId },
      relations: ['activity'],
    });
    if (!activityVersion?.activity) {
      throw new NotFoundException('Manual activity not found in this version');
    }
    if (!activityVersion.activity.originVersionId) {
      throw new BadRequestException(
        'Only manually added working schedule activities can be deleted here.',
      );
    }

    await this.relRepo
      .createQueryBuilder()
      .delete()
      .from(ActivityRelationship)
      .where('versionId = :versionId', { versionId })
      .andWhere(
        '(successor_activity_id = :activityId OR predecessor_activity_id = :activityId)',
        { activityId },
      )
      .execute();
    await this.activityVersionRepo.delete({ versionId, activityId });

    const remainingVersions = await this.activityVersionRepo.count({
      where: { activityId },
    });
    if (remainingVersions === 0) {
      await this.relRepo
        .createQueryBuilder()
        .delete()
        .from(ActivityRelationship)
        .where(
          'successor_activity_id = :activityId OR predecessor_activity_id = :activityId',
          { activityId },
        )
        .execute();
      await this.activityRepo.delete({ id: activityId });
    }

    await this.recalculateSchedule(versionId);
    return { success: true };
  }

  async deleteVersion(projectId: number, versionId: number) {
    // 1. Check Constraint: Cannot delete if a newer version depends on this (parentVersionId = versionId)
    const childVersion = await this.versionRepo.findOne({
      where: { parentVersionId: versionId },
    });
    if (childVersion) {
      throw new NotFoundException(
        `Cannot delete version. A newer revision (${childVersion.versionCode}) depends on it. Delete the newer version first.`,
      );
    }

    const version = await this.versionRepo.findOne({
      where: { id: versionId, projectId },
    });
    if (!version) throw new NotFoundException('Version not found');

    await this.activityVersionRepo.delete({ versionId });
    return this.versionRepo.remove(version);
  }

  async recalculateSchedule(versionId: number) {
    // 1. Get Activities
    const activities = await this.activityVersionRepo.find({
      where: { versionId },
    });
    if (activities.length === 0) return;

    // 2. Get Relationships (Master)
    // Assuming single project.
    const projectId = (
      await this.versionRepo.findOne({ where: { id: versionId } })
    )?.projectId;
    if (!projectId)
      throw new NotFoundException('Project not found for version');

    const relationships = await this.getVersionRelationships(versionId);

    // 3. Run Engine
    // Use earliest start date from activities as project start? Or Project Start Date?
    // Let's assume project start date is implicitly the earliest planned start or today.
    // For accurate forward pass, we need a base date.
    // Let's use the earliest 'startDate' found in the version as the anchor.
    const earliest = activities.reduce((min, av) => {
      const d = av.startDate
        ? new Date(av.startDate).getTime()
        : Number.MAX_SAFE_INTEGER;
      return d < min ? d : min;
    }, Number.MAX_SAFE_INTEGER);

    const projectStart =
      earliest === Number.MAX_SAFE_INTEGER ? new Date() : new Date(earliest);

    const updated = this.engine.calculateCPM(
      activities,
      relationships,
      projectStart,
    );

    // 4. Save
    await this.activityVersionRepo.save(updated);
    return updated;
  }

  async createRevisionWithUpdates(
    projectId: number,
    sourceVersionId: number,
    updates: any[],
    codeInput: string,
  ) {
    const source = await this.versionRepo.findOne({
      where: { id: sourceVersionId },
    });
    if (!source) throw new NotFoundException('Source Version not found');

    // Validation: Actuals Consistency
    // Rule: If source version has Actuals (or if we check against Master Actuals), Import must match.
    // Let's check against imports provided vs current DB state.
    // User said: "check with the previous actual start and actual finishes... if it is not matching it should show the error"

    // Strategy:
    // 1. Fetch Master Activities to get TRUE Actuals (Since ActivityVersion doesn't store Actuals, we rely on Master).
    // 2. Compare 'updates.actualStart' with 'master.startDateActual'.

    const masterActivities = await this.activityRepo.find({
      where: { projectId },
    });
    const masterMap = new Map(masterActivities.map((a) => [a.id, a]));

    const invalidUpdates: string[] = [];

    updates.forEach((u) => {
      const master = masterMap.get(Number(u.activityId));
      if (master) {
        // Check Start
        if (master.startDateActual && u.actualStart) {
          const masterTime = new Date(master.startDateActual).getTime();
          const updateTime = new Date(u.actualStart).getTime();
          // Allow slight diff (milliseconds)?
          if (Math.abs(masterTime - updateTime) > 1000 * 60 * 60 * 24) {
            // > 1 day diff
            invalidUpdates.push(
              `Activity ${master.activityCode}: Imported Actual Start (${u.actualStart}) conflicts with existing Actual Start (${master.startDateActual.toISOString().split('T')[0]})`,
            );
          }
        }
        // Check Finish
        if (master.finishDateActual && u.actualFinish) {
          const masterTime = new Date(master.finishDateActual).getTime();
          const updateTime = new Date(u.actualFinish).getTime();
          if (Math.abs(masterTime - updateTime) > 1000 * 60 * 60 * 24) {
            invalidUpdates.push(
              `Activity ${master.activityCode}: Imported Actual Finish (${u.actualFinish}) conflicts with existing Actual Finish (${master.finishDateActual.toISOString().split('T')[0]})`,
            );
          }
        }
      }
    });

    if (invalidUpdates.length > 0) {
      throw new BadRequestException(
        `Validation Failed: \n${invalidUpdates.join('\n')}`,
      );
    }

    const newCode =
      codeInput === 'Rev' ? `R${source.sequenceNumber + 1}` : codeInput;

    // Use existing createVersion to handle basic structure and cloning
    const newVersion = await this.createVersion(
      projectId,
      newCode,
      ScheduleVersionType.WORKING,
      sourceVersionId,
      'Import',
    );

    // Apply Updates
    const targetActivities = await this.activityVersionRepo.find({
      where: { versionId: newVersion.id },
    });
    const updateMap = new Map(updates.map((u) => [Number(u.activityId), u]));

    const toSave: ActivityVersion[] = [];

    for (const av of targetActivities) {
      const update = updateMap.get(av.activityId);
      if (update) {
        // Planned Dates
        if (update.startDate) av.startDate = new Date(update.startDate);
        if (update.finishDate) av.finishDate = new Date(update.finishDate);
        if (update.remarks) av.remarks = update.remarks;
        toSave.push(av);

        // Note: We do NOT update 'Actuals' on ActivityVersion because it doesn't have them.
        // If user imported NEW actuals (that are not conflict), should we update Master Activity?
        // "if that matches... it should keep that dates also in import"
        // Implies we probably should update Master Actuals if they were empty?
        // For safety, let's ONLY update Master if Master was empty.
        const master = masterMap.get(av.activityId);
        let masterChanged = false;
        if (master) {
          if (!master.startDateActual && update.actualStart) {
            master.startDateActual = new Date(update.actualStart);
            masterChanged = true;
          }
          if (!master.finishDateActual && update.actualFinish) {
            master.finishDateActual = new Date(update.actualFinish);
            masterChanged = true;
          }
          if (masterChanged) {
            await this.activityRepo.save(master);
          }
        }
      }
    }

    if (toSave.length > 0) {
      await this.activityVersionRepo.save(toSave);
    }

    // Trigger Recalculate
    await this.recalculateSchedule(newVersion.id); // Auto-recalc on import?

    return newVersion;
  }

  async compareVersions(baseVersionId: number, compareVersionId: number) {
    // Fetch activities for both versions
    const baseActivities = await this.activityVersionRepo.find({
      where: { versionId: baseVersionId },
      relations: ['activity', 'activity.wbsNode'],
    });

    const compareActivities = await this.activityVersionRepo.find({
      where: { versionId: compareVersionId },
      relations: ['activity', 'activity.wbsNode'],
    });

    // Map Base Activities
    const baseMap = new Map(baseActivities.map((a) => [a.activityId, a]));

    const comparison = compareActivities.map((comp) => {
      const base = baseMap.get(comp.activityId);

      const v1Start = base?.startDate ? new Date(base.startDate) : null;
      const v2Start = comp.startDate ? new Date(comp.startDate) : null;
      const v1Finish = base?.finishDate ? new Date(base.finishDate) : null;
      const v2Finish = comp.finishDate ? new Date(comp.finishDate) : null;

      // Variances (Days)
      let startVariance = 0;
      let finishVariance = 0;

      if (v1Start && v2Start) {
        const diffTime = v2Start.getTime() - v1Start.getTime();
        startVariance = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      if (v1Finish && v2Finish) {
        const diffTime = v2Finish.getTime() - v1Finish.getTime();
        finishVariance = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      return {
        activityId: comp.activityId,
        wbsCode: comp.activity?.wbsNode?.wbsCode,
        activityCode: comp.activity?.activityCode,
        activityName: comp.activity?.activityName,

        baseStart: base?.startDate,
        compareStart: comp.startDate,
        startVariance, // Negative = Early, Positive = Delayed

        baseFinish: base?.finishDate,
        compareFinish: comp.finishDate,
        finishVariance,

        baseDuration: base?.duration,
        compareDuration: comp.duration,
      };
    });

    return comparison;
  }

  async exportVersionAsMsProjectXml(versionId: number) {
    const version = await this.versionRepo.findOne({ where: { id: versionId } });
    if (!version) throw new NotFoundException('Version not found');

    const wbsNodes = await this.wbsRepo.find({
      where: { projectId: version.projectId },
      order: { wbsLevel: 'ASC', sequenceNo: 'ASC', id: 'ASC' },
    });
    const versionActivities = await this.activityVersionRepo.find({
      where: { versionId },
      relations: ['activity', 'activity.wbsNode'],
      order: { id: 'ASC' },
    });
    const relationships = await this.getVersionRelationships(versionId);

    const outlineByWbsId = this.buildWbsOutlineNumbers(wbsNodes);
    const predecessorLinksBySuccessor = new Map<number, any[]>();

    for (const rel of relationships) {
      if (!rel.successor?.id || !rel.predecessor?.id) continue;
      const bucket = predecessorLinksBySuccessor.get(rel.successor.id) || [];
      bucket.push({
        PredecessorUID: rel.predecessor.mspUid || rel.predecessor.id.toString(),
        Type: this.mapRelationshipType(rel.relationshipType),
        LinkLag: this.formatLag(rel.lagDays),
      });
      predecessorLinksBySuccessor.set(rel.successor.id, bucket);
    }

    const tasks: any[] = [];
    for (const node of wbsNodes) {
      const outline = outlineByWbsId.get(node.id);
      if (!outline) continue;
      tasks.push({
        UID: (this.wbsUidPrefix + node.id).toString(),
        ID: outline,
        Name: node.wbsName,
        OutlineNumber: outline,
        OutlineLevel: outline.split('.').length.toString(),
        Summary: '1',
      });
    }

    const activitiesByWbs = new Map<number, ActivityVersion[]>();
    for (const row of versionActivities) {
      const wbsId = row.activity?.wbsNode?.id;
      if (!wbsId) continue;
      const bucket = activitiesByWbs.get(wbsId) || [];
      bucket.push(row);
      activitiesByWbs.set(wbsId, bucket);
    }

    for (const [wbsId, rows] of activitiesByWbs.entries()) {
      const outlinePrefix = outlineByWbsId.get(wbsId);
      if (!outlinePrefix) continue;
      rows.sort((a, b) => {
        const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
        const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
        if (dateA !== dateB) return dateA - dateB;
        return (a.activity?.id || 0) - (b.activity?.id || 0);
      });

      rows.forEach((row, index) => {
        const activity = row.activity;
        if (!activity) return;
        if (!activity.mspUid) {
          activity.mspUid = activity.id.toString();
        }

        const outline = `${outlinePrefix}.${index + 1}`;
        const task: any = {
          UID: activity.mspUid,
          ID: outline,
          Name: activity.activityName,
          OutlineNumber: outline,
          OutlineLevel: outline.split('.').length.toString(),
          Start: row.startDate ? new Date(row.startDate).toISOString() : undefined,
          Finish: row.finishDate
            ? new Date(row.finishDate).toISOString()
            : undefined,
          Duration: this.formatDuration(Number(row.duration || 0)),
          Milestone: activity.isMilestone ? '1' : '0',
        };

        const links = predecessorLinksBySuccessor.get(activity.id);
        if (links?.length) {
          task.PredecessorLink = links;
        }
        tasks.push(task);
      });
    }

    await this.activityRepo.save(
      versionActivities
        .map((row) => row.activity)
        .filter((activity): activity is Activity => Boolean(activity)),
    );

    const builder = new xml2js.Builder({
      headless: true,
      renderOpts: { pretty: true },
    });

    return builder.buildObject({
      Project: {
        Name: `SETU Working Schedule ${version.versionCode}`,
        Tasks: { Task: tasks },
      },
    });
  }
}
