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
var CpmService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CpmService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const activity_entity_1 = require("./entities/activity.entity");
const activity_relationship_entity_1 = require("./entities/activity-relationship.entity");
const activity_schedule_entity_1 = require("./entities/activity-schedule.entity");
const wbs_entity_1 = require("./entities/wbs.entity");
const project_profile_entity_1 = require("../eps/project-profile.entity");
const work_calendar_entity_1 = require("./entities/work-calendar.entity");
const work_week_entity_1 = require("./entities/work-week.entity");
let CpmService = CpmService_1 = class CpmService {
    activityRepo;
    scheduleRepo;
    relationshipRepo;
    wbsRepo;
    projectProfileRepo;
    calendarRepo;
    workWeekRepo;
    dataSource;
    logger = new common_1.Logger(CpmService_1.name);
    constructor(activityRepo, scheduleRepo, relationshipRepo, wbsRepo, projectProfileRepo, calendarRepo, workWeekRepo, dataSource) {
        this.activityRepo = activityRepo;
        this.scheduleRepo = scheduleRepo;
        this.relationshipRepo = relationshipRepo;
        this.wbsRepo = wbsRepo;
        this.projectProfileRepo = projectProfileRepo;
        this.calendarRepo = calendarRepo;
        this.workWeekRepo = workWeekRepo;
        this.dataSource = dataSource;
    }
    async calculateSchedule(projectId) {
        this.logger.log(`Starting CPM Calculation for Project ${projectId}`);
        const start = Date.now();
        const activities = await this.activityRepo.find({ where: { projectId } });
        const relationships = await this.relationshipRepo.find({
            where: { projectId },
            relations: ['predecessor', 'successor'],
        });
        const projectProfile = await this.projectProfileRepo.findOne({
            where: { epsNode: { id: projectId } },
        });
        if (!activities.length)
            return;
        const graph = this.buildGraph(activities, relationships);
        const scheduleMap = new Map();
        activities.forEach((a) => scheduleMap.set(a.id, {
            earlyStart: undefined,
            earlyFinish: undefined,
            lateStart: undefined,
            lateFinish: undefined,
            totalFloat: 0,
            freeFloat: 0,
            isCritical: false,
        }));
        const { adj, revAdj } = graph;
        try {
            let projectStart;
            if (projectProfile?.plannedStartDate) {
                projectStart = new Date(projectProfile.plannedStartDate);
            }
            else {
                let minStart = null;
                for (const a of activities) {
                    if (a.startDatePlanned) {
                        const d = new Date(a.startDatePlanned);
                        if (!minStart || d < minStart)
                            minStart = d;
                    }
                }
                projectStart = minStart || new Date();
            }
            const calendar = await this.getProjectCalendar(projectId);
            this.calculateDates(activities, adj, revAdj, scheduleMap, projectStart, calendar);
            await this.saveSchedule(scheduleMap);
            await this.calculateSummaryRollup(projectId, activities, scheduleMap);
        }
        catch (e) {
            this.logger.error(`CPM Calculation Failed: ${e.message}`, e.stack);
        }
        this.logger.log(`CPM Calculation completed in ${Date.now() - start}ms`);
    }
    buildGraph(activities, relationships) {
        const adj = new Map();
        const revAdj = new Map();
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
    normalizeDate(date) {
        if (!date)
            return undefined;
        const d = new Date(date);
        if (isNaN(d.getTime()))
            return undefined;
        d.setHours(12, 0, 0, 0);
        return d;
    }
    async getProjectCalendar(projectId) {
        const project = await this.projectProfileRepo.findOne({
            where: { epsNode: { id: projectId } },
            relations: ['calendar'],
        });
        let cal = null;
        if (project && project.calendar) {
            cal = project.calendar;
        }
        else {
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
                holidays: new Set(),
                workWeeks: [],
            };
        }
        const wd = new Set();
        if (Array.isArray(cal.workingDays)) {
            cal.workingDays.forEach((d) => wd.add(parseInt(d)));
        }
        else if (typeof cal.workingDays === 'string') {
            cal.workingDays
                .split(',')
                .forEach((d) => wd.add(parseInt(d)));
        }
        const h = new Set();
        if (cal.holidays) {
            if (Array.isArray(cal.holidays)) {
                cal.holidays.forEach((d) => h.add(d));
            }
            else if (typeof cal.holidays === 'string') {
                cal.holidays.split(',').forEach((d) => {
                    if (d.trim())
                        h.add(d.trim());
                });
            }
        }
        return {
            workingDays: wd,
            holidays: h,
            workWeeks: cal.workWeeks || [],
        };
    }
    isWorkingDay(date, cal) {
        const dateStr = date.toISOString().split('T')[0];
        if (cal.holidays.has(dateStr))
            return false;
        const day = date.getDay();
        const dTime = date.getTime();
        if (cal.workWeeks && cal.workWeeks.length > 0) {
            const workWeek = cal.workWeeks.find((ww) => {
                if (!ww.fromDate || !ww.toDate)
                    return false;
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
    addWorkingDays(startDate, days, cal) {
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
    getWorkingDuration(start, finish, cal) {
        let count = 0;
        const current = new Date(start);
        const end = new Date(finish);
        current.setHours(12, 0, 0, 0);
        end.setHours(12, 0, 0, 0);
        if (current > end)
            return 0;
        while (current < end) {
            if (this.isWorkingDay(current, cal)) {
                count++;
            }
            current.setDate(current.getDate() + 1);
        }
        return count;
    }
    calculateDates(activities, adj, revAdj, scheduleMap, projectStart, cal) {
        const inDegree = new Map();
        activities.forEach((a) => inDegree.set(a.id, 0));
        revAdj.forEach((rels, id) => {
            inDegree.set(id, rels.length);
        });
        const queue = [];
        inDegree.forEach((degree, id) => {
            if (degree === 0)
                queue.push(id);
        });
        const sortedOrder = [];
        const projectStartDate = this.normalizeDate(projectStart);
        while (queue.length > 0) {
            const u = queue.shift();
            sortedOrder.push(u);
            const sched = scheduleMap.get(u);
            const activity = activities.find((a) => a.id === u);
            if (activity.startDateActual) {
                sched.earlyStart = new Date(activity.startDateActual);
                if (activity.finishDateActual) {
                    sched.earlyFinish = new Date(activity.finishDateActual);
                }
                else {
                    sched.earlyStart = this.addWorkingDays(sched.earlyStart, 0, cal);
                    sched.earlyFinish = this.addWorkingDays(sched.earlyStart, activity.durationPlanned || 0, cal);
                }
            }
            else {
                if (!sched.earlyStart) {
                    let logicStart;
                    const preds = revAdj.get(u) || [];
                    if (preds.length === 0) {
                        logicStart = new Date(projectStartDate);
                    }
                    else {
                        let maxEF = null;
                        preds.forEach((p) => {
                            const predSched = scheduleMap.get(p.predecessor.id);
                            if (predSched?.earlyFinish) {
                                let ef = new Date(predSched.earlyFinish);
                                if (p.lagDays) {
                                    ef = this.addWorkingDays(ef, p.lagDays, cal);
                                }
                                if (!maxEF || ef > maxEF)
                                    maxEF = ef;
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
                sched.earlyFinish = this.addWorkingDays(sched.earlyStart, activity.durationPlanned || 0, cal);
            }
            sched.earlyFinish = this.normalizeDate(sched.earlyFinish);
            const successors = adj.get(u) || [];
            successors.forEach((r) => {
                const v = r.successor.id;
                inDegree.set(v, (inDegree.get(v) || 0) - 1);
                if (inDegree.get(v) === 0)
                    queue.push(v);
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
        projectFinishDate = this.normalizeDate(projectFinishDate);
        for (let i = sortedOrder.length - 1; i >= 0; i--) {
            const u = sortedOrder[i];
            const sched = scheduleMap.get(u);
            const activity = activities.find((a) => a.id === u);
            const succs = adj.get(u) || [];
            if (succs.length === 0) {
                sched.lateFinish = new Date(projectFinishDate);
            }
            else {
                let minLS = null;
                succs.forEach((s) => {
                    const succSched = scheduleMap.get(s.successor.id);
                    if (succSched?.lateStart) {
                        let ls = new Date(succSched.lateStart);
                        if (s.lagDays) {
                            ls = this.addWorkingDays(ls, -s.lagDays, cal);
                        }
                        if (!minLS || ls < minLS)
                            minLS = ls;
                    }
                });
                sched.lateFinish = minLS
                    ? new Date(minLS)
                    : new Date(projectFinishDate);
            }
            sched.lateFinish = this.normalizeDate(sched.lateFinish);
            if (sched.lateFinish) {
                sched.lateStart = this.addWorkingDays(sched.lateFinish, -(activity.durationPlanned || 0), cal);
                sched.lateStart = this.normalizeDate(sched.lateStart);
            }
            if (sched.lateStart && sched.earlyStart) {
                sched.totalFloat = this.getWorkingDuration(sched.earlyStart, sched.lateStart, cal);
            }
            else {
                sched.totalFloat = 0;
            }
            if (sched.earlyFinish) {
                if (succs.length === 0) {
                    sched.freeFloat = 0;
                }
                else {
                    let minSuccES = null;
                    for (const s of succs) {
                        const succSched = scheduleMap.get(s.successor.id);
                        if (succSched?.earlyStart) {
                            if (!minSuccES || succSched.earlyStart < minSuccES)
                                minSuccES = succSched.earlyStart;
                        }
                    }
                    if (minSuccES) {
                        sched.freeFloat = this.getWorkingDuration(sched.earlyFinish, minSuccES, cal);
                    }
                    else {
                        sched.freeFloat = 0;
                    }
                }
            }
            sched.isCritical = (sched.totalFloat || 0) <= 0;
        }
    }
    async saveSchedule(scheduleMap) {
        const updates = [];
        for (const [activityId, data] of scheduleMap.entries()) {
            let schedule = await this.scheduleRepo.findOne({
                where: { activity: { id: activityId } },
            });
            if (!schedule) {
                schedule = this.scheduleRepo.create({
                    activity: { id: activityId },
                    activityId: activityId,
                });
            }
            else {
                schedule.activityId = activityId;
            }
            schedule.earlyStart = data.earlyStart;
            schedule.earlyFinish = data.earlyFinish;
            schedule.lateStart = data.lateStart;
            schedule.lateFinish = data.lateFinish;
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
    async triggerWbsRollup(projectId) {
        const activities = await this.activityRepo.find({ where: { projectId } });
        const schedules = await this.scheduleRepo.find({
            where: { activityId: (0, typeorm_2.In)(activities.map((a) => a.id)) },
        });
        const scheduleMap = new Map();
        schedules.forEach((s) => scheduleMap.set(s.activityId, s));
        await this.calculateSummaryRollup(projectId, activities, scheduleMap);
    }
    async calculateSummaryRollup(projectId, activities, scheduleMap) {
        const wbsNodes = await this.wbsRepo.find({
            where: { projectId },
            order: { wbsLevel: 'DESC' },
        });
        const cal = await this.getProjectCalendar(projectId);
        const wbsDates = new Map();
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
            if (!sched || !a.wbsNode)
                return;
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
            const dates = wbsDates.get(wbsId);
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
                if (!dates.startActual || d < dates.startActual)
                    dates.startActual = d;
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
                const parentDates = wbsDates.get(node.parentId);
                if (myDates.start) {
                    if (!parentDates.start || myDates.start < parentDates.start)
                        parentDates.start = myDates.start;
                }
                if (myDates.finish) {
                    if (!parentDates.finish || myDates.finish > parentDates.finish)
                        parentDates.finish = myDates.finish;
                }
                if (myDates.startActual) {
                    if (!parentDates.startActual ||
                        myDates.startActual < parentDates.startActual)
                        parentDates.startActual = myDates.startActual;
                }
                if (myDates.finishActual) {
                    if (!parentDates.finishActual ||
                        myDates.finishActual > parentDates.finishActual)
                        parentDates.finishActual = myDates.finishActual;
                }
                if (myDates.startBaseline) {
                    if (!parentDates.startBaseline ||
                        myDates.startBaseline < parentDates.startBaseline)
                        parentDates.startBaseline = myDates.startBaseline;
                }
                if (myDates.finishBaseline) {
                    if (!parentDates.finishBaseline ||
                        myDates.finishBaseline > parentDates.finishBaseline)
                        parentDates.finishBaseline = myDates.finishBaseline;
                }
                if (myDates.startPlanned) {
                    if (!parentDates.startPlanned ||
                        myDates.startPlanned < parentDates.startPlanned)
                        parentDates.startPlanned = myDates.startPlanned;
                }
                if (myDates.finishPlanned) {
                    if (!parentDates.finishPlanned ||
                        myDates.finishPlanned > parentDates.finishPlanned)
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
            }
            else {
                node.percentComplete = 0;
            }
            if (node.startDate && node.finishDate) {
                node.duration = this.getWorkingDuration(node.startDate, node.finishDate, cal);
            }
            else {
                node.duration = 0;
            }
            await this.wbsRepo.save(node);
        }
        this.logger.log(`Summary Rollup completed for ${wbsNodes.length} nodes.`);
    }
    async repairDurations(projectId) {
        this.logger.log(`Reparing Durations for Project ${projectId}`);
        const activities = await this.activityRepo.find({ where: { projectId } });
        const cal = await this.getProjectCalendar(projectId);
        const updates = [];
        for (const act of activities) {
            if (act.startDatePlanned && act.finishDatePlanned) {
                const start = this.normalizeDate(act.startDatePlanned);
                const finish = this.normalizeDate(act.finishDatePlanned);
                if (start && finish) {
                    const inclusiveFinish = new Date(finish);
                    inclusiveFinish.setDate(inclusiveFinish.getDate() + 1);
                    const newDuration = this.getWorkingDuration(start, inclusiveFinish, cal);
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
    async rescheduleProject(projectId) {
        this.logger.log(`Rescheduling Project ${projectId}...`);
        const activities = await this.activityRepo.find({
            where: { projectId },
            relations: ['schedule'],
        });
        const updates = [];
        for (const act of activities) {
            const sched = act.schedule;
            if (!sched)
                continue;
            const isSameDate = (d1, d2) => {
                if (!d1 && !d2)
                    return true;
                if (!d1 || !d2)
                    return false;
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
            if (changed)
                updates.push(act);
        }
        if (updates.length > 0) {
            await this.activityRepo.save(updates);
            await this.triggerWbsRollup(projectId);
        }
    }
    async getProjectSchedule(projectId) {
        const activities = await this.activityRepo.find({
            where: { projectId },
            relations: ['schedule', 'wbsNode'],
            order: { wbsNode: { wbsCode: 'ASC' }, activityCode: 'ASC' },
        });
        const relationships = await this.relationshipRepo.find({
            where: { projectId },
            relations: ['predecessor', 'successor'],
        });
        return { activities, relationships };
    }
};
exports.CpmService = CpmService;
exports.CpmService = CpmService = CpmService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(activity_entity_1.Activity)),
    __param(1, (0, typeorm_1.InjectRepository)(activity_schedule_entity_1.ActivitySchedule)),
    __param(2, (0, typeorm_1.InjectRepository)(activity_relationship_entity_1.ActivityRelationship)),
    __param(3, (0, typeorm_1.InjectRepository)(wbs_entity_1.WbsNode)),
    __param(4, (0, typeorm_1.InjectRepository)(project_profile_entity_1.ProjectProfile)),
    __param(5, (0, typeorm_1.InjectRepository)(work_calendar_entity_1.WorkCalendar)),
    __param(6, (0, typeorm_1.InjectRepository)(work_week_entity_1.WorkWeek)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource])
], CpmService);
//# sourceMappingURL=cpm.service.js.map