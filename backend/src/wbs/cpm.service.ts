import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import {
  Activity,
  ActivityStatus,
  ActivityType,
} from './entities/activity.entity';
import {
  ActivityRelationship,
  RelationshipType,
} from './entities/activity-relationship.entity';
import { ActivitySchedule } from './entities/activity-schedule.entity';
import { WbsNode } from './entities/wbs.entity';
import { ProjectProfile } from '../eps/project-profile.entity';
import { WorkCalendar } from './entities/work-calendar.entity';
import { WorkWeek } from './entities/work-week.entity';

@Injectable()
export class CpmService {
  private readonly logger = new Logger(CpmService.name);

  constructor(
    @InjectRepository(Activity)
    private activityRepo: Repository<Activity>,
    @InjectRepository(ActivitySchedule)
    private scheduleRepo: Repository<ActivitySchedule>,
    @InjectRepository(ActivityRelationship)
    private relationshipRepo: Repository<ActivityRelationship>,
    @InjectRepository(WbsNode)
    private wbsRepo: Repository<WbsNode>,
    @InjectRepository(ProjectProfile)
    private projectProfileRepo: Repository<ProjectProfile>,
    @InjectRepository(WorkCalendar)
    private calendarRepo: Repository<WorkCalendar>,
    @InjectRepository(WorkWeek)
    private workWeekRepo: Repository<WorkWeek>,
    private dataSource: DataSource,
  ) { }

  async calculateSchedule(projectId: number): Promise<void> {
    this.logger.log(`Starting CPM Calculation for Project ${projectId}`);
    const start = Date.now();

    // 1. Fetch all data
    const activities = await this.activityRepo.find({ where: { projectId } });
    const relationships = await this.relationshipRepo.find({
      where: { projectId },
      relations: ['predecessor', 'successor'],
    });
    const projectProfile = await this.projectProfileRepo.findOne({
      where: { epsNode: { id: projectId } },
    });

    if (!activities.length) return;

    // 2. Build Graph
    const graph = this.buildGraph(activities, relationships);

    // 3. Reset Schedule Data
    const scheduleMap = new Map<number, Partial<ActivitySchedule>>();
    activities.forEach((a) =>
      scheduleMap.set(a.id, {
        earlyStart: undefined,
        earlyFinish: undefined,
        lateStart: undefined,
        lateFinish: undefined,
        totalFloat: 0,
        freeFloat: 0,
        isCritical: false,
      }),
    );

    // 4. Backward Pass & Forward Pass
    const { adj, revAdj } = graph;
    try {
      // Determine Project Start Date
      let projectStart: Date;
      if (projectProfile?.plannedStartDate) {
        projectStart = new Date(projectProfile.plannedStartDate);
      } else {
        let minStart: Date | null = null;
        for (const a of activities) {
          if (a.startDatePlanned) {
            const d = new Date(a.startDatePlanned);
            if (!minStart || d < minStart) minStart = d;
          }
        }
        projectStart = minStart || new Date();
      }

      // Fetch Calendar
      const calendar = await this.getProjectCalendar(projectId);

      this.calculateDates(
        activities,
        adj,
        revAdj,
        scheduleMap,
        projectStart,
        calendar,
      );

      // Save Results
      await this.saveSchedule(scheduleMap);

      // Rollup
      await this.calculateSummaryRollup(projectId, activities, scheduleMap);
    } catch (e) {
      this.logger.error(`CPM Calculation Failed: ${e.message}`, e.stack);
    }

    this.logger.log(`CPM Calculation completed in ${Date.now() - start}ms`);
  }

  private buildGraph(
    activities: Activity[],
    relationships: ActivityRelationship[],
  ) {
    const adj = new Map<number, ActivityRelationship[]>();
    const revAdj = new Map<number, ActivityRelationship[]>();

    activities.forEach((a) => {
      adj.set(a.id, []);
      revAdj.set(a.id, []);
    });

    relationships.forEach((r) => {
      adj.get(r.predecessor.id)?.push(r);
      revAdj.get(r.successor.id)?.push(r);
    });

    return { adj, revAdj };
  }

  private normalizeDate(date: Date | null | undefined): Date | undefined {
    if (!date) return undefined;
    const d = new Date(date);
    if (isNaN(d.getTime())) return undefined;
    d.setHours(12, 0, 0, 0);
    return d;
  }

