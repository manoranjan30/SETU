import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  ScheduleVersion,
  ScheduleVersionType,
} from './entities/schedule-version.entity';
import { ActivityVersion } from './entities/activity-version.entity';
import { Activity, ActivityStatus } from '../wbs/entities/activity.entity';
import { ActivityRelationship } from '../wbs/entities/activity-relationship.entity';
import { SchedulingEngineService } from './scheduling-engine.service';

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
    private dataSource: DataSource,
    private engine: SchedulingEngineService,
  ) {}

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

    const relationships = await this.relRepo.find({
      where: { projectId },
      relations: ['predecessor', 'successor'],
    });

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
}
