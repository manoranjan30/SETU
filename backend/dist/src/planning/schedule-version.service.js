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
exports.ScheduleVersionService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const schedule_version_entity_1 = require("./entities/schedule-version.entity");
const activity_version_entity_1 = require("./entities/activity-version.entity");
const activity_entity_1 = require("../wbs/entities/activity.entity");
const activity_relationship_entity_1 = require("../wbs/entities/activity-relationship.entity");
const scheduling_engine_service_1 = require("./scheduling-engine.service");
let ScheduleVersionService = class ScheduleVersionService {
    versionRepo;
    activityVersionRepo;
    activityRepo;
    relRepo;
    dataSource;
    engine;
    constructor(versionRepo, activityVersionRepo, activityRepo, relRepo, dataSource, engine) {
        this.versionRepo = versionRepo;
        this.activityVersionRepo = activityVersionRepo;
        this.activityRepo = activityRepo;
        this.relRepo = relRepo;
        this.dataSource = dataSource;
        this.engine = engine;
    }
    async getVersions(projectId) {
        return this.versionRepo.find({
            where: { projectId },
            order: { createdOn: 'DESC' },
        });
    }
    async createVersion(projectId, code, type, sourceVersionId, user = 'System') {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            let sequenceNumber = 0;
            let parentVersionId = null;
            if (sourceVersionId) {
                const parent = await this.versionRepo.findOne({
                    where: { id: sourceVersionId },
                });
                if (parent) {
                    sequenceNumber = parent.sequenceNumber + 1;
                    parentVersionId = parent.id;
                }
            }
            else {
                sequenceNumber = 0;
            }
            const newVersion = this.versionRepo.create({
                projectId,
                versionCode: code,
                versionType: type,
                parentVersionId,
                sequenceNumber,
                createdBy: user,
                isActive: type === schedule_version_entity_1.ScheduleVersionType.WORKING,
            });
            const savedVersion = await queryRunner.manager.save(schedule_version_entity_1.ScheduleVersion, newVersion);
            if (!sourceVersionId) {
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
                await queryRunner.manager.save(activity_version_entity_1.ActivityVersion, versions);
            }
            else {
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
                await queryRunner.manager.save(activity_version_entity_1.ActivityVersion, versions);
            }
            await queryRunner.commitTransaction();
            return savedVersion;
        }
        catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        }
        finally {
            await queryRunner.release();
        }
    }
    async getVersionActivities(versionId) {
        return this.activityVersionRepo.find({
            where: { versionId },
            relations: ['activity', 'activity.wbsNode'],
        });
    }
    async updateActivityDate(versionId, activityId, start, finish, actualStart, actualFinish) {
        const av = await this.activityVersionRepo.findOne({
            where: { versionId, activityId },
            relations: ['activity'],
        });
        if (!av)
            throw new common_1.NotFoundException('Activity not found in this version');
        if (start !== undefined)
            av.startDate = start;
        if (finish !== undefined)
            av.finishDate = finish;
        await this.activityVersionRepo.save(av);
        if (av.activity) {
            let masterChanged = false;
            if (actualStart !== undefined) {
                av.activity.startDateActual = actualStart;
                masterChanged = true;
                if (actualStart && av.activity.status === activity_entity_1.ActivityStatus.NOT_STARTED) {
                    av.activity.status = activity_entity_1.ActivityStatus.IN_PROGRESS;
                }
            }
            if (actualFinish !== undefined) {
                const oldFinish = av.activity.finishDateActual;
                av.activity.finishDateActual = actualFinish;
                masterChanged = true;
                if (actualFinish) {
                    av.activity.status = activity_entity_1.ActivityStatus.COMPLETED;
                    av.activity.percentComplete = 100;
                }
                else if (oldFinish && !actualFinish) {
                    av.activity.status = activity_entity_1.ActivityStatus.IN_PROGRESS;
                    if (av.activity.percentComplete >= 100) {
                        av.activity.percentComplete = 99.9;
                    }
                }
            }
            if (masterChanged) {
                await this.activityRepo.save(av.activity);
            }
        }
        return av;
    }
    async deleteVersion(projectId, versionId) {
        const childVersion = await this.versionRepo.findOne({
            where: { parentVersionId: versionId },
        });
        if (childVersion) {
            throw new common_1.NotFoundException(`Cannot delete version. A newer revision (${childVersion.versionCode}) depends on it. Delete the newer version first.`);
        }
        const version = await this.versionRepo.findOne({
            where: { id: versionId, projectId },
        });
        if (!version)
            throw new common_1.NotFoundException('Version not found');
        await this.activityVersionRepo.delete({ versionId });
        return this.versionRepo.remove(version);
    }
    async recalculateSchedule(versionId) {
        const activities = await this.activityVersionRepo.find({
            where: { versionId },
        });
        if (activities.length === 0)
            return;
        const projectId = (await this.versionRepo.findOne({ where: { id: versionId } }))?.projectId;
        if (!projectId)
            throw new common_1.NotFoundException('Project not found for version');
        const relationships = await this.relRepo.find({
            where: { projectId },
            relations: ['predecessor', 'successor'],
        });
        const earliest = activities.reduce((min, av) => {
            const d = av.startDate
                ? new Date(av.startDate).getTime()
                : Number.MAX_SAFE_INTEGER;
            return d < min ? d : min;
        }, Number.MAX_SAFE_INTEGER);
        const projectStart = earliest === Number.MAX_SAFE_INTEGER ? new Date() : new Date(earliest);
        const updated = this.engine.calculateCPM(activities, relationships, projectStart);
        await this.activityVersionRepo.save(updated);
        return updated;
    }
    async createRevisionWithUpdates(projectId, sourceVersionId, updates, codeInput) {
        const source = await this.versionRepo.findOne({
            where: { id: sourceVersionId },
        });
        if (!source)
            throw new common_1.NotFoundException('Source Version not found');
        const masterActivities = await this.activityRepo.find({
            where: { projectId },
        });
        const masterMap = new Map(masterActivities.map((a) => [a.id, a]));
        const invalidUpdates = [];
        updates.forEach((u) => {
            const master = masterMap.get(Number(u.activityId));
            if (master) {
                if (master.startDateActual && u.actualStart) {
                    const masterTime = new Date(master.startDateActual).getTime();
                    const updateTime = new Date(u.actualStart).getTime();
                    if (Math.abs(masterTime - updateTime) > 1000 * 60 * 60 * 24) {
                        invalidUpdates.push(`Activity ${master.activityCode}: Imported Actual Start (${u.actualStart}) conflicts with existing Actual Start (${master.startDateActual.toISOString().split('T')[0]})`);
                    }
                }
                if (master.finishDateActual && u.actualFinish) {
                    const masterTime = new Date(master.finishDateActual).getTime();
                    const updateTime = new Date(u.actualFinish).getTime();
                    if (Math.abs(masterTime - updateTime) > 1000 * 60 * 60 * 24) {
                        invalidUpdates.push(`Activity ${master.activityCode}: Imported Actual Finish (${u.actualFinish}) conflicts with existing Actual Finish (${master.finishDateActual.toISOString().split('T')[0]})`);
                    }
                }
            }
        });
        if (invalidUpdates.length > 0) {
            throw new common_1.BadRequestException(`Validation Failed: \n${invalidUpdates.join('\n')}`);
        }
        const newCode = codeInput === 'Rev' ? `R${source.sequenceNumber + 1}` : codeInput;
        const newVersion = await this.createVersion(projectId, newCode, schedule_version_entity_1.ScheduleVersionType.WORKING, sourceVersionId, 'Import');
        const targetActivities = await this.activityVersionRepo.find({
            where: { versionId: newVersion.id },
        });
        const updateMap = new Map(updates.map((u) => [Number(u.activityId), u]));
        const toSave = [];
        for (const av of targetActivities) {
            const update = updateMap.get(av.activityId);
            if (update) {
                if (update.startDate)
                    av.startDate = new Date(update.startDate);
                if (update.finishDate)
                    av.finishDate = new Date(update.finishDate);
                if (update.remarks)
                    av.remarks = update.remarks;
                toSave.push(av);
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
        await this.recalculateSchedule(newVersion.id);
        return newVersion;
    }
    async compareVersions(baseVersionId, compareVersionId) {
        const baseActivities = await this.activityVersionRepo.find({
            where: { versionId: baseVersionId },
            relations: ['activity', 'activity.wbsNode'],
        });
        const compareActivities = await this.activityVersionRepo.find({
            where: { versionId: compareVersionId },
            relations: ['activity', 'activity.wbsNode'],
        });
        const baseMap = new Map(baseActivities.map((a) => [a.activityId, a]));
        const comparison = compareActivities.map((comp) => {
            const base = baseMap.get(comp.activityId);
            const v1Start = base?.startDate ? new Date(base.startDate) : null;
            const v2Start = comp.startDate ? new Date(comp.startDate) : null;
            const v1Finish = base?.finishDate ? new Date(base.finishDate) : null;
            const v2Finish = comp.finishDate ? new Date(comp.finishDate) : null;
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
                startVariance,
                baseFinish: base?.finishDate,
                compareFinish: comp.finishDate,
                finishVariance,
                baseDuration: base?.duration,
                compareDuration: comp.duration,
            };
        });
        return comparison;
    }
};
exports.ScheduleVersionService = ScheduleVersionService;
exports.ScheduleVersionService = ScheduleVersionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(schedule_version_entity_1.ScheduleVersion)),
    __param(1, (0, typeorm_1.InjectRepository)(activity_version_entity_1.ActivityVersion)),
    __param(2, (0, typeorm_1.InjectRepository)(activity_entity_1.Activity)),
    __param(3, (0, typeorm_1.InjectRepository)(activity_relationship_entity_1.ActivityRelationship)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        scheduling_engine_service_1.SchedulingEngineService])
], ScheduleVersionService);
//# sourceMappingURL=schedule-version.service.js.map