  private async getProjectCalendar(projectId: number) {
    const project = await this.projectProfileRepo.findOne({
      where: { epsNode: { id: projectId } },
      relations: ['calendar'],
    });

    let cal: WorkCalendar | null = null;
    if (project && project.calendar) {
      cal = project.calendar;
    } else {
      cal = await this.calendarRepo.findOne({ where: { isDefault: true } });
    }

    if (cal) {
      const workWeeks = await this.workWeekRepo.find({
        where: { calendar: { id: cal.id } },
      });
      cal.workWeeks = workWeeks;
    }

    if (!cal) {
      return {
        workingDays: new Set([1, 2, 3, 4, 5]),
        holidays: new Set<string>(),
        workWeeks: [] as WorkWeek[],
      };
    }

    const wd = new Set<number>();
    if (Array.isArray(cal.workingDays)) {
      cal.workingDays.forEach((d) => wd.add(parseInt(d)));
    } else if (typeof cal.workingDays === 'string') {
      (cal.workingDays as string)
        .split(',')
        .forEach((d) => wd.add(parseInt(d)));
    }

    const h = new Set<string>();
    if (cal.holidays) {
      if (Array.isArray(cal.holidays)) {
        cal.holidays.forEach((d) => h.add(d));
      } else if (typeof cal.holidays === 'string') {
        (cal.holidays as string).split(',').forEach((d) => {
          if (d.trim()) h.add(d.trim());
        });
      }
    }

    return {
      workingDays: wd,
      holidays: h,
      workWeeks: cal.workWeeks || [],
    };
  }

  private isWorkingDay(
    date: Date,
    cal: {
      workingDays: Set<number>;
      holidays: Set<string>;
      workWeeks: WorkWeek[];
    },
  ): boolean {
    const dateStr = date.toISOString().split('T')[0];
    if (cal.holidays.has(dateStr)) return false;

    const day = date.getDay();
    const dTime = date.getTime();

    if (cal.workWeeks && cal.workWeeks.length > 0) {
      const workWeek = cal.workWeeks.find((ww) => {
        if (!ww.fromDate || !ww.toDate) return false;
        const fromTime = new Date(ww.fromDate).getTime();
        const toTime = new Date(ww.toDate).getTime();
        return dTime >= fromTime && dTime <= toTime;
      });
      if (workWeek) {
        return workWeek.workingDays.includes(day.toString());
      }
    }

    return cal.workingDays.has(day);
  }

  private addWorkingDays(
    startDate: Date,
    days: number,
    cal: {
      workingDays: Set<number>;
      holidays: Set<string>;
      workWeeks: WorkWeek[];
    },
  ): Date {
    const currentDate = new Date(startDate);
    let remaining = Math.abs(days);
    const direction = days >= 0 ? 1 : -1;

    while (!this.isWorkingDay(currentDate, cal)) {
      currentDate.setDate(currentDate.getDate() + direction);
    }

    while (remaining > 0) {
      currentDate.setDate(currentDate.getDate() + direction);
      if (this.isWorkingDay(currentDate, cal)) {
        remaining--;
      }
    }

    return currentDate;
  }

