"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduleImportService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const activity_entity_1 = require("./entities/activity.entity");
const activity_relationship_entity_1 = require("./entities/activity-relationship.entity");
const wbs_entity_1 = require("./entities/wbs.entity");
const work_calendar_entity_1 = require("./entities/work-calendar.entity");
const work_week_entity_1 = require("./entities/work-week.entity");
const project_profile_entity_1 = require("../eps/project-profile.entity");
const xml2js = __importStar(require("xml2js"));
let ScheduleImportService = class ScheduleImportService {
    activityRepo;
    relationshipRepo;
    wbsRepo;
    calendarRepo;
    projectProfileRepo;
    constructor(activityRepo, relationshipRepo, wbsRepo, calendarRepo, projectProfileRepo) {
        this.activityRepo = activityRepo;
        this.relationshipRepo = relationshipRepo;
        this.wbsRepo = wbsRepo;
        this.calendarRepo = calendarRepo;
        this.projectProfileRepo = projectProfileRepo;
    }
    async importMsProject(projectId, fileBuffer) {
        const xmlContent = fileBuffer.toString('utf-8');
        const parser = new xml2js.Parser({
            explicitArray: false,
            ignoreAttrs: true,
        });
        return this.wbsRepo.manager.transaction(async (manager) => {
            try {
                const result = await parser.parseStringPromise(xmlContent);
                const project = result.Project;
                if (!project || !project.Tasks || !project.Tasks.Task) {
                    throw new common_1.BadRequestException('Invalid MS Project XML format');
                }
                try {
                    const calendars = project.Calendars?.Calendar;
                    if (calendars) {
                        const calList = Array.isArray(calendars) ? calendars : [calendars];
                        const projectCalUid = project.CalendarUID;
                        let targetCal = calList.find((c) => c.UID === projectCalUid);
                        if (!targetCal)
                            targetCal = calList.find((c) => c.IsBaseCalendar === '1');
                        if (!targetCal && calList.length > 0) {
                            console.warn('[Import] No Base Calendar found, falling back to first available calendar.');
                            targetCal = calList[0];
                        }
                        if (targetCal) {
                            const workingDaysSet = new Set();
                            if (targetCal.WeekDays && targetCal.WeekDays.WeekDay) {
                                const wds = Array.isArray(targetCal.WeekDays.WeekDay)
                                    ? targetCal.WeekDays.WeekDay
                                    : [targetCal.WeekDays.WeekDay];
                                wds.forEach((wd) => {
                                    if (wd.DayWorking === '1') {
                                        const mspDay = parseInt(wd.DayType);
                                        const setuDay = mspDay - 1;
                                        if (setuDay >= 0 && setuDay <= 6) {
                                            workingDaysSet.add(setuDay.toString());
                                        }
                                    }
                                });
                            }
                            if (workingDaysSet.size === 0) {
                                ['1', '2', '3', '4', '5'].forEach((d) => workingDaysSet.add(d));
                            }
                            const holidays = [];
                            if (targetCal.Exceptions && targetCal.Exceptions.Exception) {
                                const excs = Array.isArray(targetCal.Exceptions.Exception)
                                    ? targetCal.Exceptions.Exception
                                    : [targetCal.Exceptions.Exception];
                                excs.forEach((ex) => {
                                    const parseDate = (d) => (d ? new Date(d) : null);
                                    const isNonWorking = !ex.DayWorking || ex.DayWorking === '0';
                                    if (ex.TimePeriod && isNonWorking) {
                                        const from = parseDate(ex.TimePeriod.FromDate);
                                        const to = parseDate(ex.TimePeriod.ToDate);
                                        if (from && to) {
                                            const curr = new Date(from);
                                            while (curr <= to) {
                                                holidays.push(curr.toISOString().split('T')[0]);
                                                curr.setDate(curr.getDate() + 1);
                                            }
                                        }
                                    }
                                });
                            }
                            const newCal = manager.create(work_calendar_entity_1.WorkCalendar, {
                                name: `Imported - Project ${projectId} (${targetCal.Name || 'Standard'})`,
                                description: `Imported from MSP`,
                                workingDays: Array.from(workingDaysSet),
                                holidays: holidays,
                                isDefault: false,
                                dailyWorkHours: 8,
                            });
                            const savedCal = await manager.save(newCal);
                            if (targetCal.WorkWeeks && targetCal.WorkWeeks.WorkWeek) {
                                const wwList = Array.isArray(targetCal.WorkWeeks.WorkWeek)
                                    ? targetCal.WorkWeeks.WorkWeek
                                    : [targetCal.WorkWeeks.WorkWeek];
                                for (const ww of wwList) {
                                    if (!ww.Name)
                                        continue;
                                    const wwSet = new Set();
                                    if (ww.WeekDays && ww.WeekDays.WeekDay) {
                                        const wds = Array.isArray(ww.WeekDays.WeekDay)
                                            ? ww.WeekDays.WeekDay
                                            : [ww.WeekDays.WeekDay];
                                        wds.forEach((wd) => {
                                            if (wd.DayWorking === '1') {
                                                const mspDay = parseInt(wd.DayType);
                                                const setuDay = mspDay - 1;
                                                if (setuDay >= 0 && setuDay <= 6)
                                                    wwSet.add(setuDay.toString());
                                            }
                                        });
                                    }
                                    const from = ww.TimePeriod?.FromDate
                                        ? new Date(ww.TimePeriod.FromDate)
                                        : null;
                                    const to = ww.TimePeriod?.ToDate
                                        ? new Date(ww.TimePeriod.ToDate)
                                        : null;
                                    if (from && to) {
                                        await manager.save(work_week_entity_1.WorkWeek, {
                                            calendar: savedCal,
                                            name: ww.Name,
                                            fromDate: from,
                                            toDate: to,
                                            workingDays: Array.from(wwSet),
                                        });
                                    }
                                    else if (wwSet.size > 0) {
                                        savedCal.workingDays = Array.from(wwSet);
                                        await manager.save(savedCal);
                                    }
                                }
                            }
                            const profile = await manager.findOne(project_profile_entity_1.ProjectProfile, {
                                where: { epsNode: { id: projectId } },
                            });
                            if (profile) {
                                profile.calendar = savedCal;
                                await manager.save(profile);
                            }
                        }
                        else {
                            console.warn('[Import] No Calendar found in XML. Creating Default.');
                            throw new Error('No Calendar found');
                        }
                    }
                }
                catch (calErr) {
                    console.error('Failed to parse specific calendar, creating Default Fallback...', calErr);
                    const defaultCal = manager.create(work_calendar_entity_1.WorkCalendar, {
                        name: `Imported Default - Project ${projectId}`,
                        description: `Fallback Calendar (Import Failed)`,
                        workingDays: ['1', '2', '3', '4', '5'],
                        holidays: [],
                        isDefault: false,
                        dailyWorkHours: 8,
                    });
                    const savedDefault = await manager.save(defaultCal);
                    const profile = await manager.findOne(project_profile_entity_1.ProjectProfile, {
                        where: { epsNode: { id: projectId } },
                    });
                    if (profile) {
                        profile.calendar = savedDefault;
                        await manager.save(profile);
                    }
                }
                const tasks = Array.isArray(project.Tasks.Task)
                    ? project.Tasks.Task
                    : [project.Tasks.Task];
                tasks.sort((a, b) => {
                    const levelA = a.OutlineNumber ? a.OutlineNumber.toString() : '';
                    const levelB = b.OutlineNumber ? b.OutlineNumber.toString() : '';
                    return levelA.localeCompare(levelB, undefined, {
                        numeric: true,
                        sensitivity: 'base',
                    });
                });
                const wbsMap = new Map();
                const uidToActivityId = new Map();
                let count = 0;
                for (const t of tasks) {
                    const outlineNumber = t.OutlineNumber?.toString();
                    if (!outlineNumber)
                        continue;
                    if (count < 5) {
                        console.log('DEBUG: XML Task Preview:', JSON.stringify(t, null, 2));
                    }
                    const uid = t.UID;
                    const name = t.Name;
                    const isSummary = t.Summary === '1';
                    const parts = outlineNumber.split('.');
                    let parentNode = null;
                    if (parts.length > 1) {
                        const parentOutline = parts.slice(0, -1).join('.');
                        parentNode = wbsMap.get(parentOutline) || null;
                    }
                    const wbsCode = outlineNumber;
                    if (isSummary) {
                        const wbsNode = manager.create(wbs_entity_1.WbsNode, {
                            projectId,
                            parentId: parentNode?.id,
                            wbsCode,
                            wbsName: name,
                            isControlAccount: false,
                            wbsLevel: parts.length,
                            sequenceNo: parseInt(parts[parts.length - 1]),
                            createdBy: 'Import',
                        });
                        const savedWbs = await manager.save(wbsNode);
                        wbsMap.set(outlineNumber, savedWbs);
                    }
                    else {
                        try {
                            if (!parentNode) {
                                let rootWbs = wbsMap.get('ROOT');
                                if (!rootWbs) {
                                    rootWbs = await manager.save(manager.create(wbs_entity_1.WbsNode, {
                                        projectId,
                                        wbsCode: 'ROOT',
                                        wbsName: 'Imported Schedule',
                                        wbsLevel: 1,
                                        sequenceNo: 1,
                                        createdBy: 'Import',
                                    }));
                                    wbsMap.set('ROOT', rootWbs);
                                }
                                parentNode = rootWbs;
                            }
                            const start = t.Start ? new Date(t.Start) : null;
                            const finish = t.Finish ? new Date(t.Finish) : null;
                            const actualStart = t.ActualStart
                                ? new Date(t.ActualStart)
                                : null;
                            const actualFinish = t.ActualFinish
                                ? new Date(t.ActualFinish)
                                : null;
                            let baselineStart = null;
                            let baselineFinish = null;
                            if (t.Baseline) {
                                const baselines = Array.isArray(t.Baseline)
                                    ? t.Baseline
                                    : [t.Baseline];
                                const bl = baselines.find((b) => b.Number === '0');
                                if (bl) {
                                    baselineStart = bl.Start ? new Date(bl.Start) : null;
                                    baselineFinish = bl.Finish ? new Date(bl.Finish) : null;
                                }
                            }
                            let duration = 0;
                            if (t.Duration &&
                                typeof t.Duration === 'string' &&
                                t.Duration.startsWith('PT')) {
                                const match = t.Duration.match(/PT(\d+)H/);
                                if (match) {
                                    const hours = parseInt(match[1]);
                                    duration = hours / 8;
                                }
                            }
                            const activity = manager.create(activity_entity_1.Activity, {
                                projectId,
                                wbsNode: parentNode,
                                activityCode: uid,
                                activityName: name,
                                activityType: activity_entity_1.ActivityType.TASK,
                                status: actualFinish
                                    ? activity_entity_1.ActivityStatus.COMPLETED
                                    : actualStart
                                        ? activity_entity_1.ActivityStatus.IN_PROGRESS
                                        : activity_entity_1.ActivityStatus.NOT_STARTED,
                                startDatePlanned: start,
                                finishDatePlanned: finish,
                                startDateActual: actualStart,
                                finishDateActual: actualFinish,
                                startDateBaseline: baselineStart,
                                finishDateBaseline: baselineFinish,
                                durationPlanned: duration,
                                isMilestone: t.Milestone === '1',
                                createdBy: 'Import',
                            });
                            const savedActivity = await manager.save(activity);
                            uidToActivityId.set(uid, savedActivity.id);
                            count++;
                        }
                        catch (err) {
                            throw new Error(`Failed to import Task UID: ${uid}, Name: "${name}". Error: ${err.message}`);
                        }
                    }
                }
                for (const t of tasks) {
                    if (t.PredecessorLink) {
                        const links = Array.isArray(t.PredecessorLink)
                            ? t.PredecessorLink
                            : [t.PredecessorLink];
                        const successorId = uidToActivityId.get(t.UID);
                        if (!successorId)
                            continue;
                        for (const link of links) {
                            const predecessorUid = link.PredecessorUID;
                            const predecessorId = uidToActivityId.get(predecessorUid);
                            if (predecessorId) {
                                let relType = activity_relationship_entity_1.RelationshipType.FS;
                                if (link.Type) {
                                    switch (link.Type) {
                                        case '0':
                                            relType = activity_relationship_entity_1.RelationshipType.FF;
                                            break;
                                        case '1':
                                            relType = activity_relationship_entity_1.RelationshipType.FS;
                                            break;
                                        case '2':
                                            relType = activity_relationship_entity_1.RelationshipType.SF;
                                            break;
                                        case '3':
                                            relType = activity_relationship_entity_1.RelationshipType.SS;
                                            break;
                                    }
                                }
                                let lagDays = 0;
                                if (link.LinkLag) {
                                    const val = parseInt(link.LinkLag);
                                    if (!isNaN(val)) {
                                        lagDays = val / 4800;
                                    }
                                }
                                await manager.save(manager.create(activity_relationship_entity_1.ActivityRelationship, {
                                    predecessor: { id: predecessorId },
                                    successor: { id: successorId },
                                    relationshipType: relType,
                                    lagDays: lagDays,
                                    projectId,
                                }));
                            }
                        }
                    }
                }
                return {
                    message: `Successfully imported ${count} activities and generated WBS structure.`,
                    preview: [],
                };
            }
            catch (e) {
                console.error(e);
                throw new common_1.BadRequestException(`Failed to parse XML: ${e.message}`);
            }
        });
    }
    async importPrimaveraP6(projectId, fileBuffer) {
        throw new common_1.BadRequestException('P6 Import not yet implemented');
    }
};
exports.ScheduleImportService = ScheduleImportService;
exports.ScheduleImportService = ScheduleImportService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(activity_entity_1.Activity)),
    __param(1, (0, typeorm_1.InjectRepository)(activity_relationship_entity_1.ActivityRelationship)),
    __param(2, (0, typeorm_1.InjectRepository)(wbs_entity_1.WbsNode)),
    __param(3, (0, typeorm_1.InjectRepository)(work_calendar_entity_1.WorkCalendar)),
    __param(4, (0, typeorm_1.InjectRepository)(project_profile_entity_1.ProjectProfile)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], ScheduleImportService);
//# sourceMappingURL=schedule-import.service.js.map