  private getWorkingDuration(
    start: Date,
    finish: Date,
    cal: {
      workingDays: Set<number>;
      holidays: Set<string>;
      workWeeks: WorkWeek[];
    },
  ): number {
    let count = 0;
    const current = new Date(start);
    const end = new Date(finish);
    current.setHours(12, 0, 0, 0);
    end.setHours(12, 0, 0, 0);

    if (current > end) return 0;

    while (current < end) {
      if (this.isWorkingDay(current, cal)) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  }

  private calculateDates(
    activities: Activity[],
    adj: Map<number, ActivityRelationship[]>,
    revAdj: Map<number, ActivityRelationship[]>,
    scheduleMap: Map<number, Partial<ActivitySchedule>>,
    projectStart: Date,
    cal: {
      workingDays: Set<number>;
      holidays: Set<string>;
      workWeeks: WorkWeek[];
    },
  ) {
    const inDegree = new Map<number, number>();
    activities.forEach((a) => inDegree.set(a.id, 0));

    revAdj.forEach((rels, id) => {
      inDegree.set(id, rels.length);
    });

    const queue: number[] = [];
    inDegree.forEach((degree, id) => {
      if (degree === 0) queue.push(id);
    });

    const sortedOrder: number[] = [];
    const projectStartDate = this.normalizeDate(projectStart)!;

    while (queue.length > 0) {
      const u = queue.shift()!;
      sortedOrder.push(u);

      const sched = scheduleMap.get(u)!;
      const activity = activities.find((a) => a.id === u)!;

      if (activity.startDateActual) {
        sched.earlyStart = new Date(activity.startDateActual);
        if (activity.finishDateActual) {
          sched.earlyFinish = new Date(activity.finishDateActual);
        } else {
          sched.earlyStart = this.addWorkingDays(sched.earlyStart, 0, cal);
          sched.earlyFinish = this.addWorkingDays(
            sched.earlyStart,
            activity.durationPlanned || 0,
            cal,
          );
        }
      } else {
        if (!sched.earlyStart) {
          let logicStart: Date;
          const preds = revAdj.get(u) || [];
          if (preds.length === 0) {
            logicStart = new Date(projectStartDate);
          } else {
            let maxEF: Date | null = null;
            preds.forEach((p) => {
              const predSched = scheduleMap.get(p.predecessor.id);
              if (predSched?.earlyFinish) {
                let ef = new Date(predSched.earlyFinish);
                if (p.lagDays) {
                  ef = this.addWorkingDays(ef, p.lagDays, cal);
                }
                if (!maxEF || ef > maxEF) maxEF = ef;
              }
            });
            logicStart = maxEF ? new Date(maxEF) : new Date(projectStartDate);
          }

          logicStart = this.addWorkingDays(logicStart, 0, cal);

          if (activity.startDatePlanned) {
            const plannedStart = this.normalizeDate(activity.startDatePlanned);
            if (plannedStart && plannedStart > logicStart) {
              logicStart = plannedStart;
              logicStart = this.addWorkingDays(logicStart, 0, cal);
            }
          }
          sched.earlyStart = logicStart;
        }
      }

      sched.earlyStart = this.normalizeDate(sched.earlyStart);
      if (!sched.earlyFinish && sched.earlyStart) {
        sched.earlyFinish = this.addWorkingDays(
          sched.earlyStart,
          activity.durationPlanned || 0,
          cal,
        );
      }
      sched.earlyFinish = this.normalizeDate(sched.earlyFinish);

      const successors = adj.get(u) || [];
      successors.forEach((r) => {
        const v = r.successor.id;
        inDegree.set(v, (inDegree.get(v) || 0) - 1);
        if (inDegree.get(v) === 0) queue.push(v);
      });
    }

    if (sortedOrder.length !== activities.length) {
      throw new Error('Cyclic dependency detected in project schedule.');
    }

    let projectFinishDate = new Date(0);
    activities.forEach((a) => {
      const s = scheduleMap.get(a.id);
      if (s?.earlyFinish && s.earlyFinish > projectFinishDate) {
        projectFinishDate = s.earlyFinish;
      }
    });

    if (projectFinishDate.getTime() === 0 && activities.length > 0) {
      projectFinishDate = new Date(projectStartDate);
    }
    projectFinishDate = this.normalizeDate(projectFinishDate)!;

    for (let i = sortedOrder.length - 1; i >= 0; i--) {
      const u = sortedOrder[i];
      const sched = scheduleMap.get(u)!;
      const activity = activities.find((a) => a.id === u)!;

      const succs = adj.get(u) || [];
      if (succs.length === 0) {
        sched.lateFinish = new Date(projectFinishDate);
      } else {
        let minLS: Date | null = null;
        succs.forEach((s) => {
          const succSched = scheduleMap.get(s.successor.id);
          if (succSched?.lateStart) {
            let ls = new Date(succSched.lateStart);
            if (s.lagDays) {
              ls = this.addWorkingDays(ls, -s.lagDays, cal);
            }
            if (!minLS || ls < minLS) minLS = ls;
          }
        });
        sched.lateFinish = minLS
          ? new Date(minLS)
          : new Date(projectFinishDate);
      }

      sched.lateFinish = this.normalizeDate(sched.lateFinish);
      if (sched.lateFinish) {
        sched.lateStart = this.addWorkingDays(
          sched.lateFinish,
          -(activity.durationPlanned || 0),
          cal,
        );
        sched.lateStart = this.normalizeDate(sched.lateStart);
      }

      if (sched.lateStart && sched.earlyStart) {
        sched.totalFloat = this.getWorkingDuration(
          sched.earlyStart,
          sched.lateStart,
          cal,
        );
      } else {
        sched.totalFloat = 0;
      }

      if (sched.earlyFinish) {
        if (succs.length === 0) {
          sched.freeFloat = 0;
        } else {
          let minSuccES: Date | null = null;
          for (const s of succs) {
            const succSched = scheduleMap.get(s.successor.id);
            if (succSched?.earlyStart) {
              if (!minSuccES || succSched.earlyStart < minSuccES)
                minSuccES = succSched.earlyStart;
            }
          }
          if (minSuccES) {
            sched.freeFloat = this.getWorkingDuration(
              sched.earlyFinish,
              minSuccES,
              cal,
            );
          } else {
            sched.freeFloat = 0;
          }
        }
      }
      sched.isCritical = (sched.totalFloat || 0) <= 0;
    }
  }

  private async saveSchedule(
    scheduleMap: Map<number, Partial<ActivitySchedule>>,
  ) {
    const updates: ActivitySchedule[] = [];
    for (const [activityId, data] of scheduleMap.entries()) {
      let schedule = await this.scheduleRepo.findOne({
        where: { activity: { id: activityId } },
      });
      if (!schedule) {
        schedule = this.scheduleRepo.create({
          activity: { id: activityId } as Activity,
          activityId: activityId,
        });
      } else {
        schedule.activityId = activityId;
      }

      schedule.earlyStart = data.earlyStart!;
      schedule.earlyFinish = data.earlyFinish!;
      schedule.lateStart = data.lateStart!;
      schedule.lateFinish = data.lateFinish!;
      schedule.totalFloat = data.totalFloat || 0;
      schedule.freeFloat = data.freeFloat || 0;
      schedule.isCritical = data.isCritical || false;
      schedule.calculatedOn = new Date();
      updates.push(schedule);
    }

    if (updates.length > 0) {
      await this.scheduleRepo.save(updates);
    }
  }

  public async triggerWbsRollup(projectId: number) {
    const activities = await this.activityRepo.find({ where: { projectId } });
    const schedules = await this.scheduleRepo.find({
      where: { activityId: In(activities.map((a) => a.id)) },
    });
    const scheduleMap = new Map<number, Partial<ActivitySchedule>>();
    schedules.forEach((s) => scheduleMap.set(s.activityId, s));
    await this.calculateSummaryRollup(projectId, activities, scheduleMap);
  }

  private async calculateSummaryRollup(
    projectId: number,
    activities: Activity[],
    scheduleMap: Map<number, Partial<ActivitySchedule>>,
  ) {
    const wbsNodes = await this.wbsRepo.find({
      where: { projectId },
      order: { wbsLevel: 'DESC' },
    });
    const cal = await this.getProjectCalendar(projectId);

    const wbsDates = new Map<
      number,
      {
        start: Date | null;
        finish: Date | null;
        startActual: Date | null;
        finishActual: Date | null;
        startBaseline: Date | null;
        finishBaseline: Date | null;
        startPlanned: Date | null;
        finishPlanned: Date | null;
        budgetedValue: number;
        actualValue: number;
        totalEarned: number;
        totalPlanned: number;
      }
    >();

    const activitiesWithWbs = await this.activityRepo.find({
      where: { projectId },
      relations: ['wbsNode'],
      select: {
        id: true,
        durationPlanned: true,
        startDateActual: true,
        finishDateActual: true,
        startDateBaseline: true,
        finishDateBaseline: true,
        startDatePlanned: true,
        finishDatePlanned: true,
        percentComplete: true,
        budgetedValue: true,
        actualValue: true,
        wbsNode: { id: true },
      },
    });

    activitiesWithWbs.forEach((a) => {
      const sched = scheduleMap.get(a.id);
      if (!sched || !a.wbsNode) return;
      const wbsId = a.wbsNode.id;

      if (!wbsDates.has(wbsId))
        wbsDates.set(wbsId, {
          start: null,
          finish: null,
          startActual: null,
          finishActual: null,
          startBaseline: null,
          finishBaseline: null,
          startPlanned: null,
          finishPlanned: null,
          budgetedValue: 0,
          actualValue: 0,
          totalEarned: 0,
          totalPlanned: 0,
        });
      const dates = wbsDates.get(wbsId)!;

      if (sched.earlyStart) {
        if (!dates.start || sched.earlyStart < dates.start)
          dates.start = sched.earlyStart;
      }
      if (sched.earlyFinish) {
        if (!dates.finish || sched.earlyFinish > dates.finish)
          dates.finish = sched.earlyFinish;
      }
      if (a.startDateActual) {
        const d = new Date(a.startDateActual);
        if (!dates.startActual || d < dates.startActual) dates.startActual = d;
      }
      if (a.finishDateActual) {
        const d = new Date(a.finishDateActual);
        if (!dates.finishActual || d > dates.finishActual)
          dates.finishActual = d;
      }
      if (a.startDateBaseline) {
        const d = new Date(a.startDateBaseline);
        if (!dates.startBaseline || d < dates.startBaseline)
          dates.startBaseline = d;
      }
      if (a.finishDateBaseline) {
        const d = new Date(a.finishDateBaseline);
        if (!dates.finishBaseline || d > dates.finishBaseline)
          dates.finishBaseline = d;
      }
      if (a.startDatePlanned) {
        const d = new Date(a.startDatePlanned);
        if (!dates.startPlanned || d < dates.startPlanned)
          dates.startPlanned = d;
      }
      if (a.finishDatePlanned) {
        const d = new Date(a.finishDatePlanned);
        if (!dates.finishPlanned || d > dates.finishPlanned)
          dates.finishPlanned = d;
      }

      dates.budgetedValue += Number(a.budgetedValue || 0);
      dates.actualValue += Number(a.actualValue || 0);
      const actPlanned = 1;
      dates.totalPlanned += actPlanned;
      dates.totalEarned += (Number(a.percentComplete || 0) / 100) * actPlanned;
    });

    for (const node of wbsNodes) {
      const myDates = wbsDates.get(node.id) || {
        start: null,
        finish: null,
        startActual: null,
        finishActual: null,
        startBaseline: null,
        finishBaseline: null,
        startPlanned: null,
        finishPlanned: null,
        budgetedValue: 0,
        actualValue: 0,
        totalEarned: 0,
        totalPlanned: 0,
      };

      if (node.parentId) {
        if (!wbsDates.has(node.parentId))
          wbsDates.set(node.parentId, {
            start: null,
            finish: null,
            startActual: null,
            finishActual: null,
            startBaseline: null,
            finishBaseline: null,
            startPlanned: null,
            finishPlanned: null,
            budgetedValue: 0,
            actualValue: 0,
            totalEarned: 0,
            totalPlanned: 0,
          });
        const parentDates = wbsDates.get(node.parentId)!;

        if (myDates.start) {
          if (!parentDates.start || myDates.start < parentDates.start)
            parentDates.start = myDates.start;
        }
        if (myDates.finish) {
          if (!parentDates.finish || myDates.finish > parentDates.finish)
            parentDates.finish = myDates.finish;
        }
        if (myDates.startActual) {
          if (
            !parentDates.startActual ||
            myDates.startActual < parentDates.startActual
          )
            parentDates.startActual = myDates.startActual;
        }
        if (myDates.finishActual) {
          if (
            !parentDates.finishActual ||
            myDates.finishActual > parentDates.finishActual
          )
            parentDates.finishActual = myDates.finishActual;
        }
        if (myDates.startBaseline) {
          if (
            !parentDates.startBaseline ||
            myDates.startBaseline < parentDates.startBaseline
          )
            parentDates.startBaseline = myDates.startBaseline;
        }
        if (myDates.finishBaseline) {
          if (
            !parentDates.finishBaseline ||
            myDates.finishBaseline > parentDates.finishBaseline
          )
            parentDates.finishBaseline = myDates.finishBaseline;
        }
        if (myDates.startPlanned) {
          if (
            !parentDates.startPlanned ||
            myDates.startPlanned < parentDates.startPlanned
          )
            parentDates.startPlanned = myDates.startPlanned;
        }
        if (myDates.finishPlanned) {
          if (
            !parentDates.finishPlanned ||
            myDates.finishPlanned > parentDates.finishPlanned
          )
            parentDates.finishPlanned = myDates.finishPlanned;
        }
        parentDates.budgetedValue += myDates.budgetedValue;
        parentDates.actualValue += myDates.actualValue;
        parentDates.totalEarned += myDates.totalEarned;
        parentDates.totalPlanned += myDates.totalPlanned;
      }

      node.startDate = myDates.start
        ? this.normalizeDate(myDates.start) || null
        : null;
      node.finishDate = myDates.finish
        ? this.normalizeDate(myDates.finish) || null
        : null;
      node.startDateActual = myDates.startActual
        ? this.normalizeDate(myDates.startActual) || null
        : null;
      node.finishDateActual = myDates.finishActual
        ? this.normalizeDate(myDates.finishActual) || null
        : null;
      node.startDateBaseline = myDates.startBaseline
        ? this.normalizeDate(myDates.startBaseline) || null
        : null;
      node.finishDateBaseline = myDates.finishBaseline
        ? this.normalizeDate(myDates.finishBaseline) || null
        : null;
      node.startDatePlanned = myDates.startPlanned
        ? this.normalizeDate(myDates.startPlanned) || null
        : null;
      node.finishDatePlanned = myDates.finishPlanned
        ? this.normalizeDate(myDates.finishPlanned) || null
        : null;

      node.budgetedValue = Number(myDates.budgetedValue.toFixed(2));
      node.actualValue = Number(myDates.actualValue.toFixed(2));

      if (myDates.totalPlanned > 0) {
        node.percentComplete =
          (myDates.totalEarned / myDates.totalPlanned) * 100;
      } else {
        node.percentComplete = 0;
      }

      if (node.startDate && node.finishDate) {
        node.duration = this.getWorkingDuration(
          node.startDate,
          node.finishDate,
          cal,
        );
      } else {
        node.duration = 0;
      }

      await this.wbsRepo.save(node);
    }
    this.logger.log(`Summary Rollup completed for ${wbsNodes.length} nodes.`);
  }

  async repairDurations(projectId: number): Promise<void> {
    this.logger.log(`Reparing Durations for Project ${projectId}`);
    const activities = await this.activityRepo.find({ where: { projectId } });
    const cal = await this.getProjectCalendar(projectId);
    const updates: Activity[] = [];

    for (const act of activities) {
      if (act.startDatePlanned && act.finishDatePlanned) {
        const start = this.normalizeDate(act.startDatePlanned);
        const finish = this.normalizeDate(act.finishDatePlanned);
        if (start && finish) {
          const inclusiveFinish = new Date(finish);
          inclusiveFinish.setDate(inclusiveFinish.getDate() + 1);
          const newDuration = this.getWorkingDuration(
            start,
            inclusiveFinish,
            cal,
          );
          if (act.durationPlanned !== newDuration) {
            act.durationPlanned = newDuration;
            updates.push(act);
          }
        }
      }
    }

    if (updates.length > 0) {
      await this.activityRepo.save(updates);
      await this.calculateSchedule(projectId);
    }
  }

  async rescheduleProject(projectId: number): Promise<void> {
    this.logger.log(`Rescheduling Project ${projectId}...`);
    const activities = await this.activityRepo.find({
      where: { projectId },
      relations: ['schedule'],
    });

    const updates: Activity[] = [];

    for (const act of activities) {
      const sched = act.schedule;
      if (!sched) continue;

      const isSameDate = (
        d1: Date | null | undefined,
        d2: Date | null | undefined,
      ) => {
        if (!d1 && !d2) return true;
        if (!d1 || !d2) return false;
        return new Date(d1).getTime() === new Date(d2).getTime();
      };

      let changed = false;
      if (!isSameDate(act.startDatePlanned, sched.earlyStart)) {
        act.startDatePlanned = sched.earlyStart
          ? new Date(sched.earlyStart)
          : null;
        changed = true;
      }
      if (!isSameDate(act.finishDatePlanned, sched.earlyFinish)) {
        act.finishDatePlanned = sched.earlyFinish
          ? new Date(sched.earlyFinish)
          : null;
        changed = true;
      }

      if (changed) updates.push(act);
    }

    if (updates.length > 0) {
      await this.activityRepo.save(updates);
      await this.triggerWbsRollup(projectId);
    }
  }

  async getProjectSchedule(projectId: number) {
    const activities = await this.activityRepo.find({
      where: { projectId },
      relations: ['schedule', 'wbsNode'],
      order: { activityCode: 'ASC' },
    });

    const relationships = await this.relationshipRepo.find({
      where: { projectId },
      relations: ['predecessor', 'successor'],
    });

    return { activities, relationships };
  }
}
